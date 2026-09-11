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

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_reauth_token,
    decode_reauth_token,
    extract_request_token,
    get_current_tenant,
)
from app.core.db import db_load_users, db_save_users
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
        "phone": user.get("phone", ""),
        "company_name": user.get("company_name", ""),
        "business_type": user.get("business_type", ""),
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
            async with httpx.AsyncClient() as client:
                response = await client.get("https://www.googleapis.com/oauth2/v3/certs", timeout=5.0)
                response.raise_for_status()
                data = response.json()
            _GOOGLE_KEYS["keys"] = {item["kid"]: item for item in data.get("keys", []) if item.get("kid")}
            _GOOGLE_KEYS["expires_at"] = time.time() + 3600
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
async def current_session(current_tenant: str = Depends(get_current_tenant)):
    user = next(
        (item for item in await _load_users_async() if item.get("tenant_id") == current_tenant),
        None,
    )
    if not user or user.get("status", "active") != "active":
        raise HTTPException(status_code=401, detail="Session is no longer active")
    return _sanitized_user(user)


@router.post("/reauthenticate")
async def reauthenticate(
    req: ReauthenticateRequest,
    current_tenant: str = Depends(get_current_tenant),
):
    users = await _load_users_async()
    user = next((item for item in users if item.get("tenant_id") == current_tenant), None)
    if not user or user.get("status", "active") != "active":
        raise HTTPException(status_code=401, detail="Session is no longer active")

    provider = req.provider.strip().lower()
    verified = False
    if provider == "credentials":
        verified = verify_password(req.password, user.get("password_hash", ""))
    elif provider == "google":
        payload = await verify_google_token(req.token)
        verified = bool(payload and payload.get("email", "").lower() == user.get("email", "").lower())
    if not verified:
        raise HTTPException(status_code=401, detail="Reauthentication failed")
    return {"reauth_token": create_reauth_token(current_tenant), "expires_in": 300}

