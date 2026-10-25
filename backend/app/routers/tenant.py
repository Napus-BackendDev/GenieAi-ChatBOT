import os
import re
import asyncio
import logging
import threading
import uuid
import httpx
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Body, Response
from app.core.config import settings
from app.core.security import create_webchat_token, require_tenant, get_current_tenant, decode_reauth_token
from app.core.db import db_load_profile, db_save_profile

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tenant", tags=["tenant"])

# Thread lock for synchronizing file access
tenant_file_lock = threading.Lock()

# Secret fields that must never be returned by the profile GET endpoint,
# and that must only be overwritten when a non-empty value is supplied.
SECRET_FIELDS = (
    "line_channel_access_token",
    "line_channel_secret",
    "facebook_page_access_token",
    "facebook_verify_token",
)


def _detect_image_extension(header: bytes) -> str | None:
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if header.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return ".webp"
    return None

# Path-traversal guard: tenant_id feeds data/tenant_profile_{id}.json and static/images/{id}.
_TENANT_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def _validate_tenant_id(tenant_id: str) -> None:
    """Reject tenant_id values that could escape the data/ or static/ directories."""
    if not _TENANT_ID_RE.match(tenant_id or ""):
        raise HTTPException(status_code=400, detail="Invalid tenant_id.")


def _enforce_tenant(tenant_id: str, current_tenant) -> None:
    """Assert the path tenant_id matches the token's tenant (403 otherwise).

    Only enforced when FastAPI has resolved `current_tenant` to a real string.
    When these functions are invoked directly (e.g. unit tests bypassing the
    HTTP layer), `current_tenant` is still the unresolved Depends sentinel, so
    the check is skipped — HTTP callers always get a resolved string.
    """
    if isinstance(current_tenant, str):
        require_tenant(tenant_id, current_tenant)

class ServiceItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    price: str = Field(default="", max_length=200)
    duration: int = Field(default=30, ge=5, le=1440)  # duration in minutes

class StaffItem(BaseModel):
    name: str
    role: str = ""
    specialties: list[str] = []
    experience: str = ""
    qualifications: str = ""
    languages: list[str] = []
    schedule: str = ""
    special_interests: list[str] = []
    board_cert: str = ""

class PromotionItem(BaseModel):
    name: str
    description: str = ""
    discount: str = ""
    valid_until: str = ""
    conditions: str = ""
    image_url: str = ""

class FAQItem(BaseModel):
    question: str
    answer: str

class CustomRuleItem(BaseModel):
    category: str
    rule: str


class DeletionRequest(BaseModel):
    reauth_token: str = Field(..., min_length=1, max_length=4096)
    confirmation: str = Field(..., min_length=1, max_length=200)
    idempotency_key: str = Field(default="", max_length=100)

class WebchatSettings(BaseModel):
    enabled: bool = True
    theme_color: str = "#2B6CB0"
    welcome_message: str = "สวัสดีค่ะ! ยินดีต้อนรับสู่บริการผู้ช่วย AI ของเรา มีอะไรให้ช่วยวันนี้คะ?"
    token_version: int = Field(default=1, ge=1)

class AISettings(BaseModel):
    model_name: str = Field(default="gpt-4o-mini", max_length=100)
    temperature: float = Field(default=0.2, ge=0, le=2)
    cag_token_threshold: int = Field(default=15000, ge=100, le=100000)
    # LINE reply pacing: 'slow' (AIS-like human typing, default) | 'normal' | 'off'.
    humanize_mode: str = "slow"

class BookingSettings(BaseModel):
    conflict_window_mins: int = Field(default=30, ge=1, le=1440)
    min_lead_time_hours: float = Field(default=2, ge=0, le=720)

