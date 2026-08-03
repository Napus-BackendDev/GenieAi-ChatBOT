import os
import re
import asyncio
import logging
import threading
import uuid
import httpx
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from app.core.config import settings
from app.core.security import create_webchat_token, require_tenant, get_current_tenant
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
    name: str
    price: str
    duration: int = 30  # duration in minutes

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

class WebchatSettings(BaseModel):
    enabled: bool = True
    theme_color: str = "#2B6CB0"
    welcome_message: str = "สวัสดีค่ะ! ยินดีต้อนรับสู่บริการผู้ช่วย AI ของเรา มีอะไรให้ช่วยวันนี้คะ?"
    token_version: int = Field(default=1, ge=1)

class AISettings(BaseModel):
    model_name: str = "gpt-4o-mini"
    temperature: float = 0.2
    cag_token_threshold: int = 15000
    # LINE reply pacing: 'slow' (AIS-like human typing, default) | 'normal' | 'off'.
    humanize_mode: str = "slow"

class BookingSettings(BaseModel):
    conflict_window_mins: int = 30
    min_lead_time_hours: int = 2

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
    # The Messenger Page ID this tenant owns — used to route incoming Facebook
    # webhook events (entry.id) to the correct tenant instead of a global default.
    facebook_page_id: str = ""
    webchat_settings: WebchatSettings = WebchatSettings()
    ai_settings: AISettings = AISettings()
    booking_settings: BookingSettings = BookingSettings()
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
    line_configured = bool(str(data.get("line_channel_access_token") or "").strip() and str(data.get("line_channel_secret") or "").strip())
    facebook_configured = bool(str(data.get("facebook_page_access_token") or "").strip())

    # Strip secrets before returning.
    for field in SECRET_FIELDS:
        data.pop(field, None)

    data["line_configured"] = line_configured
    data["facebook_configured"] = facebook_configured
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

        # Merge explicitly set fields from incoming request into existing_data.
        # For the four secret fields, an empty/absent value means 'unchanged' —
        # only overwrite when a non-empty value is provided. This is critical
        # because GET no longer returns secrets, so the SettingsPage POSTs ''
        # for them and that must NOT wipe the stored token/secret.
        for field in TenantProfile.model_fields.keys():
            if field not in explicit_fields:
                continue
            value = profile_dict[field]
            if field in SECRET_FIELDS and not str(value or "").strip():
                # Preserve existing secret; empty incoming value = unchanged.
                logger.info(f"Preserving existing secret field '{field}' (empty incoming value).")
                continue
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
        
    promo_images_dir = os.path.join(
        settings.STATIC_IMAGES_PATH,
        tenant_id,
        "promotions",
    )
    os.makedirs(promo_images_dir, exist_ok=True)
    
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = os.path.join(promo_images_dir, unique_filename)
    
    total_bytes = 0
    header = b""
    try:
        with open(target_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > settings.MAX_IMAGE_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Image exceeds the upload size limit.",
                    )
                if len(header) < 12:
                    header = (header + chunk)[:12]
                await asyncio.to_thread(buffer.write, chunk)
        detected_ext = _detect_image_extension(header)
        normalized_ext = ".jpg" if ext == ".jpeg" else ext
        if detected_ext != normalized_ext:
            raise HTTPException(
                status_code=400,
                detail="Image content does not match its filename.",
            )
    except HTTPException:
        if os.path.exists(target_path):
            await asyncio.to_thread(os.remove, target_path)
        raise
    except Exception as e:
        logger.error(f"Failed to save uploaded image: {e}")
        if os.path.exists(target_path):
            await asyncio.to_thread(os.remove, target_path)
        raise HTTPException(status_code=500, detail="Failed to save uploaded image.")
        
    static_url = f"/static/images/{tenant_id}/promotions/{unique_filename}"
    return {"status": "success", "image_url": static_url}


