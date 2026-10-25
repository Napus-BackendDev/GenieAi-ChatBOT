import os
import uuid
import logging
import hashlib
import httpx
import asyncio
import time
import json
import secrets
import jwt
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_reauth_token,
    decode_reauth_token,
    extract_request_token,
    get_current_tenant,
)
from app.core.db import (
    db_load_users,
    db_save_users,
    normalize_email,
    db_find_user,
    db_create_user,
    db_update_user_fields,
)
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])

# Keep the global file path string for test patching.
USERS_FILE_PATH = "data/users.json"

class LoginRequest(BaseModel):
    provider: str  # "google" or "credentials"
    email: str = ""
    phone: str = ""
    password: str = ""
    token: str = ""
    keep_logged_in: bool = True

class SignupRequest(BaseModel):
    provider: str = "credentials"  # "google" or "credentials"
    email: str = ""
    phone: str = ""
    password: str = ""
    token: str = ""
    keep_logged_in: bool = True

class LinkGoogleRequest(BaseModel):
    email: str
    password: str
    token: str = ""
    google_token: str = ""
    keep_logged_in: bool = True

class QuestionnaireRequest(BaseModel):
    tenant_id: str = ""  # ignored — server derives tenant_id from the auth token
    email: str
    phone: str
    company_name: str
    business_type: str


class ReauthenticateRequest(BaseModel):
    provider: str = "credentials"
    password: str = ""
    token: str = ""


async def _load_users_async() -> list[dict]:
    return await db_load_users()

async def _save_users_async(users: list[dict]) -> None:
    await db_save_users(users)

def _load_users() -> list[dict]:
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(db_load_users())

def _save_users(users: list[dict]) -> None:
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(db_save_users(users))

def _user_response(user: dict, is_new: bool) -> dict:
    """Build a login response for a credentials user.

    NEVER include password_hash. Always attach a signed JWT access token so the
    client can authenticate subsequent tenant-scoped requests.
    """
    tenant_id = user["tenant_id"]
    email = user.get("email", "")
    return {
        "tenant_id": tenant_id,
        "email": email,
        "email_normalized": user.get("email_normalized", normalize_email(email)),
        "contact_email": user.get("contact_email") or email,
        "phone": user.get("phone", ""),
        "company_name": user.get("company_name", ""),
        "business_type": user.get("business_type", ""),
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
        "is_new": is_new,
        "access_token": create_access_token(
            tenant_id, email, int(user.get("session_version") or 0)
        ),
        "token_type": "bearer",
    }


def _finalize_login(response: Response, data: dict, keep_logged_in: bool) -> dict:
    """Store the admin token in an HttpOnly cookie; optionally hide it from JS."""
    token = data["access_token"]
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.JWT_EXPIRE_DAYS * 86400 if keep_logged_in else None,
        httponly=True,
        secure=settings.is_production,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=secrets.token_urlsafe(32),
        max_age=86400,
        httponly=False,
        secure=settings.is_production,
        samesite=settings.SESSION_COOKIE_SAMESITE,
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    if not settings.EXPOSE_ACCESS_TOKEN:
        data.pop("access_token", None)
        data.pop("token_type", None)
    return data


async def _enforce_login_rate_limit(
    request: Request,
    account: str | None,
    *,
    include_ip: bool = True,
) -> None:
    from app.core.client_ip import get_client_ip
    from app.core.redis import get_redis
    from app.core.rate_limit import increment_with_expiry

    client_ip = get_client_ip(request)
    limits = []
    if include_ip:
        limits.append((f"auth:rate:ip:{client_ip}", 30))
    if account:
        account_hash = hashlib.sha256(account.lower().encode("utf-8")).hexdigest()
        limits.append((f"auth:rate:account:{account_hash}", 10))
    try:
        redis_client = get_redis()
        for key, limit in limits:
            count = await increment_with_expiry(redis_client, key, 300)
            if count > limit:
                raise HTTPException(
                    status_code=429,
                    detail="Too many login attempts. Please try again later.",
                    headers={"Retry-After": "300"},
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Login rate limiter unavailable: %s", exc)
        if settings.is_production:
            raise HTTPException(
                status_code=503,
                detail="Authentication is temporarily unavailable.",
            )

_GOOGLE_KEYS: dict = {"expires_at": 0.0, "keys": {}}


async def verify_google_token(token: str) -> dict | None:
    """Verify Google ID token signature and claims using Google's JWKS.

    The credential never travels in a query string and is not logged.
    """
    client_id = settings.GOOGLE_CLIENT_ID.strip()
    if not client_id or not token or len(token) > 8192:
        return None
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        if header.get("alg") != "RS256" or not kid:
            return None
        if _GOOGLE_KEYS["expires_at"] <= time.time() or kid not in _GOOGLE_KEYS["keys"]:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get("https://www.googleapis.com/oauth2/v3/certs", timeout=5.0)
                    response.raise_for_status()
                    data = response.json()
                _GOOGLE_KEYS["keys"] = {item["kid"]: item for item in data.get("keys", []) if item.get("kid")}
                _GOOGLE_KEYS["expires_at"] = time.time() + 3600
            except (httpx.RequestError, httpx.HTTPStatusError) as net_err:
                logger.error("Google JWKS retrieval failed: %s", net_err)
                raise HTTPException(
                    status_code=503,
                    detail="Google authentication service is temporarily unavailable",
                )
        key_data = _GOOGLE_KEYS["keys"].get(kid)
        if not key_data:
            return None
        key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"require": ["sub", "email", "aud", "iss", "exp", "iat"]},
        )
        if payload.get("email_verified") not in (True, "true", "True"):
            return None
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Google ID token verification failed: %s", type(exc).__name__)
        return None


