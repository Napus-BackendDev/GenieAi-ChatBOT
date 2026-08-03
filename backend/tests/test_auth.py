"""Tests for real JWT + bcrypt auth and server-side tenant authorization.

Network-free (Ponytail): we use FastAPI TestClient and only hit endpoints that
read local files or pure helpers — no OpenAI / Redis / LINE calls.

Covers:
  - hash_password / verify_password round-trip.
  - create_access_token + get_current_tenant round-trip.
  - missing / malformed / expired / bad-signature token -> 401.
  - a data endpoint returns 401 without a token, 200 with a valid token.
  - cross-tenant PATH access -> 403.
  - /api/auth/login returns an access_token (credentials sign-up).
"""
import asyncio
from datetime import datetime, timedelta, timezone

import httpx
import jwt
import pytest
from fastapi import HTTPException

from app.core import security
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_tenant,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def test_hash_and_verify_password():
    h = hash_password("s3cret-pw")
    assert h and h != "s3cret-pw"          # never stored in plaintext
    assert verify_password("s3cret-pw", h) is True
    assert verify_password("wrong", h) is False


def test_verify_password_handles_missing_or_malformed_hash():
    assert verify_password("anything", "") is False
    assert verify_password("anything", "not-a-bcrypt-hash") is False


# ---------------------------------------------------------------------------
# JWT create + verify round-trip
# ---------------------------------------------------------------------------

def test_token_roundtrip_returns_tenant():
    token = create_access_token("tenant-abc", "user@example.com")
    assert get_current_tenant(f"Bearer {token}") == "tenant-abc"
    # scheme is case-insensitive
    assert get_current_tenant(f"bearer {token}") == "tenant-abc"


def test_missing_header_is_401():
    with pytest.raises(HTTPException) as exc:
        get_current_tenant(None)
    assert exc.value.status_code == 401


@pytest.mark.parametrize("bad", ["", "Bearer", "Basic xyz", "Bearer   ", "justtoken"])
def test_malformed_header_is_401(bad):
    with pytest.raises(HTTPException) as exc:
        get_current_tenant(bad)
    assert exc.value.status_code == 401


def test_garbage_token_is_401():
    with pytest.raises(HTTPException) as exc:
        get_current_tenant("Bearer not.a.real.jwt")
    assert exc.value.status_code == 401


