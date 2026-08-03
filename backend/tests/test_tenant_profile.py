"""Wave B1 contract tests for app/routers/tenant.py.

All network-free and deterministic (Ponytail):
- get_profile / save_profile are plain async functions -> call directly via asyncio.
- LINE HTTP is faked by monkeypatching tenant.httpx.AsyncClient; the real
  api.line.me endpoint is NEVER hit.
- Profile files are redirected into tmp_path by monkeypatching
  tenant._get_profile_path, so no repo data/ file is touched.

Covers:
  (a) GET returns NO secret fields, includes line_configured.
  (b) POST with an empty-string secret does NOT wipe a stored token.
  (c) verify-line: 200 -> {valid:True, bot_name}; 401 -> {valid:False}.
  (d) invalid tenant_id ('../x') -> HTTP 400.
"""
import json
import asyncio
import pytest
from fastapi import HTTPException

from app.routers import tenant
from app.routers.tenant import TenantProfile, VerifyLineRequest, SECRET_FIELDS


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def profile_path(monkeypatch, tmp_path):
    """Redirect all profile file I/O for tenant 't1' into tmp_path."""
    path = tmp_path / "tenant_profile_t1.json"
    monkeypatch.setattr(tenant, "_get_profile_path", lambda tid: str(path))
    # Neutralise the Redis cache-invalidation in save_profile so no network is hit.
    async def _fake_delete(*a, **k):
        return 0

    class _FakeRedis:
        delete = staticmethod(_fake_delete)

    import app.core.redis as core_redis
    monkeypatch.setattr(core_redis, "get_redis", lambda: _FakeRedis())
    return path


# ---------------------------------------------------------------------------
# (a) GET strips secrets and exposes line_configured
# ---------------------------------------------------------------------------

def test_get_profile_hides_secrets_and_flags_line_configured(profile_path):
    profile_path.write_text(json.dumps({
        "company_name": "Acme",
        "line_channel_access_token": "SECRET_LINE_TOKEN",
        "line_channel_secret": "SECRET_LINE_SECRET",
        "facebook_page_access_token": "",
    }), encoding="utf-8")

    data = _run(tenant.get_profile("t1"))

    # No secret field may appear in the response.
    for field in SECRET_FIELDS:
        assert field not in data, f"secret field {field} leaked in GET response"
    # The raw token value must not be present anywhere in the serialised payload.
    assert "SECRET_LINE_TOKEN" not in json.dumps(data)

    assert data["line_configured"] is True          # token present -> True
    assert data["facebook_configured"] is False      # empty token -> False
    assert data["company_name"] == "Acme"


def test_get_profile_missing_file_returns_defaults_without_secrets(profile_path):
    # No file written -> default empty profile, still no secrets, line not configured.
    data = _run(tenant.get_profile("t1"))
    for field in SECRET_FIELDS:
        assert field not in data
    assert data["line_configured"] is False
    assert data["facebook_configured"] is False


def test_settings_preserve_facebook_mapping_and_webchat_token_version(profile_path):
    profile_path.write_text(
        json.dumps(
            {
                "facebook_page_id": "page-123",
                "webchat_settings": {
                    "enabled": True,
                    "theme_color": "#123456",
                    "welcome_message": "Hello",
                    "token_version": 7,
                },
            }
        ),
        encoding="utf-8",
    )

    result = _run(tenant.get_settings("t1", "t1"))
    assert result.facebook_page_id == "page-123"
    assert result.webchat_settings.token_version == 7


# ---------------------------------------------------------------------------
# (b) save_profile with empty secret must PRESERVE the stored token
# ---------------------------------------------------------------------------