@router.get("/providers")
async def auth_providers(response: Response):
    """Expose only public provider configuration; never expose provider secrets."""
    response.headers["Cache-Control"] = "no-store"
    client_id = settings.GOOGLE_CLIENT_ID.strip()
    return {"google": {"enabled": bool(client_id), "client_id": client_id}}


@router.get("/session")
async def current_session(
    response: Response,
    current_tenant: str = Depends(get_current_tenant),
):
    response.headers["Cache-Control"] = "no-store"
    user = await db_find_user(tenant_id=current_tenant)
    if not user or user.get("status", "active") != "active":
        raise HTTPException(status_code=401, detail="Session is no longer active")
    return _sanitized_user(user)


@router.post("/reauthenticate")
async def reauthenticate(
    req: ReauthenticateRequest,
    current_tenant: str = Depends(get_current_tenant),
):
    user = await db_find_user(tenant_id=current_tenant)
    if not user or user.get("status", "active") != "active":
        raise HTTPException(status_code=401, detail="Session is no longer active")

    provider = req.provider.strip().lower()
    verified = False
    if provider == "credentials":
        verified = verify_password(req.password, user.get("password_hash", ""))
    elif provider == "google":
        payload = await verify_google_token(req.token)
        google_sub = payload.get("sub") if payload else None
        verified = bool(
            payload
            and (
                (google_sub and user.get("google_sub") == google_sub)
                or normalize_email(payload.get("email")) == normalize_email(user.get("email"))
            )
        )
    if not verified:
        raise HTTPException(status_code=401, detail="Reauthentication failed")
    return {"reauth_token": create_reauth_token(current_tenant), "expires_in": 300}