class VerifyLineRequest(BaseModel):
    access_token: str = ""


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
        await _save_profile_field(tenant_id, "line_verified", False)
        return {"valid": False, "error": "ยังไม่ได้ใส่ Channel Access Token"}

    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(LINE_BOT_INFO_URL, headers=headers, timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            await _save_profile_field(tenant_id, "line_verified", True)
            return {
                "valid": True,
                "bot_name": data.get("displayName", ""),
                "picture_url": data.get("pictureUrl") or "",
            }
        logger.info(f"LINE verify failed for tenant {tenant_id}: HTTP {response.status_code}")
    except Exception as e:
        logger.warning(f"LINE verify error for tenant {tenant_id}: {e}")

    await _save_profile_field(tenant_id, "line_verified", False)
    return {"valid": False, "error": "โทเคนไม่ถูกต้องหรือหมดอายุ"}


async def _save_profile_field(tenant_id: str, field_name: str, field_value) -> None:
    # Load existing profile
    raw = await db_load_profile(tenant_id) or {}
    
    # Update field
    raw[field_name] = field_value
    
    # Save back
    await db_save_profile(tenant_id, raw)
    
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
    line_verified: bool
    line_configured: bool
    facebook_configured: bool
    facebook_page_id: str
    webchat_config: WebchatConfigResponse


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
        "line_channel_access_token", "line_channel_secret", "line_verified",
        "facebook_page_access_token", "facebook_verify_token", "facebook_page_id"
    ]
    res = {k: data.get(k) for k in settings_keys}
    
    res["line_configured"] = bool(str(res.get("line_channel_access_token") or "").strip() and str(res.get("line_channel_secret") or "").strip())
    res["facebook_configured"] = bool(str(res.get("facebook_page_access_token") or "").strip())
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
    
    for field in SettingsUpdateRequest.model_fields.keys():
        if field not in explicit_fields:
            continue
        val = body_dict[field]
        if field in SECRET_FIELDS and not str(val or "").strip():
            continue
        raw[field] = val
        if field == "line_channel_access_token":
            raw["line_verified"] = False
        
    await db_save_profile(tenant_id, raw)
    
    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        cache_key = f"tenant_cag_profile:{tenant_id}"
        await redis_client.delete(cache_key)
    except Exception:
        pass
        
    return {"status": "success", "message": "Settings saved successfully."}


@router.delete("/profile/{tenant_id}")
async def delete_tenant_account(tenant_id: str, current_tenant: str = Depends(get_current_tenant)):
    """
    Completely deletes/wipes all data associated with this tenant, including MongoDB/JSON profiles,
    documents metadata, bookings, static uploaded images, and ChromaDB vector chunks.
    """
    _enforce_tenant(tenant_id, current_tenant)
    _validate_tenant_id(tenant_id)
    
    import shutil
    import os
    from app.core.db import db_delete_tenant_data
    from app.core.redis import get_redis
    from app.services.rag import get_chroma_client, CHROMA_COLLECTION_NAME
    
    try:
        # Delete authoritative records first. If MongoDB fails, leave derived
        # vector/image data intact and report failure instead of a partial wipe.
        await db_delete_tenant_data(tenant_id)

        # 1. Delete ChromaDB vector embeddings
        try:
            client = get_chroma_client()
            collection = client.get_or_create_collection(name=CHROMA_COLLECTION_NAME)
            collection.delete(where={"tenant_id": tenant_id})
            logger.info(f"Deleted all ChromaDB chunks for tenant '{tenant_id}'")
        except Exception as e:
            logger.error(f"Failed to delete ChromaDB collection for tenant '{tenant_id}': {e}")
            
        # 2. Delete static files / uploaded images
        static_dir = os.path.join(settings.STATIC_IMAGES_PATH, tenant_id)
        if os.path.exists(static_dir):
            try:
                shutil.rmtree(static_dir)
                logger.info(f"Deleted static images directory for tenant {tenant_id}")
            except Exception as e:
                logger.error(f"Failed to delete static images directory {static_dir}: {e}")
                
        # 3. Delete Redis cache keys (cag context, histories)
        try:
            redis_client = get_redis()
            # Clear profile cache
            await redis_client.delete(f"tenant_cag_profile:{tenant_id}")
            
            # Clear chat histories
            async for key in redis_client.scan_iter(match=f"chat_history:{tenant_id}:*"):
                await redis_client.delete(key)
                
            # Clear unread badges
            async for key in redis_client.scan_iter(match=f"unread:{tenant_id}:*"):
                await redis_client.delete(key)
                
            # Clear human intervention flags
            async for key in redis_client.scan_iter(match=f"human_intervention:{tenant_id}:*"):
                await redis_client.delete(key)
                
            logger.info(f"Cleared all Redis cache states for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Failed to clear Redis keys for tenant {tenant_id}: {e}")
            
        return {"status": "success", "message": "Account deleted successfully."}
        
    except Exception as e:
        logger.error(f"Failed to delete account {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account.")
