"""Regression tests for the auth-hardening fixes (2026-07-05 post-auth sweep).

Lock in: no usable public fallback signing key, password required for credentials
login, no trust-on-first-use on hash-less accounts.
"""
import asyncio
from datetime import datetime, timezone, timedelta

import jwt
import pytest
import httpx
from fastapi import HTTPException

from app.core import security
from app.routers.auth import _load_users, _save_users
from app.main import app

# The exact public constant that used to be the shipped fallback secret.
OLD_PUBLIC_CONSTANT = "genieai-dev-only-insecure-secret-change-me"


def _loop():
    """Get-or-create the current event loop WITHOUT closing it — using asyncio.run()
    here would close/null the global loop and break other tests that rely on
    asyncio.get_event_loop() (they run in the same session)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def _post_login(payload: dict):
    async def go():
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            return await c.post("/api/auth/login", json=payload)
    return _loop().run_until_complete(go())


def test_forged_token_with_old_public_constant_is_rejected():
    """A token signed with the removed public constant must NOT authenticate."""
    now = datetime.now(timezone.utc)
    forged = jwt.encode(
        {"sub": "victim-tenant", "email": "a@b.c", "iat": now, "exp": now + timedelta(days=1)},
        OLD_PUBLIC_CONSTANT,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as ei:
        security.get_current_tenant(authorization=f"Bearer {forged}")
    assert ei.value.status_code == 401


def test_resolved_secret_is_not_the_public_constant():
    assert security._SECRET != OLD_PUBLIC_CONSTANT
    assert len(security._SECRET) >= 32


def test_real_token_roundtrips():
    tok = security.create_access_token("t1", "a@b.c")
    assert security.get_current_tenant(authorization=f"Bearer {tok}") == "t1"


def test_credentials_login_requires_password():
    r = _post_login({"provider": "credentials", "email": "nopass@test.com"})
    assert r.status_code == 400


def test_credentials_login_email_phone_only_is_rejected():
    # The old passwordless email+phone path must be gone.
    r = _post_login({"provider": "credentials", "email": "eponly@test.com", "phone": "0812345678"})
    assert r.status_code == 400


def test_hashless_account_password_login_refused_no_tofu():
    """A legacy hash-less account must NOT be claimable by a password (no TOFU)."""
    email = "legacy-hashless@test.com"
    base = [u for u in _load_users() if u.get("email") != email]
    _save_users(base + [{"tenant_id": "legacy-xyz", "email": email, "phone": "", "company_name": "X"}])
    try:
        r = _post_login({"provider": "credentials", "email": email, "password": "whatever"})
        assert r.status_code == 401
        # and no password_hash was silently set on the account
        u = next(u for u in _load_users() if u.get("email") == email)
        assert "password_hash" not in u
    finally:
        _save_users([u for u in _load_users() if u.get("email") != email])


def test_signup_then_login_password_works_and_wrong_fails():
    email = "freshsignup@test.com"
    _save_users([u for u in _load_users() if u.get("email") != email])
    try:
        r = _post_login({"provider": "credentials", "email": email, "password": "goodpass1"})
        assert r.status_code == 200 and r.json().get("access_token")
        assert _post_login({"provider": "credentials", "email": email, "password": "goodpass1"}).status_code == 200
        assert _post_login({"provider": "credentials", "email": email, "password": "WRONG"}).status_code == 401
    finally:
        _save_users([u for u in _load_users() if u.get("email") != email])