@router.post("/login")
async def login(req: LoginRequest, response: Response, request: Request):
    """
    Handles logging in via mock Google, real Google OAuth, or standard credentials.
    Does NOT automatically create accounts when credentials or Google user are not found.
    """
    provider = req.provider.strip().lower()
    await _enforce_login_rate_limit(
        request,
        req.email if provider == "credentials" else None,
    )

    if provider == "google":
        is_mock = (not req.token) or req.token == "mock"
        if is_mock and not settings.ALLOW_MOCK_LOGIN:
            logger.warning("Refused tokenless/mock Google login (ALLOW_MOCK_LOGIN is off).")
            raise HTTPException(status_code=401, detail="Google authentication required.")

        email = "google_mock_user@example.com"
        name = "Asus Admin"
        picture = "/avatar.png"
        google_sub = "mock-google-sub"

        if not is_mock:
            payload = await verify_google_token(req.token)
            if not payload:
                raise HTTPException(status_code=400, detail="Google authentication failed (invalid or expired token)")
            email = payload.get("email", "")
            name = payload.get("name", "Google User")
            picture = payload.get("picture", "/avatar.png")
            google_sub = payload.get("sub", "")

        await _enforce_login_rate_limit(request, email, include_ip=False)

        # 1. Search by google_sub first
        user = await db_find_user(google_sub=google_sub)
        if user:
            if user.get("status", "active") != "active":
                raise HTTPException(status_code=403, detail="บัญชีนี้ถูกระงับการใช้งาน")
            await db_update_user_fields(user["tenant_id"], {"name": name, "picture": picture})
            user["name"] = name
            user["picture"] = picture
            return _finalize_login(
                response,
                _user_response(user, is_new=not bool(user.get("company_name"))),
                req.keep_logged_in,
            )

        # 2. Check if an existing credentials account has this email
        existing_by_email = await db_find_user(email=email)
        if existing_by_email:
            return JSONResponse(
                status_code=409,
                content={
                    "code": "ACCOUNT_LINK_REQUIRED",
                    "detail": "ACCOUNT_LINK_REQUIRED",
                    "email": email,
                },
            )

        # 3. Not registered -> login does not auto-create
        raise HTTPException(
            status_code=404,
            detail="ACCOUNT_NOT_FOUND",
        )

    elif provider == "credentials":
        email = normalize_email(req.email)
        password = req.password

        if not email:
            raise HTTPException(status_code=400, detail="กรุณากรอกอีเมล")
        if not password:
            raise HTTPException(status_code=400, detail="กรุณากรอกรหัสผ่าน")

        existing_user = await db_find_user(email=email)
        if not existing_user:
            raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")

        if existing_user.get("status", "active") != "active":
            raise HTTPException(status_code=403, detail="บัญชีนี้ถูกระงับการใช้งาน")

        stored_hash = existing_user.get("password_hash")
        if not stored_hash:
            logger.info("Password login refused for hash-less account")
            raise HTTPException(
                status_code=401,
                detail="บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาเข้าสู่ระบบด้วยวิธีเดิม (เช่น Google) หรือติดต่อผู้ดูแลระบบ",
            )
        if not verify_password(password, stored_hash):
            logger.info("Failed password login")
            raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")

        logger.info("Password login succeeded")
        return _finalize_login(
            response,
            _user_response(existing_user, is_new=not bool(existing_user.get("company_name"))),
            req.keep_logged_in,
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")


@router.post("/signup")
async def signup(req: SignupRequest, response: Response, request: Request):
    """Creates a new user account intentionally (separate from login)."""
    provider = req.provider.strip().lower()
    await _enforce_login_rate_limit(
        request,
        req.email if provider == "credentials" else None,
    )

    if provider == "credentials":
        email = normalize_email(req.email)
        phone = req.phone.strip()
        password = req.password

        if not email:
            raise HTTPException(status_code=400, detail="กรุณากรอกอีเมล")
        if not password:
            raise HTTPException(status_code=400, detail="กรุณากรอกรหัสผ่าน")
        if len(password) < 8:
            raise HTTPException(status_code=400, detail="รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")

        existing_user = await db_find_user(email=email)
        if existing_user:
            raise HTTPException(status_code=409, detail="อีเมลนี้ถูกลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ")

        new_tenant_id = f"tenant-{str(uuid.uuid4())[:8]}"
        new_user = {
            "tenant_id": new_tenant_id,
            "email": email,
            "email_normalized": email,
            "contact_email": email,
            "phone": phone,
            "company_name": "",
            "business_type": "",
            "password_hash": hash_password(password),
            "status": "active",
            "session_version": 0,
        }
        try:
            created = await db_create_user(new_user)
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc))
        logger.info("Created new user account (credentials)")
        return _finalize_login(
            response,
            _user_response(created, is_new=True),
            req.keep_logged_in,
        )

    elif provider == "google":
        is_mock = (not req.token) or req.token == "mock"
        if is_mock and not settings.ALLOW_MOCK_LOGIN:
            logger.warning("Refused tokenless/mock Google signup (ALLOW_MOCK_LOGIN is off).")
            raise HTTPException(status_code=401, detail="Google authentication required.")

        email = "google_mock_user@example.com"
        name = "Asus Admin"
        picture = "/avatar.png"
        google_sub = "mock-google-sub"

        if not is_mock:
            payload = await verify_google_token(req.token)
            if not payload:
                raise HTTPException(status_code=400, detail="Google authentication failed (invalid or expired token)")
            email = payload.get("email", "")
            name = payload.get("name", "Google User")
            picture = payload.get("picture", "/avatar.png")
            google_sub = payload.get("sub", "")

        await _enforce_login_rate_limit(request, email, include_ip=False)

        # Check existing by google_sub
        existing_sub = await db_find_user(google_sub=google_sub)
        if existing_sub:
            raise HTTPException(status_code=409, detail="บัญชี Google นี้ลงทะเบียนแล้ว กรุณาเข้าสู่ระบบ")

        # Check existing by email
        existing_email = await db_find_user(email=email)
        if existing_email:
            return JSONResponse(
                status_code=409,
                content={
                    "code": "ACCOUNT_LINK_REQUIRED",
                    "detail": "ACCOUNT_LINK_REQUIRED",
                    "email": email,
                },
            )

        new_tenant_id = f"tenant-google-{str(uuid.uuid4())[:8]}"
        new_user = {
            "tenant_id": new_tenant_id,
            "email": email,
            "email_normalized": normalize_email(email),
            "contact_email": email,
            "phone": "",
            "company_name": "",
            "business_type": "",
            "name": name,
            "picture": picture,
            "google_sub": google_sub,
            "status": "active",
            "session_version": 0,
        }
        try:
            created = await db_create_user(new_user)
        except Exception:
            # Race condition: another concurrent signup completed
            created = await db_find_user(google_sub=google_sub)
            if not created:
                raise HTTPException(status_code=409, detail="Account already registered")
        logger.info("Created new Google user account")
        return _finalize_login(
            response,
            _user_response(created, is_new=True),
            req.keep_logged_in,
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")


@router.post("/link-google")
async def link_google(req: LinkGoogleRequest, response: Response, request: Request):
    """Link Google identity to an existing password-authenticated account after verification."""
    email = normalize_email(req.email)
    token = (req.token or req.google_token or "").strip()
    if not email or not req.password or not token:
        raise HTTPException(status_code=400, detail="Missing required fields")

    user = await db_find_user(email=email)
    if not user:
        raise HTTPException(status_code=404, detail="ACCOUNT_NOT_FOUND")

    stored_hash = user.get("password_hash")
    if not stored_hash or not verify_password(req.password, stored_hash):
        raise HTTPException(status_code=401, detail="รหัสผ่านไม่ถูกต้อง")

    payload = await verify_google_token(token)
    if not payload:
        raise HTTPException(status_code=400, detail="Google token verification failed")
    if normalize_email(payload.get("email")) != email:
        raise HTTPException(status_code=400, detail="Google account email does not match")

    google_sub = payload.get("sub")
    if not google_sub:
        raise HTTPException(status_code=400, detail="Invalid Google token claims")

    other_owner = await db_find_user(google_sub=google_sub)
    if other_owner and other_owner.get("tenant_id") != user.get("tenant_id"):
        raise HTTPException(status_code=409, detail="Google identity already claimed by another account")

    await db_update_user_fields(user["tenant_id"], {"google_sub": google_sub})
    user["google_sub"] = google_sub
    return _finalize_login(
        response,
        _user_response(user, is_new=not bool(user.get("company_name"))),
        req.keep_logged_in,
    )


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    token = extract_request_token(
        request.headers.get("Authorization"),
        request.cookies.get(settings.SESSION_COOKIE_NAME),
    )
    if token:
        try:
            claims = decode_admin_token(token)
            if claims.get("jti"):
                from app.core.redis import get_redis
                ttl = max(60, int(claims["exp"] - datetime.now(timezone.utc).timestamp()))
                await get_redis().set(f"auth:revoked:{claims.get('sub')}:{claims['jti']}", "1", ex=ttl)
        except Exception as exc:
            if settings.is_production:
                raise HTTPException(status_code=503, detail="Logout is temporarily unavailable") from exc
            logger.warning("Could not revoke session token: %s", type(exc).__name__)
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        secure=settings.is_production,
        httponly=True,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )
    response.delete_cookie(key=settings.CSRF_COOKIE_NAME, path="/")


