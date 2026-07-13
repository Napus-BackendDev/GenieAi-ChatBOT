"""Authentication & authorization primitives for GenieAI.

Real auth replacing the old mock email+phone matching:
- Passwords hashed with bcrypt (never stored/logged in plaintext).
- Short-lived JWT access tokens (HS256), secret from settings.JWT_SECRET (.env).
- FastAPI dependencies that resolve the caller's tenant_id from the *verified*
  token so tenant-mutating endpoints can never trust a client-supplied id.

Ponytail: use `bcrypt` + `PyJWT` directly — never hand-roll crypto.
"""
import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# Path for a per-install auto-generated secret (used only when JWT_SECRET is unset).
_SECRET_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", ".jwt_secret"
)


def _resolve_secret() -> str:
    """Return the JWT signing secret.

    NEVER ship a usable hardcoded fallback (that would let anyone with repo access
    forge tokens for any tenant). Precedence:
      1. settings.JWT_SECRET (from .env) — required for production / multi-instance.
      2. A per-install random secret persisted to data/.jwt_secret (gitignored) so
         local runs are zero-config, unique, and survive restarts.
      3. A process-ephemeral random key as a last resort (tokens won't outlive a
         restart, but it is still unguessable — never the source constant).
    """
    if settings.JWT_SECRET:
        return settings.JWT_SECRET
    try:
        if os.path.exists(_SECRET_FILE):
            with open(_SECRET_FILE, "r", encoding="utf-8") as f:
                existing = f.read().strip()
            if len(existing) >= 32:
                return existing
        os.makedirs(os.path.dirname(_SECRET_FILE), exist_ok=True)
        generated = secrets.token_urlsafe(48)
        with open(_SECRET_FILE, "w", encoding="utf-8") as f:
            f.write(generated)
        logger.warning(
            "JWT_SECRET not set — generated a unique per-install secret at "
            "data/.jwt_secret. Set JWT_SECRET in .env for production/multi-instance."
        )
        return generated
    except OSError:
        logger.error(
            "Could not persist an auto JWT secret; using a process-ephemeral key "
            "(tokens reset on restart). Set JWT_SECRET in .env."
        )
        return secrets.token_urlsafe(48)


_SECRET = _resolve_secret()


# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------

def hash_password(pw: str) -> str:
    """Hash a plaintext password with bcrypt; returns a utf-8 string to store."""
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    """Constant-time check of a plaintext password against a stored bcrypt hash."""
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/invalid stored hash -> treat as a failed verification.
        return False


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------

def create_access_token(tenant_id: str, email: str) -> str:
    """Issue a signed JWT whose `sub` claim is the caller's tenant_id."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": tenant_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, _SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_tenant(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency: resolve tenant_id from a verified Bearer token.

    Expects `Authorization: Bearer <token>`. Raises 401 on a missing/malformed
    header, wrong scheme, or a token that fails signature/expiry verification.
    Returns the `sub` claim (the tenant_id).
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = parts[1].strip()
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    tenant_id = payload.get("sub")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return tenant_id


def require_tenant(tenant_id: str, current_tenant: str = Depends(get_current_tenant)) -> str:
    """Assert a path/query tenant_id matches the token's tenant; else 403.

    Use on endpoints that take tenant_id in the path/query so a caller can only
    act on their own tenant.
    """
    if tenant_id != current_tenant:
        raise HTTPException(status_code=403, detail="Forbidden: tenant mismatch")
    return tenant_id