def test_save_profile_empty_secret_preserves_stored_token(profile_path):
    # Seed a stored token.
    profile_path.write_text(json.dumps({
        "company_name": "Old",
        "line_channel_access_token": "KEEP_ME",
        "line_channel_secret": "KEEP_SECRET",
    }), encoding="utf-8")

    # POST an update that blanks the secret but changes company_name.
    incoming = TenantProfile(
        company_name="New",
        line_channel_access_token="",   # explicitly empty -> must be ignored
        line_channel_secret="",
    )
    result = _run(tenant.save_profile("t1", incoming))
    assert result["status"] == "success"

    saved = json.loads(profile_path.read_text(encoding="utf-8"))
    assert saved["line_channel_access_token"] == "KEEP_ME"   # unchanged
    assert saved["line_channel_secret"] == "KEEP_SECRET"     # unchanged
    assert saved["company_name"] == "New"                     # non-secret updated


def test_save_profile_nonempty_secret_overwrites(profile_path):
    profile_path.write_text(json.dumps({
        "line_channel_access_token": "OLD_TOKEN",
    }), encoding="utf-8")

    incoming = TenantProfile(line_channel_access_token="ROTATED_TOKEN")
    _run(tenant.save_profile("t1", incoming))

    saved = json.loads(profile_path.read_text(encoding="utf-8"))
    assert saved["line_channel_access_token"] == "ROTATED_TOKEN"


# ---------------------------------------------------------------------------
# (c) verify-line: mock httpx, never touch the network
# ---------------------------------------------------------------------------

class _FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class _FakeAsyncClient:
    """Drop-in async-context-manager replacement for httpx.AsyncClient."""
    _response = None  # set per-test

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, headers=None, timeout=None):
        # Assert we never actually build a request to LINE with an empty token, etc.
        assert url == tenant.LINE_BOT_INFO_URL
        return type(self)._response


def _patch_httpx(monkeypatch, response):
    _FakeAsyncClient._response = response
    monkeypatch.setattr(tenant.httpx, "AsyncClient", _FakeAsyncClient)


def test_verify_line_success(monkeypatch, profile_path):
    _patch_httpx(monkeypatch, _FakeResponse(200, {
        "displayName": "GenieBot",
        "pictureUrl": "https://example.com/p.png",
    }))
    body = VerifyLineRequest(access_token="a-valid-token")
    result = _run(tenant.verify_line("t1", body))
    assert result["valid"] is True
    assert result["bot_name"] == "GenieBot"
    assert result["picture_url"] == "https://example.com/p.png"


def test_verify_line_unauthorized(monkeypatch, profile_path):
    _patch_httpx(monkeypatch, _FakeResponse(401))
    body = VerifyLineRequest(access_token="bad-token")
    result = _run(tenant.verify_line("t1", body))
    assert result["valid"] is False
    assert "error" in result


def test_verify_line_no_token_short_circuits(monkeypatch, profile_path):
    # No token supplied and no stored token -> returns invalid WITHOUT calling httpx.
    def _boom(*a, **k):
        raise AssertionError("httpx.AsyncClient must not be constructed with no token")
    monkeypatch.setattr(tenant.httpx, "AsyncClient", _boom)

    result = _run(tenant.verify_line("t1", VerifyLineRequest(access_token="")))
    assert result["valid"] is False


# ---------------------------------------------------------------------------
# (d) path-traversal tenant_id -> 400 on every endpoint that takes one
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_id", ["../x", "a/b", "..", "foo bar", "x$y"])
def test_get_profile_rejects_bad_tenant_id(bad_id):
    with pytest.raises(HTTPException) as exc:
        _run(tenant.get_profile(bad_id))
    assert exc.value.status_code == 400


def test_save_profile_rejects_bad_tenant_id():
    with pytest.raises(HTTPException) as exc:
        _run(tenant.save_profile("../x", TenantProfile()))
    assert exc.value.status_code == 400


def test_verify_line_rejects_bad_tenant_id():
    with pytest.raises(HTTPException) as exc:
        _run(tenant.verify_line("../x", VerifyLineRequest(access_token="t")))
    assert exc.value.status_code == 400
