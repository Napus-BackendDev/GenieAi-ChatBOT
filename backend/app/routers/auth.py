import os
import uuid
import logging
import httpx
import asyncio
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_tenant,
)
from app.core.db import db_load_users, db_save_users

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

class QuestionnaireRequest(BaseModel):
    tenant_id: str = ""  # ignored — server derives tenant_id from the auth token
    email: str
    phone: str
    company_name: str
    business_type: str

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
        "access_token": create_access_token(tenant_id, email),
        "token_type": "bearer",
    }

async def verify_google_token(token: str) -> dict | None:
    """
    Verifies a Google ID token (JWT) using Google's tokeninfo API.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={token}",
                timeout=5.0
            )
            if response.status_code == 200:
                payload = response.json()
                # settings loads .env via pydantic (os.getenv can't see env_file values)
                from app.core.config import settings
                google_client_id = settings.GOOGLE_CLIENT_ID or os.getenv("GOOGLE_CLIENT_ID")
                if not google_client_id:
                    logger.error("GOOGLE_CLIENT_ID not configured — refusing Google login.")
                    return None
                if payload.get("aud") != google_client_id:
                    logger.warning(f"Google token aud mismatch, rejecting: {payload.get('aud')}")
                    return None
                return payload
            else:
                logger.error(f"Google tokeninfo API returned status {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Error verifying Google token: {e}")
    return None

@router.post("/login")
async def login(req: LoginRequest):
    """
    Handles logging in via mock Google, real Google OAuth, or standard credentials (email + phone).
    """
    provider = req.provider.strip().lower()
    
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
            
        users = await _load_users_async()
        existing_user = next((u for u in users if u.get("email") == email), None)
        
        if existing_user:
            logger.info(f"Google user logged in: {email}")
            existing_user["name"] = name
            existing_user["picture"] = picture
            await _save_users_async(users)
            return {
                "tenant_id": existing_user["tenant_id"],
                "email": existing_user["email"],
                "phone": existing_user.get("phone", ""),
                "company_name": existing_user.get("company_name", ""),
                "business_type": existing_user.get("business_type", ""),
                "name": existing_user.get("name", ""),
                "picture": existing_user.get("picture", ""),
                "is_new": not bool(existing_user.get("company_name")),
                "access_token": create_access_token(existing_user["tenant_id"], existing_user["email"]),
                "token_type": "bearer",
            }
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
                "picture": picture
            }
            users.append(new_user)
            await _save_users_async(users)
            logger.info(f"Created new Google user: {email}")
            return {
                "tenant_id": new_tenant_id,
                "email": email,
                "phone": phone,
                "company_name": "",
                "business_type": "",
                "name": name,
                "picture": picture,
                "is_new": True,
                "access_token": create_access_token(new_tenant_id, email),
                "token_type": "bearer",
            }
                
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
            stored_hash = existing_user.get("password_hash")
            if not stored_hash:
                logger.info(f"Password login refused for hash-less account: {email}")
                raise HTTPException(
                    status_code=401,
                    detail="บัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน กรุณาเข้าสู่ระบบด้วยวิธีเดิม (เช่น Google) หรือติดต่อผู้ดูแลระบบ",
                )
            if not verify_password(password, stored_hash):
                logger.info(f"Failed password login for: {email}")
                raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
            logger.info(f"User logged in with password: {email}")
            return _user_response(existing_user, is_new=not bool(existing_user.get("company_name")))

        # New signup
        new_tenant_id = f"tenant-{str(uuid.uuid4())[:8]}"
        new_user = {
            "tenant_id": new_tenant_id,
            "email": email,
            "phone": phone,
            "company_name": "",
            "business_type": "",
            "password_hash": hash_password(password),
        }
        users.append(new_user)
        await _save_users_async(users)
        logger.info(f"Created new user account (password) for: {email}")
        return _user_response(new_user, is_new=True)
    else:
        raise HTTPException(status_code=400, detail="Invalid provider")

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
        logger.info(f"Saved questionnaire for tenant {current_tenant}: {req.company_name}")
        return {"status": "success", "user": _sanitized_user(users[user_idx])}
    else:
        # If not found, create a record for the token's tenant.
        new_user = {
            "tenant_id": current_tenant,
            "email": req.email.strip().lower(),
            "phone": req.phone.strip(),
            "company_name": req.company_name.strip(),
            "business_type": req.business_type.strip()
        }
        if req.email.strip().lower() == "google_mock_user@example.com":
            new_user["name"] = "Asus Admin"
            new_user["picture"] = "/avatar.png"
        users.append(new_user)
        await _save_users_async(users)
        logger.info(f"Created and saved new user from questionnaire: {current_tenant}")
        return {"status": "success", "user": _sanitized_user(new_user)}
