import asyncio
import hashlib
import json
import httpx
import pytest
from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.core.db import (
    db_load_users,
    db_save_users,
    db_load_profile,
    db_save_profile,
    db_set_tenant_status,
)
from app.services.webhook_queue import enqueue_webhook_event


class _TestClient:
    def __init__(self, app_instance):
        self._app = app_instance

    def _request(self, method, url, headers=None, json_data=None, cookies=None, content=None):
        async def _go():
            transport = httpx.ASGITransport(app=self._app, raise_app_exceptions=False)
            async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8080", cookies=cookies) as c:
                return await c.request(method, url, headers=headers, json=json_data, content=content)
        return asyncio.get_event_loop().run_until_complete(_go())

    def get(self, url, headers=None, cookies=None):
        return self._request("GET", url, headers=headers, cookies=cookies)

    def post(self, url, headers=None, json=None, cookies=None, content=None):
        return self._request("POST", url, headers=headers, json_data=json, cookies=cookies, content=content)


@pytest.fixture
def client():
    return _TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_data():
    async def _setup():
        test_users = [
            {
                "tenant_id": "tenant-alpha",
                "email": "alpha@example.com",
                "email_normalized": "alpha@example.com",
                "password_hash": "$2b$12$K8w1Vj.n94fS7bEszvV8qODW7b28J6fW8YpW4q3w9u7f8v1w2y3z4",
                "role": "admin",
                "status": "active",
                "session_version": 1,
            },
            {
                "tenant_id": "tenant-beta",
                "email": "beta@example.com",
                "email_normalized": "beta@example.com",
                "google_sub": "google-sub-beta-12345",
                "role": "admin",
                "status": "active",
                "session_version": 1,
            },
        ]
        await db_save_users(test_users)

        await db_save_profile("tenant-alpha", {
            "company_name": "Alpha Corp",
            "facebook_page_id": "page-alpha-999",
            "facebook_verified": True,
            "facebook_credential_fingerprint": hashlib.sha256(b"page-alpha-999:token123").hexdigest(),
            "line_bot_user_id": "Ubot_alpha_111",
            "line_verified": True,
            "line_credential_fingerprint": hashlib.sha256(b"tokenline123").hexdigest(),
        })
        await db_save_profile("tenant-beta", {
            "company_name": "Beta Corp",
        })

    asyncio.get_event_loop().run_until_complete(_setup())