ALLOWED_USER_KEYS = {
    "tenant_id", "email", "email_normalized", "contact_email",
    "phone", "company_name", "business_type", "name", "picture",
    "status", "is_new",
}

def _sanitized_user(user: dict) -> dict:
    """Copy of a user record adhering to the response allowlist."""
    res = {k: user[k] for k in ALLOWED_USER_KEYS if k in user}
    if "tenant_id" not in res:
        res["tenant_id"] = user.get("tenant_id", "")
    return res


@router.post("/questionnaire")
async def save_questionnaire(
    req: QuestionnaireRequest,
    current_tenant: str = Depends(get_current_tenant),
):
    """
    Saves company details and business type for the AUTHENTICATED tenant.
    Does NOT overwrite the login email identity.
    """
    user = await db_find_user(tenant_id=current_tenant)
    if not user:
        raise HTTPException(status_code=401, detail="Authenticated user no longer exists")

    updates = {
        "company_name": req.company_name.strip(),
        "business_type": req.business_type.strip(),
        "contact_email": req.email.strip().lower(),
        "phone": req.phone.strip(),
    }
    if user.get("email") == "google_mock_user@example.com":
        updates["name"] = "Asus Admin"
        updates["picture"] = "/avatar.png"

    updated = await db_update_user_fields(current_tenant, updates)
    logger.info("Saved questionnaire for tenant %s", current_tenant)
    return {"status": "success", "user": _sanitized_user(updated or user)}