class TenantProfile(BaseModel):
    company_name: str = ""
    business_hours: str = ""
    services: list[ServiceItem] = []
    contact_number: str = ""
    staff: list[StaffItem] = []
    promotions: list[PromotionItem] = []
    faq: list[FAQItem] = []
    custom_rules: list[CustomRuleItem] = []
    webhook_domain: str = ""
    line_channel_access_token: str = ""
    line_channel_secret: str = ""
    line_verified: bool = False
    facebook_page_access_token: str = ""
    facebook_verify_token: str = ""
    facebook_verified: bool = False
    # The Messenger Page ID this tenant owns — used to route incoming Facebook
    # webhook events (entry.id) to the correct tenant instead of a global default.
    facebook_page_id: str = ""
    line_bot_user_id: str = ""
    line_credential_fingerprint: str = ""
    facebook_credential_fingerprint: str = ""
    webchat_settings: WebchatSettings = WebchatSettings()
    ai_settings: AISettings = AISettings()
    booking_settings: BookingSettings = BookingSettings()
    timezone: str = "Asia/Bangkok"
    conversation_retention_days: int = Field(default=90, ge=7, le=365)
    # Explicit "the owner finished the onboarding wizard" flag. This is the sole
    # signal the frontend routes on — never infer completion from company_name,
    # which leaves accounts that have docs but a blank name stuck in an onboarding loop.
    onboarding_completed: bool = False

def _get_profile_path(tenant_id: str) -> str:
    return f"data/tenant_profile_{tenant_id}.json"

@router.get("/profile/{tenant_id}")
async def get_profile(tenant_id: str = Depends(require_tenant)):
    """
    Retrieves the structured business profile details for a given tenant_id.
    The path tenant_id must match the caller's verified token (403 otherwise).

    Returns all NON-secret profile fields plus computed booleans
    `line_configured` / `facebook_configured`. The four secret fields
    (line/facebook tokens & secrets) are NEVER included in the response.
    """
    _validate_tenant_id(tenant_id)
    try:
        raw = await db_load_profile(tenant_id)
        if not raw:
            # Return default empty profile (normalised via the model).
            data = TenantProfile().model_dump()
        else:
            # Normalise through the model so defaults/shape are consistent.
            data = TenantProfile(**raw).model_dump()
    except Exception as e:
        logger.error(f"Error loading tenant profile for {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load tenant profile.")

    # Compute configuration booleans from the (still-present) secret values.
    import hashlib
    stored_line_fp = str(data.get("line_credential_fingerprint") or "").strip()
    line_token = str(data.get("line_channel_access_token") or "").strip()
    expected_line_fp = hashlib.sha256(line_token.encode("utf-8")).hexdigest() if line_token else ""

    line_credentials_present = bool(
        line_token
        and str(data.get("line_channel_secret") or "").strip()
    )
    line_enabled = bool(
        data.get("line_verified")
        and line_credentials_present
        and (not stored_line_fp or stored_line_fp == expected_line_fp)
    )

    stored_fb_fp = str(data.get("facebook_credential_fingerprint") or "").strip()
    fb_token = str(data.get("facebook_page_access_token") or "").strip()
    fb_page_id = str(data.get("facebook_page_id") or "").strip()
    expected_fb_fp = hashlib.sha256(f"{fb_page_id}:{fb_token}".encode("utf-8")).hexdigest() if (fb_token and fb_page_id) else ""

    facebook_credentials_present = bool(fb_token and fb_page_id)
    facebook_enabled = bool(
        data.get("facebook_verified")
        and facebook_credentials_present
        and (not stored_fb_fp or stored_fb_fp == expected_fb_fp)
    )

    # Strip secrets before returning.
    for field in SECRET_FIELDS:
        data.pop(field, None)

    data["line_configured"] = line_credentials_present
    data["line_enabled"] = line_enabled
    data["facebook_configured"] = facebook_credentials_present
    data["facebook_enabled"] = facebook_enabled
    return data