def test_bad_signature_is_401():
    # A structurally valid token signed with the wrong key must be rejected.
    forged = jwt.encode(
        {"sub": "tenant-x"},
        "the-wrong-key-with-at-least-32-bytes",
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        get_current_tenant(f"Bearer {forged}")
    assert exc.value.status_code == 401


def test_expired_token_is_401():
    now = datetime.now(timezone.utc)
    expired = jwt.encode(
        {"sub": "tenant-x", "iat": now - timedelta(days=2), "exp": now - timedelta(days=1)},
        security._SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        get_current_tenant(f"Bearer {expired}")
    assert exc.value.status_code == 401


def test_token_without_sub_is_401():
    now = datetime.now(timezone.utc)
    no_sub = jwt.encode(
        {"email": "a@b.com", "iat": now, "exp": now + timedelta(days=1)},
        security._SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        get_current_tenant(f"Bearer {no_sub}")
    assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# End-to-end through the app: 401 without token, 200 with token, 403 cross-tenant
# ---------------------------------------------------------------------------

# Starlette 0.36's bundled TestClient is incompatible with httpx 0.28 (it passes
# app= to httpx.Client, which was removed). We drive the ASGI app in-process via
# httpx.ASGITransport instead — same effect, no network, works on this stack.
class _AppClient:
    """Minimal sync wrapper around an in-process ASGI request."""

    def __init__(self, app):
        self._app = app

    def _request(self, method, url, headers=None, json=None):
        async def _go():
            transport = httpx.ASGITransport(app=self._app, raise_app_exceptions=False)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
                return await c.request(method, url, headers=headers, json=json)
        return asyncio.get_event_loop().run_until_complete(_go())

    def get(self, url, headers=None):
        return self._request("GET", url, headers=headers)

    def post(self, url, headers=None, json=None):
        return self._request("POST", url, headers=headers, json=json)


@pytest.fixture
def client():
    """In-process app client that never touches Redis/Mongo/network.

    We do NOT enter the lifespan context (no startup init runs), and every
    endpoint we exercise reads a local file or a monkeypatched loader only.
    """
    import app.main as main
    return _AppClient(main.app)


def _auth(tenant_id: str) -> dict:
    token = create_access_token(tenant_id, f"{tenant_id}@example.com")
    return {"Authorization": f"Bearer {token}"}


def test_profile_endpoint_requires_token(client):
    # No Authorization header -> 401 from get_current_tenant dependency.
    r = client.get("/api/tenant/profile/tenant-abc")
    assert r.status_code == 401


def test_profile_endpoint_ok_with_matching_token(client):
    # Valid token whose sub matches the path tenant -> 200 (reads a file, no
    # network). Missing profile file returns a default profile, still 200.
    r = client.get("/api/tenant/profile/tenant-abc", headers=_auth("tenant-abc"))
    assert r.status_code == 200
    body = r.json()
    # Secrets must never be exposed.
    assert "line_channel_access_token" not in body
    assert body["line_configured"] is False


def test_profile_cross_tenant_is_403(client):
    # Token for tenant-abc trying to read tenant-other's profile -> 403.
    r = client.get("/api/tenant/profile/tenant-other", headers=_auth("tenant-abc"))
    assert r.status_code == 403


def test_bookings_requires_token_then_ok(client, monkeypatch):
    # 401 without a token.
    assert client.get("/api/bookings").status_code == 401

    # With a token, the endpoint uses the token's tenant. Stub the loader so no
    # file/network is required and confirm 200 + tenant filtering.
    from app.routers import bookings as bookings_router
    monkeypatch.setattr(
        bookings_router, "_load_bookings",
        lambda: [
            {"booking_id": "b1", "tenant_id": "tenant-abc", "booking_datetime": "2026-01-01"},
            {"booking_id": "b2", "tenant_id": "tenant-other", "booking_datetime": "2026-01-02"},
        ],
    )
    r = client.get("/api/bookings", headers=_auth("tenant-abc"))
    assert r.status_code == 200
    ids = {b["booking_id"] for b in r.json()}
    assert ids == {"b1"}  # only the caller's tenant, never tenant-other


# ---------------------------------------------------------------------------
# /login must stay UNauthenticated and issue an access_token
# ---------------------------------------------------------------------------

def test_login_credentials_returns_access_token(client, monkeypatch, tmp_path):
    # Redirect users.json into tmp so we don't mutate the repo's data file.
    from app.routers import auth as auth_router
    users_file = tmp_path / "users.json"
    monkeypatch.setattr(auth_router, "USERS_FILE_PATH", str(users_file))

    # Fresh email + password -> new sign-up, must return a bearer token and
    # must NOT leak password_hash. No auth header: /login stays UNauthenticated.
    r = client.post("/api/auth/login", json={
        "provider": "credentials",
        "email": "brandnew@example.com",
        "password": "hunter2",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert "password_hash" not in body
    cookie = r.headers.get("set-cookie", "")
    assert "genieai_session=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie

    # The issued token must resolve back to the new tenant.
    assert get_current_tenant(f"Bearer {body['access_token']}") == body["tenant_id"]

    # Logging in again with the same password must succeed (verifies stored hash).
    r2 = client.post("/api/auth/login", json={
        "provider": "credentials",
        "email": "brandnew@example.com",
        "password": "hunter2",
    })
    assert r2.status_code == 200
    assert r2.json()["tenant_id"] == body["tenant_id"]

    # Wrong password -> 401.
    r3 = client.post("/api/auth/login", json={
        "provider": "credentials",
        "email": "brandnew@example.com",
        "password": "WRONG",
    })
    assert r3.status_code == 401