@router.post("/login")
async def login(req: LoginRequest, response: Response, request: Request):
    """
    Handles logging in via mock Google, real Google OAuth, or standard credentials (email + phone).
    """
    provider = req.provider.strip().lower()
    await _enforce_login_rate_limit(
        request,
        req.email if provider == "credentials" else None,
    )
    
    if provider == "google":
        from app.core.config import settings

        # Real Google token is REQUIRED. The tokenless "mock" account is a dev-only
        # backdoor (anyone could get a valid JWT for the shared mock tenant) — it is
        # refused unless ALLOW_MOCK_LOGIN is explicitly enabled in the environment.
        is_mock = (not req.token) or req.token == "mock"
        if is_mock and not settings.ALLOW_MOCK_LOGIN:
            logger.warning("Refused tokenless/mock Google login (ALLOW_MOCK_LOGIN is off).")
            raise HTTPException(status_code=401, detail="Google authentication required.")

        email = "google_mock_user@example.com"
        phone = "080-000-0000"
        name = "Asus Admin"
        picture = "/avatar.png"

        # If a real token is provided, verify it instead of using mock account
        if not is_mock:
            payload = await verify_google_token(req.token)
            if not payload:
                raise HTTPException(status_code=400, detail="Google authentication failed (invalid or expired token)")
            email = payload.get("email")
            name = payload.get("name", "Google User")
            picture = payload.get("picture", "/avatar.png")
            phone = "" # Google OAuth does not provide phone number by default

        await _enforce_login_rate_limit(request, email, include_ip=False)

        users = await _load_users_async()
        existing_user = next((u for u in users if u.get("email") == email), None)
        
        if existing_user:
            if existing_user.get("status", "active") != "active":
                raise HTTPException(status_code=403, detail="บัญชีนี้ถูกระงับการใช้งาน")
            logger.info("Google user login succeeded")
            existing_user["name"] = name
            existing_user["picture"] = picture
            await _save_users_async(users)
            return _finalize_login(response, {
                "tenant_id": existing_user["tenant_id"],
                "email": existing_user["email"],
                "phone": existing_user.get("phone", ""),
                "company_name": existing_user.get("company_name", ""),
                "business_type": existing_user.get("business_type", ""),
                "name": existing_user.get("name", ""),
                "picture": existing_user.get("picture", ""),
                "is_new": not bool(existing_user.get("company_name")),
                "access_token": create_access_token(
                    existing_user["tenant_id"],
                    existing_user["email"],
                    int(existing_user.get("session_version") or 0),
                ),
                "token_type": "bearer",
            }, req.keep_logged_in)
        else:
            # Create a new Google user
            new_tenant_id = f"tenant-google-{str(uuid.uuid4())[:8]}"
            new_user = {
                "tenant_id": new_tenant_id,
                "email": email,
                "phone": phone,
                "company_name": "",
                "business_type": "",
                "name": name,
                "picture": picture,
                "status": "active",
                "session_version": 0,
            }
            users.append(new_user)
            await _save_users_async(users)
            logger.info("Created new Google user")
            return _finalize_login(response, {
                "tenant_id": new_tenant_id,
                "email": email,
                "phone": phone,
                "company_name": "",
                "business_type": "",
                "name": name,
                "picture": picture,
                "is_new": True,
                "access_token": create_access_token(new_tenant_id, email, 0),
                "token_type": "bearer",
            }, req.keep_logged_in)
                
    elif provider == "credentials":
        email = req.email.strip().lower()
        phone = req.phone.strip()
        password = req.password  # do NOT strip — preserve exact password bytes

        if not email:
            raise HTTPException(status_code=400, detail="กรุณากรอกอีเมล")
        if not password:
            raise HTTPException(status_code=400, detail="กรุณากรอกรหัสผ่าน")

        users = await _load_users_async()
        existing_user = next((u for u in users if u.get("email") == email), None)

        if existing_user:
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

        # New signup
        new_tenant_id = f"tenant-{str(uuid.uuid4())[:8]}"
        new_user = {
            "tenant_id": new_tenant_id,
            "email": email,
            "phone": phone,
            "company_name": "",
            "business_type": "",
            "password_hash": hash_password(password),
            "status": "active",
            "session_version": 0,
        }
        users.append(new_user)
        await _save_users_async(users)
        logger.info("Created new user account (password)")
        return _finalize_login(
            response,
            _user_response(new_user, is_new=True),
            req.keep_logged_in,
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")


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
            logger.warning("Could not revoke local session: %s", type(exc).__name__)
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        secure=settings.is_production,
        httponly=True,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )
    response.delete_cookie(key=settings.CSRF_COOKIE_NAME, path="/")

def _sanitized_user(user: dict) -> dict:
    """Copy of a user record without the secret password_hash for API responses."""
    return {k: v for k, v in user.items() if k != "password_hash"}

@router.post("/questionnaire")
async def save_questionnaire(
    req: QuestionnaireRequest,
    current_tenant: str = Depends(get_current_tenant),
):
    """
    Saves company details and business type for the AUTHENTICATED tenant.
    """
    users = await _load_users_async()
    user_idx = next((i for i, u in enumerate(users) if u.get("tenant_id") == current_tenant), None)

    if user_idx is not None:
        users[user_idx]["company_name"] = req.company_name.strip()
        users[user_idx]["business_type"] = req.business_type.strip()
        users[user_idx]["email"] = req.email.strip().lower()
        users[user_idx]["phone"] = req.phone.strip()
        if users[user_idx].get("email") == "google_mock_user@example.com":
            users[user_idx]["name"] = "Asus Admin"
            users[user_idx]["picture"] = "/avatar.png"
        await _save_users_async(users)
        logger.info("Saved questionnaire for tenant %s", current_tenant)
        return {"status": "success", "user": _sanitized_user(users[user_idx])}
    else:
        # A valid JWT must always resolve to an authoritative user record.
        # Creating one from client-supplied questionnaire fields would turn a
        # stale/forged token into a new account and bypass session revocation.
        raise HTTPException(status_code=401, detail="Authenticated user no longer exists")