@router.post("/profile/{tenant_id}")
async def save_profile(
    tenant_id: str,
    profile: TenantProfile,
    current_tenant: str = Depends(get_current_tenant),
):
    """
    Saves or updates the structured business profile details for a given tenant_id.
    Invalidates the Redis CAG/RAG cached profile. The path tenant_id must match
    the caller's verified token (403 otherwise).
    """
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)

    try:
        profile_dict = profile.model_dump()
        explicit_fields = profile.model_fields_set

        # Load existing data
        existing_data = await db_load_profile(tenant_id)

        SERVER_MANAGED_FIELDS = {
            "line_verified", "facebook_verified",
            "line_bot_user_id", "line_credential_fingerprint",
            "facebook_credential_fingerprint"
        }

        # Validate Facebook Page ID uniqueness if provided
        if "facebook_page_id" in explicit_fields:
            new_pid = str(profile_dict.get("facebook_page_id") or "").strip()
            if new_pid and new_pid != str(existing_data.get("facebook_page_id") or "").strip():
                from app.core.db import db_resolve_tenant_by_fb_page_id
                owner = await db_resolve_tenant_by_fb_page_id(new_pid)
                if owner and owner != tenant_id:
                    raise HTTPException(
                        status_code=409,
                        detail="This Facebook Page ID is already assigned to another account.",
                    )

        # Merge explicitly set fields from incoming request into existing_data.
        for field in TenantProfile.model_fields.keys():
            if field not in explicit_fields or field in SERVER_MANAGED_FIELDS:
                continue
            value = profile_dict[field]
            if field in SECRET_FIELDS and not str(value or "").strip():
                # Preserve existing secret; empty incoming value = unchanged.
                logger.info(f"Preserving existing secret field '{field}' (empty incoming value).")
                continue

            # Invalidate verification if credentials change
            if field == "line_channel_access_token" and str(value or "").strip() != str(existing_data.get(field) or "").strip():
                existing_data["line_verified"] = False
                existing_data["line_bot_user_id"] = ""
                existing_data["line_credential_fingerprint"] = ""
            elif field == "line_channel_secret" and str(value or "").strip() != str(existing_data.get(field) or "").strip():
                existing_data["line_verified"] = False
            elif field in {"facebook_page_access_token", "facebook_page_id"} and str(value or "").strip() != str(existing_data.get(field) or "").strip():
                existing_data["facebook_verified"] = False
                existing_data["facebook_credential_fingerprint"] = ""

            existing_data[field] = value
            if field in SECRET_FIELDS:
                logger.info(f"Updating secret field '{field}' in tenant profile.")
            else:
                logger.info(f"Updating field '{field}' in tenant profile.")

        # Save merged profile
        await db_save_profile(tenant_id, existing_data)
        
        logger.info(f"Saved structured profile for tenant {tenant_id}")
        
        # Clear Redis Cache for RAG/CAG so it rebuilds with updated values
        from app.core.redis import get_redis
        try:
            redis_client = get_redis()
            cache_key = f"tenant_cag_profile:{tenant_id}"
            await redis_client.delete(cache_key)
            logger.info(f"Invalidated Redis CAG profile cache for tenant '{tenant_id}' due to profile update.")
        except Exception as cache_err:
            logger.warning(f"Failed to clear Redis CAG profile cache: {cache_err}")
            
        return {"status": "success", "message": "Tenant profile saved successfully."}
    except Exception as e:
        logger.error(f"Error saving tenant profile for {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to save tenant profile.")