def test_signup_creates_new_tenant_and_rejects_duplicate(client):
    # 1. Successful signup
    res = client.post(
        "/api/auth/signup",
        json={"email": "newuser@example.com", "password": "securepassword123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "newuser@example.com"
    assert "tenant_id" in data
    assert data["tenant_id"].startswith("tenant-")

    # 2. Duplicate signup with same email returns 409
    res_dup = client.post(
        "/api/auth/signup",
        json={"email": "newuser@example.com", "password": "anotherpassword"},
    )
    assert res_dup.status_code == 409
    detail_dup = res_dup.json()["detail"]
    assert "already registered" in detail_dup.lower() or "ถูกลงทะเบียนแล้ว" in detail_dup

    # 3. Duplicate signup with different casing / whitespace returns 409
    res_dup_case = client.post(
        "/api/auth/signup",
        json={"email": "  NEWUSER@example.COM  ", "password": "anotherpassword"},
    )
    assert res_dup_case.status_code == 409


def test_login_never_creates_unknown_accounts(client):
    # Unknown credentials return 401, not create an account!
    res = client.post(
        "/api/auth/login",
        json={"provider": "credentials", "email": "nonexistent@example.com", "password": "wrong"},
    )
    assert res.status_code == 401

    users = asyncio.get_event_loop().run_until_complete(db_load_users())
    assert not any(u["email"] == "nonexistent@example.com" for u in users)


def test_account_link_required_when_google_matches_password_user(client, monkeypatch):
    from app.routers import auth as auth_module

    async def mock_verify_google(token):
        return {
            "sub": "new-google-sub-for-alpha",
            "email": "alpha@example.com",
            "name": "Alpha Owner",
        }

    monkeypatch.setattr(auth_module, "verify_google_token", mock_verify_google)

    res = client.post(
        "/api/auth/login",
        json={"provider": "google", "token": "fake-google-token"},
    )
    assert res.status_code == 409
    assert res.json()["detail"] == "ACCOUNT_LINK_REQUIRED"


def test_x_tenant_context_guard_middleware(client):
    token = create_access_token("tenant-alpha", "alpha@example.com", session_version=1)
    csrf = "valid-csrf-token-123"
    cookies = {settings.SESSION_COOKIE_NAME: token, settings.CSRF_COOKIE_NAME: csrf}

    # 1. Matching X-Tenant-Context succeeds on POST
    res_ok = client.post(
        "/api/tenant/profile/tenant-alpha",
        json={"company_name": "Alpha Updated"},
        headers={"X-Tenant-Context": "tenant-alpha", settings.CSRF_HEADER_NAME: csrf},
        cookies=cookies,
    )
    assert res_ok.status_code == 200

    # 2. Mismatched X-Tenant-Context returns 409 SESSION_CONTEXT_CHANGED on POST
    res_mismatch = client.post(
        "/api/tenant/profile/tenant-alpha",
        json={"company_name": "Alpha Updated"},
        headers={"X-Tenant-Context": "tenant-beta", settings.CSRF_HEADER_NAME: csrf},
        cookies=cookies,
    )
    assert res_mismatch.status_code == 409
    assert res_mismatch.json()["detail"] == "SESSION_CONTEXT_CHANGED"


def test_channel_server_managed_flags_and_fingerprint_invalidation(client):
    token = create_access_token("tenant-alpha", "alpha@example.com", session_version=1)
    csrf = "valid-csrf-token-123"
    cookies = {settings.SESSION_COOKIE_NAME: token, settings.CSRF_COOKIE_NAME: csrf}

    # 1. Client cannot blindly set line_verified=True in save_profile
    client.post(
        "/api/tenant/profile/tenant-alpha",
        json={"company_name": "Alpha Corp", "line_verified": True},
        headers={"X-Tenant-Context": "tenant-alpha", settings.CSRF_HEADER_NAME: csrf},
        cookies=cookies,
    )

    # 2. Updating line_channel_access_token clears verification and fingerprint
    res = client.post(
        "/api/tenant/profile/tenant-alpha/settings",
        json={"line_channel_access_token": "brand_new_token"},
        headers={"X-Tenant-Context": "tenant-alpha", settings.CSRF_HEADER_NAME: csrf},
        cookies=cookies,
    )
    assert res.status_code == 200
    p_updated = asyncio.get_event_loop().run_until_complete(db_load_profile("tenant-alpha"))
    assert p_updated.get("line_verified") is False
    assert p_updated.get("line_credential_fingerprint") == ""
    assert p_updated.get("line_bot_user_id") == ""

    # 3. Claiming another tenant's Facebook Page ID returns 409
    token_beta = create_access_token("tenant-beta", "beta@example.com", session_version=1)
    res_conflict = client.post(
        "/api/tenant/profile/tenant-beta/settings",
        json={"facebook_page_id": "page-alpha-999"},
        headers={"X-Tenant-Context": "tenant-beta", settings.CSRF_HEADER_NAME: csrf},
        cookies={settings.SESSION_COOKIE_NAME: token_beta, settings.CSRF_COOKIE_NAME: csrf},
    )
    assert res_conflict.status_code == 409
    assert "already assigned" in res_conflict.json()["detail"].lower()


def test_webhook_suppression_for_locked_tenant(client):
    # Lock tenant-alpha
    asyncio.get_event_loop().run_until_complete(db_set_tenant_status("tenant-alpha", "locked"))

    # LINE webhook for tenant-alpha should be ignored
    res = client.post(
        "/api/webhooks/line/tenant-alpha",
        content=json.dumps({"events": []}),
        headers={"X-Line-Signature": "dummy"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ignored"

    # Webhook queue enqueue should fail closed for locked tenant
    enqueued = asyncio.get_event_loop().run_until_complete(
        enqueue_webhook_event("line", "tenant-alpha", "evt-123", {"text": "hello"})
    )
    assert enqueued is False


def test_link_google_flow_and_google_token_alias(client, monkeypatch):
    from app.routers import auth as auth_module

    async def mock_verify_google(token):
        return {
            "sub": "new-google-sub-alpha-999",
            "email": "alpha@example.com",
            "name": "Alpha Owner",
        }

    monkeypatch.setattr(auth_module, "verify_google_token", mock_verify_google)

    # 1. Login with Google for existing password account yields 409 with email payload
    res = client.post(
        "/api/auth/login",
        json={"provider": "google", "token": "fake-google-token"},
    )
    assert res.status_code == 409
    data = res.json()
    assert data["code"] == "ACCOUNT_LINK_REQUIRED"
    assert data["email"] == "alpha@example.com"

    # 2. Complete linking using google_token parameter as sent by frontend
    res_link = client.post(
        "/api/auth/link-google",
        json={
            "email": data["email"],
            "password": "valid_mock_pass",
            "google_token": "fake-google-token",
        },
    )
    # verify_password against test fixture hash will fail unless we mock or provide correct password
    # Let's test with mocked verify_password
    monkeypatch.setattr(auth_module, "verify_password", lambda p, h: True)

    res_link_ok = client.post(
        "/api/auth/link-google",
        json={
            "email": data["email"],
            "password": "correct_password",
            "google_token": "fake-google-token",
        },
    )
    assert res_link_ok.status_code == 200
    user_data = res_link_ok.json()
    assert user_data["tenant_id"] == "tenant-alpha"
    assert user_data["email"] == "alpha@example.com"


def test_settings_cannot_overwrite_server_managed_line_bot_user_id(client):
    token = create_access_token("tenant-alpha", "alpha@example.com", session_version=1)
    csrf = "valid-csrf-token-123"
    cookies = {settings.SESSION_COOKIE_NAME: token, settings.CSRF_COOKIE_NAME: csrf}

    # Attempt to overwrite line_bot_user_id via settings
    res = client.post(
        "/api/tenant/profile/tenant-alpha/settings",
        json={"line_bot_user_id": "malicious_injected_bot_id"},
        headers={"X-Tenant-Context": "tenant-alpha", settings.CSRF_HEADER_NAME: csrf},
        cookies=cookies,
    )
    assert res.status_code == 200
    p = asyncio.get_event_loop().run_until_complete(db_load_profile("tenant-alpha"))
    # In setup_test_data, line_bot_user_id was Ubot_alpha_111
    assert p.get("line_bot_user_id") == "Ubot_alpha_111"


def test_google_jwks_outage_returns_503(client, monkeypatch):
    from app.routers import auth as auth_module

    # Reset cache to force fetch
    auth_module._GOOGLE_KEYS["expires_at"] = 0.0

    import httpx
    import base64
    def mock_get(*args, **kwargs):
        raise httpx.ConnectTimeout("Google certs server timeout")

    monkeypatch.setattr(auth_module.settings, "GOOGLE_CLIENT_ID", "mock-client-id.apps.googleusercontent.com")
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    token = "eyJhbGciOiJSUzI1NiIsImtpZCI6InRlc3Qta2lkIn0.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.c2lnbmF0dXJl"

    res = client.post(
        "/api/auth/login",
        json={"provider": "google", "token": token},
    )
    assert res.status_code == 503
    assert "unavailable" in res.json()["detail"].lower()