@router.post("/upload-image/{tenant_id}")
async def upload_tenant_image(
    tenant_id: str,
    file: UploadFile = File(...),
    current_tenant: str = Depends(get_current_tenant),
):
    """
    Uploads an image file for a tenant (e.g. promotion image) and returns its
    static URL. The path tenant_id must match the caller's verified token.
    """
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(os.path.basename(file.filename or ""))[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Only images are allowed (.jpg, .jpeg, .png, .webp, .gif)")
        
    total_bytes = 0
    header = b""
    content = bytearray()
    try:
        while chunk := await file.read(1024 * 1024):
            total_bytes += len(chunk)
            if total_bytes > settings.MAX_IMAGE_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="Image exceeds the upload size limit.",
                )
            content.extend(chunk)
            if len(header) < 12:
                header = (header + chunk)[:12]
        detected_ext = _detect_image_extension(header)
        normalized_ext = ".jpg" if ext == ".jpeg" else ext
        if detected_ext != normalized_ext:
            raise HTTPException(
                status_code=400,
                detail="Image content does not match its filename.",
            )
        from app.services.media_storage import store_media
        stored = await store_media(
            bytes(content),
            tenant_id=tenant_id,
            filename=f"{uuid.uuid4().hex}{ext}",
            content_type=f"image/{'jpeg' if normalized_ext == '.jpg' else normalized_ext.lstrip('.')}",
            category="promotions",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to save uploaded image: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Failed to save uploaded image.")

    return {"status": "success", "image_url": stored["url"]}


class VerifyLineRequest(BaseModel):
    access_token: str = ""


class VerifyFacebookRequest(BaseModel):
    access_token: str = ""
    page_id: str = ""


LINE_BOT_INFO_URL = "https://api.line.me/v2/bot/info"


@router.post("/verify-line/{tenant_id}")
async def verify_line(
    tenant_id: str,
    body: VerifyLineRequest | None = None,
    current_tenant: str = Depends(get_current_tenant),
):
    """
    Verifies a LINE Channel Access Token by calling LINE's bot info endpoint.

    Uses the supplied token if provided; otherwise falls back to the tenant's
    saved token from the profile file. Returns bot display name + picture on
    success, or a plain-Thai error reason on failure. Never leaks the token.
    The path tenant_id must match the caller's verified token.
    """
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)

    access_token = (body.access_token if body else "") or ""
    access_token = access_token.strip()

    # Fall back to the tenant's stored token when none supplied.
    if not access_token:
        with tenant_file_lock:
            try:
                saved = await db_load_profile(tenant_id)
                access_token = str(saved.get("line_channel_access_token") or "").strip()
            except Exception as read_err:
                logger.warning(f"Could not read tenant profile for LINE verify: {read_err}")

    if not access_token:
        await _save_profile_fields(tenant_id, {
            "line_verified": False,
            "line_bot_user_id": "",
            "line_credential_fingerprint": "",
        })
        return {"valid": False, "error": "ยังไม่ได้ใส่ Channel Access Token"}

    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(LINE_BOT_INFO_URL, headers=headers, timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            bot_user_id = str(data.get("userId") or "").strip()
            if bot_user_id:
                from app.core.db import db_resolve_tenant_by_line_bot_id
                existing_owner = await db_resolve_tenant_by_line_bot_id(bot_user_id)
                if existing_owner and existing_owner != tenant_id:
                    logger.warning(f"LINE bot {bot_user_id} already belongs to tenant {existing_owner}")
                    raise HTTPException(
                        status_code=409,
                        detail="This LINE bot is already connected to another account.",
                    )
            import hashlib
            fp = hashlib.sha256(access_token.encode("utf-8")).hexdigest()
            updates = {
                "line_verified": True,
                "line_bot_user_id": bot_user_id,
                "line_credential_fingerprint": fp,
            }
            if body and body.access_token and body.access_token.strip():
                updates["line_channel_access_token"] = access_token
            await _save_profile_fields(tenant_id, updates)
            return {
                "valid": True,
                "bot_name": data.get("displayName", ""),
                "picture_url": data.get("pictureUrl") or "",
                "bot_user_id": bot_user_id,
            }
        logger.info(f"LINE verify failed for tenant {tenant_id}: HTTP {response.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"LINE verify error for tenant {tenant_id}: {e}")

    await _save_profile_fields(tenant_id, {
        "line_verified": False,
        "line_bot_user_id": "",
        "line_credential_fingerprint": "",
    })
    return {"valid": False, "error": "โทเคนไม่ถูกต้องหรือหมดอายุ"}


@router.post("/verify-facebook/{tenant_id}")
async def verify_facebook(
    tenant_id: str,
    body: VerifyFacebookRequest | None = None,
    current_tenant: str = Depends(get_current_tenant),
):
    """Verify the configured Page token and Page ID before enabling Facebook."""
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    profile = await db_load_profile(tenant_id) or {}
    access_token = (body.access_token if body else "").strip() or str(profile.get("facebook_page_access_token") or "").strip()
    page_id = (body.page_id if body else "").strip() or str(profile.get("facebook_page_id") or "").strip()
    if not access_token or not page_id:
        await _save_profile_fields(tenant_id, {
            "facebook_verified": False,
            "facebook_credential_fingerprint": "",
        })
        return {"valid": False, "error": "ต้องระบุ Page Access Token และ Page ID"}

    from app.core.db import db_resolve_tenant_by_fb_page_id
    existing_owner = await db_resolve_tenant_by_fb_page_id(page_id)
    if existing_owner and existing_owner != tenant_id:
        raise HTTPException(
            status_code=409,
            detail="This Facebook Page ID is already assigned to another account.",
        )

    try:
        graph_version = os.getenv("FB_GRAPH_API_VERSION", "v21.0")
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.facebook.com/{graph_version}/{page_id}",
                params={"fields": "id", "access_token": access_token},
                timeout=5.0,
            )
        verified = response.status_code == 200 and str((response.json() or {}).get("id")) == page_id
    except Exception as exc:
        logger.warning("Facebook credential verification failed: %s", type(exc).__name__)
        verified = False

    if not verified:
        await _save_profile_fields(tenant_id, {
            "facebook_verified": False,
            "facebook_credential_fingerprint": "",
        })
        return {"valid": False, "error": "Page credential หรือ Page ID ไม่ถูกต้อง"}

    import hashlib
    fp = hashlib.sha256(f"{page_id}:{access_token}".encode("utf-8")).hexdigest()
    updates = {
        "facebook_verified": True,
        "facebook_page_id": page_id,
        "facebook_credential_fingerprint": fp,
    }
    if body and body.access_token and body.access_token.strip():
        updates["facebook_page_access_token"] = access_token
    await _save_profile_fields(tenant_id, updates)
    return {"valid": True, "page_id": page_id}


async def _save_profile_fields(tenant_id: str, fields: dict) -> None:
    raw = await db_load_profile(tenant_id) or {}
    raw.update(fields)
    await db_save_profile(tenant_id, raw)

    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        cache_key = f"tenant_cag_profile:{tenant_id}"
        await redis_client.delete(cache_key)
        logger.info(f"Invalidated Redis CAG profile cache for tenant '{tenant_id}'.")
    except Exception as cache_err:
        logger.warning(f"Failed to clear Redis CAG profile cache: {cache_err}")


async def _save_profile_field(tenant_id: str, field_name: str, field_value) -> None:
    await _save_profile_fields(tenant_id, {field_name: field_value})
    
    # Clear Redis Cache
    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        cache_key = f"tenant_cag_profile:{tenant_id}"
        await redis_client.delete(cache_key)
        logger.info(f"Invalidated Redis CAG profile cache for tenant '{tenant_id}' due to {field_name} update.")
    except Exception as cache_err:
        logger.warning(f"Failed to clear Redis CAG profile cache: {cache_err}")


class ServicesUpdateRequest(BaseModel):
    services: list[ServiceItem]


@router.get("/profile/{tenant_id}/services")
async def get_services(tenant_id: str, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    raw = await db_load_profile(tenant_id) or {}
    return {"services": raw.get("services", [])}


@router.post("/profile/{tenant_id}/services")
async def update_services(tenant_id: str, body: ServicesUpdateRequest, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    services_list = [item.model_dump() for item in body.services]
    await _save_profile_field(tenant_id, "services", services_list)
    return {"status": "success", "message": "Services saved successfully."}


class StaffUpdateRequest(BaseModel):
    staff: list[StaffItem]


@router.get("/profile/{tenant_id}/staff")
async def get_staff(tenant_id: str, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    raw = await db_load_profile(tenant_id) or {}
    return {"staff": raw.get("staff", [])}


@router.post("/profile/{tenant_id}/staff")
async def update_staff(tenant_id: str, body: StaffUpdateRequest, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    staff_list = [item.model_dump() for item in body.staff]
    await _save_profile_field(tenant_id, "staff", staff_list)
    return {"status": "success", "message": "Staff saved successfully."}


class PromotionsUpdateRequest(BaseModel):
    promotions: list[PromotionItem]


@router.get("/profile/{tenant_id}/promotions")
async def get_promotions(tenant_id: str, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    raw = await db_load_profile(tenant_id) or {}
    return {"promotions": raw.get("promotions", [])}


@router.post("/profile/{tenant_id}/promotions")
async def update_promotions(tenant_id: str, body: PromotionsUpdateRequest, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    promotions_list = [item.model_dump() for item in body.promotions]
    await _save_profile_field(tenant_id, "promotions", promotions_list)
    return {"status": "success", "message": "Promotions saved successfully."}


class FAQUpdateRequest(BaseModel):
    faq: list[FAQItem]


@router.get("/profile/{tenant_id}/faq")
async def get_faq(tenant_id: str, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    raw = await db_load_profile(tenant_id) or {}
    return {"faq": raw.get("faq", [])}


@router.post("/profile/{tenant_id}/faq")
async def update_faq(tenant_id: str, body: FAQUpdateRequest, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    faq_list = [item.model_dump() for item in body.faq]
    await _save_profile_field(tenant_id, "faq", faq_list)
    return {"status": "success", "message": "FAQ saved successfully."}


class CustomRulesUpdateRequest(BaseModel):
    custom_rules: list[CustomRuleItem]


@router.get("/profile/{tenant_id}/custom-rules")
async def get_custom_rules(tenant_id: str, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    raw = await db_load_profile(tenant_id) or {}
    return {"custom_rules": raw.get("custom_rules", [])}


@router.post("/profile/{tenant_id}/custom-rules")
async def update_custom_rules(tenant_id: str, body: CustomRulesUpdateRequest, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    custom_rules_list = [item.model_dump() for item in body.custom_rules]
    await _save_profile_field(tenant_id, "custom_rules", custom_rules_list)
    return {"status": "success", "message": "Custom rules saved successfully."}


class SettingsUpdateRequest(BaseModel):
    company_name: str = ""
    business_hours: str = ""
    contact_number: str = ""
    webhook_domain: str = ""
    line_channel_access_token: str = ""
    line_channel_secret: str = ""
    facebook_page_access_token: str = ""
    facebook_verify_token: str = ""
    facebook_page_id: str = ""
    webchat_settings: WebchatSettings = WebchatSettings()
    ai_settings: AISettings = AISettings()
    booking_settings: BookingSettings = BookingSettings()
    timezone: str = "Asia/Bangkok"
    conversation_retention_days: int = Field(default=90, ge=7, le=365)


class WebchatConfigResponse(BaseModel):
    token: str
    script_path: str


class SettingsResponse(BaseModel):
    company_name: str
    business_hours: str
    contact_number: str
    webhook_domain: str
    webchat_settings: WebchatSettings
    ai_settings: AISettings
    booking_settings: BookingSettings
    line_verified: bool = False
    line_configured: bool = False
    line_enabled: bool = False
    line_bot_user_id: str = ""
    facebook_configured: bool = False
    facebook_enabled: bool = False
    facebook_verified: bool = False
    facebook_page_id: str = ""
    webchat_config: WebchatConfigResponse | None = None
    timezone: str = "Asia/Bangkok"
    conversation_retention_days: int = 90


@router.get("/profile/{tenant_id}/settings", response_model=SettingsResponse, status_code=200)
async def get_settings(
    tenant_id: str,
    current_tenant: str = Depends(get_current_tenant),
) -> SettingsResponse:
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    raw = await db_load_profile(tenant_id) or {}
    
    data = TenantProfile(**raw).model_dump()
    
    settings_keys = [
        "company_name", "business_hours", "contact_number", "webhook_domain",
        "webchat_settings", "ai_settings", "booking_settings",
        "timezone", "conversation_retention_days",
        "line_channel_access_token", "line_channel_secret", "line_verified", "line_bot_user_id",
        "facebook_page_access_token", "facebook_verify_token", "facebook_page_id", "facebook_verified"
    ]
    res = {k: data.get(k) for k in settings_keys}
    
    import hashlib
    stored_line_fp = str(data.get("line_credential_fingerprint") or "").strip()
    line_token = str(res.get("line_channel_access_token") or "").strip()
    expected_line_fp = hashlib.sha256(line_token.encode("utf-8")).hexdigest() if line_token else ""

    res["line_configured"] = bool(
        line_token
        and str(res.get("line_channel_secret") or "").strip()
    )
    res["line_enabled"] = bool(
        res.get("line_verified")
        and res["line_configured"]
        and (not stored_line_fp or stored_line_fp == expected_line_fp)
    )

    stored_fb_fp = str(data.get("facebook_credential_fingerprint") or "").strip()
    fb_token = str(res.get("facebook_page_access_token") or "").strip()
    fb_page_id = str(res.get("facebook_page_id") or "").strip()
    expected_fb_fp = hashlib.sha256(f"{fb_page_id}:{fb_token}".encode("utf-8")).hexdigest() if (fb_token and fb_page_id) else ""

    res["facebook_configured"] = bool(fb_token and fb_page_id)
    res["facebook_enabled"] = bool(
        res.get("facebook_verified")
        and res["facebook_configured"]
        and (not stored_fb_fp or stored_fb_fp == expected_fb_fp)
    )
    res["webchat_config"] = {
        "token": create_webchat_token(
            tenant_id,
            data["webchat_settings"].get("token_version", 1),
        ),
        "script_path": "/static/widget.js",
    }
    
    for field in SECRET_FIELDS:
        res.pop(field, None)
        
    return SettingsResponse(**res)


@router.get("/ai-usage")
async def get_ai_usage(current_tenant: str = Depends(get_current_tenant)):
    """Return only this tenant's AI usage; never expose global/other tenants' totals."""
    day_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    next_reset = day_start + timedelta(days=1)
    day = day_start.strftime("%Y%m%d")
    from app.core.redis import get_redis

    try:
        client = get_redis()
        token_value = await client.get(f"ai:budget:tenant:{current_tenant}:{day}")
        request_value = await client.get(f"ai:requests:tenant:{current_tenant}:{day}")
        return {
            "provider": settings.AI_PROVIDER,
            "tenant_tokens": int(token_value or 0),
            "tenant_token_limit": settings.AI_TENANT_DAILY_TOKEN_CAP,
            "tenant_requests": int(request_value or 0),
            "tenant_request_limit": settings.AI_TENANT_DAILY_REQUEST_CAP,
            "reset_at": next_reset.isoformat(),
        }
    except Exception as exc:
        if settings.is_production:
            raise HTTPException(status_code=503, detail="AI usage is temporarily unavailable") from exc
        return {
            "provider": settings.AI_PROVIDER,
            "tenant_tokens": 0,
            "tenant_token_limit": settings.AI_TENANT_DAILY_TOKEN_CAP,
            "tenant_requests": 0,
            "tenant_request_limit": settings.AI_TENANT_DAILY_REQUEST_CAP,
            "reset_at": next_reset.isoformat(),
            "meter_status": "unavailable",
        }


@router.post("/profile/{tenant_id}/settings")
async def update_settings(tenant_id: str, body: SettingsUpdateRequest, current_tenant: str = Depends(get_current_tenant)):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    
    body_dict = body.model_dump()
    explicit_fields = body.model_fields_set
    
    raw = await db_load_profile(tenant_id) or {}

    requested_page_id = str(body.facebook_page_id or "").strip()
    if "facebook_page_id" in body.model_fields_set and requested_page_id:
        from app.core.db import db_resolve_tenant_by_fb_page_id

        owner = await db_resolve_tenant_by_fb_page_id(requested_page_id)
        if owner and owner != tenant_id:
            raise HTTPException(
                status_code=409,
                detail="This Facebook Page ID is already assigned to another account.",
            )
    
    SERVER_MANAGED_FIELDS = {
        "line_verified", "facebook_verified",
        "line_bot_user_id", "line_credential_fingerprint",
        "facebook_credential_fingerprint",
    }

    for field in SettingsUpdateRequest.model_fields.keys():
        if field not in explicit_fields or field in SERVER_MANAGED_FIELDS:
            continue
        val = body_dict[field]
        if field in SECRET_FIELDS and not str(val or "").strip():
            continue
        old_val = str(raw.get(field) or "").strip()
        new_val = str(val or "").strip()
        raw[field] = val
        if field == "line_channel_access_token" and new_val != old_val:
            raw["line_verified"] = False
            raw["line_bot_user_id"] = ""
            raw["line_credential_fingerprint"] = ""
        elif field == "line_channel_secret" and new_val != old_val:
            raw["line_verified"] = False
        elif field in {"facebook_page_access_token", "facebook_page_id"} and new_val != old_val:
            raw["facebook_verified"] = False
            raw["facebook_credential_fingerprint"] = ""
        
    await db_save_profile(tenant_id, raw)
    
    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        cache_key = f"tenant_cag_profile:{tenant_id}"
        await redis_client.delete(cache_key)
    except Exception:
        pass
        
    return {"status": "success", "message": "Settings saved successfully."}


_used_reauth_tokens: set[str] = set()


async def _queue_deletion_request(
    req,
    tenant_id: str,
    current_tenant: str,
    response: Response,
):
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    from app.core.db import db_get_user_by_tenant, db_load_profile

    payload = decode_reauth_token(req.reauth_token, tenant_id)
    token_id = payload["jti"]
    try:
        from app.core.redis import get_redis
        accepted = await get_redis().set(f"reauth:used:{token_id}", "1", ex=300, nx=True)
        if not accepted:
            raise HTTPException(status_code=401, detail="Reauthentication token already used")
    except HTTPException:
        raise
    except Exception as exc:
        if settings.is_production:
            raise HTTPException(status_code=503, detail="Deletion is temporarily unavailable") from exc
        if token_id in _used_reauth_tokens:
            raise HTTPException(status_code=401, detail="Reauthentication token already used")
        _used_reauth_tokens.add(token_id)

    profile = await db_load_profile(tenant_id) or {}
    user = await db_get_user_by_tenant(tenant_id)
    expected_name = (profile.get("company_name") or (user or {}).get("company_name") or "").strip()
    if not expected_name or req.confirmation.strip() != expected_name:
        raise HTTPException(status_code=400, detail="Company name confirmation does not match")

    from app.services.account_deletion import queue_tenant_deletion
    job = await queue_tenant_deletion(tenant_id, req.idempotency_key.strip() or str(uuid.uuid4()))
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=settings.CSRF_COOKIE_NAME, path="/")
    return {"status": "queued", "deletion_id": job["deletion_id"]}


@router.post("/deletion-requests", status_code=202)
async def request_tenant_deletion(
    req: DeletionRequest,
    response: Response,
    current_tenant: str = Depends(get_current_tenant),
):
    """Lock tenant immediately; durable worker performs the irreversible purge."""
    return await _queue_deletion_request(req, current_tenant, current_tenant, response)


@router.delete("/profile/{tenant_id}", status_code=202)
async def delete_tenant_account(
    tenant_id: str,
    response: Response,
    req: DeletionRequest | None = Body(default=None),
    current_tenant: str = Depends(get_current_tenant),
):
    """Backward-compatible route; destructive deletion requires reauthentication."""
    if req is None:
        raise HTTPException(status_code=428, detail="Reauthentication and confirmation are required")
    return await _queue_deletion_request(req, tenant_id, current_tenant, response)
