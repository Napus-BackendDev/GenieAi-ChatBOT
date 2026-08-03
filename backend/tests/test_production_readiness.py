import asyncio
import io

import pytest
from fastapi import BackgroundTasks, HTTPException
from fastapi import UploadFile
from starlette.requests import Request

from app.core import db, idempotency, redis as redis_core
from app.core.client_ip import get_client_ip
from app.core.config import Settings, settings
from app.core.security import create_webchat_token, get_current_tenant
from app.routers import auth, documents, tenant, webhooks, webhooks_web


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _production_settings(**overrides):
    values = {
        "OPENAI_API_KEY": "test-openai",
        "LINE_CHANNEL_ACCESS_TOKEN": "test-line-token",
        "LINE_CHANNEL_SECRET": "test-line-secret",
        "REDIS_URL": "rediss://redis.example.test:6379",
        "ENVIRONMENT": "production",
        "JWT_SECRET": "a" * 48,
        "WEBCHAT_JWT_SECRET": "b" * 48,
        "MONGODB_URI": "mongodb://mongo.example.test/genieai",
        "CORS_ORIGINS": "https://app.example.test",
        "TRUSTED_HOSTS": "app.example.test,api.example.test",
        "ALLOW_MOCK_LOGIN": False,
        "ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS": False,
        "ALLOW_LOCAL_DATA_FALLBACK": False,
        "EXPOSE_ACCESS_TOKEN": False,
    }
    values.update(overrides)
    return Settings(**values)


def _request(ip="127.0.0.1"):
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [], "client": (ip, 1234)})


def test_valid_production_configuration_passes():
    _production_settings().validate_runtime()


@pytest.mark.parametrize(
    ("override", "expected"),
    [
        ({"JWT_SECRET": "short"}, "JWT_SECRET"),
        ({"WEBCHAT_JWT_SECRET": "short"}, "WEBCHAT_JWT_SECRET"),
        ({"MONGODB_URI": ""}, "MONGODB_URI"),
        ({"CORS_ORIGINS": "*"}, "CORS_ORIGINS"),
        ({"ALLOW_LOCAL_DATA_FALLBACK": True}, "ALLOW_LOCAL_DATA_FALLBACK"),
        ({"ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS": True}, "ALLOW_LEGACY"),
        ({"EXPOSE_ACCESS_TOKEN": True}, "EXPOSE_ACCESS_TOKEN"),
        ({"SESSION_COOKIE_SAMESITE": "none"}, "SESSION_COOKIE_SAMESITE"),
    ],
)
def test_unsafe_production_configuration_is_rejected(override, expected):
    with pytest.raises(RuntimeError, match=expected):
        _production_settings(**override).validate_runtime()


def test_admin_auth_rejects_webchat_token():
    with pytest.raises(HTTPException) as exc:
        get_current_tenant(f"Bearer {create_webchat_token('tenant-a')}")
    assert exc.value.status_code == 401


def test_client_ip_ignores_leftmost_spoofed_forwarded_value(monkeypatch):
    monkeypatch.setattr(settings, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_NETWORKS", "172.16.0.0/12")
    request = Request(
        {
            "type": "http",
            "headers": [(b"x-forwarded-for", b"203.0.113.9, 198.51.100.4")],
            "client": ("172.18.0.2", 12345),
        }
    )
    assert get_client_ip(request) == "198.51.100.4"


def test_legacy_line_route_can_be_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS", False)
    with pytest.raises(HTTPException) as exc:
        _run(webhooks.line_webhook(None, BackgroundTasks(), None))
    assert exc.value.status_code == 404


def test_local_database_fallback_can_be_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_LOCAL_DATA_FALLBACK", False)
    monkeypatch.setattr(db, "_mongo_db_or_none", lambda: None)
    with pytest.raises(RuntimeError, match="local fallback is disabled"):
        _run(db.db_load_users())


def test_webchat_rate_limit_fails_closed_in_production(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(redis_core, "get_redis", lambda: (_ for _ in ()).throw(RuntimeError("down")))
    with pytest.raises(HTTPException) as exc:
        _run(webhooks_web._enforce_widget_rate_limits("tenant-a", "session-a", "127.0.0.1"))
    assert exc.value.status_code == 503


def test_webhook_idempotency_claims_event_once(monkeypatch):
    class FakeRedis:
        def __init__(self):
            self.keys = set()

        async def set(self, key, _value, ex, nx=True):
            assert ex == 300 and nx is True
            if key in self.keys:
                return False
            self.keys.add(key)
            return True

    fake = FakeRedis()
    monkeypatch.setattr(idempotency, "get_redis", lambda: fake)
    assert _run(idempotency.claim_webhook_event("line", "tenant-a", "event-1")) is True
    assert _run(idempotency.claim_webhook_event("line", "tenant-a", "event-1")) is False


def test_failed_webhook_handler_releases_pending_claim(monkeypatch):
    class FakeRedis:
        def __init__(self):
            self.deleted = []

        async def delete(self, key):
            self.deleted.append(key)

    fake = FakeRedis()
    monkeypatch.setattr(idempotency, "get_redis", lambda: fake)

    async def fail():
        raise RuntimeError("delivery failed")

    with pytest.raises(RuntimeError):
        _run(
            idempotency.run_claimed_webhook_event(
                "line",
                "tenant-a",
                "event-1",
                fail,
            )
        )
    assert len(fake.deleted) == 1


def test_login_rate_limit_blocks_account_attempt_11(monkeypatch):
    class FakeRedis:
        def __init__(self):
            self.counts = {}

        def pipeline(self, transaction=True):
            assert transaction is True
            self.commands = []
            return self

        def set(self, key, value, ex, nx):
            self.commands.append(("set", key, value, ex, nx))
            return self

        def incr(self, key):
            self.commands.append(("incr", key))
            return self

        async def execute(self):
            _, key, _value, _ex, _nx = self.commands[0]
            _, incr_key = self.commands[1]
            assert key == incr_key
            self.counts[key] = self.counts.get(key, 0) + 1
            return [self.counts[key] == 1, self.counts[key]]

    fake = FakeRedis()
    monkeypatch.setattr(redis_core, "get_redis", lambda: fake)

    async def exceed_limit():
        for _ in range(10):
            await auth._enforce_login_rate_limit(_request(), "owner@example.com")
        with pytest.raises(HTTPException) as exc:
            await auth._enforce_login_rate_limit(_request(), "owner@example.com")
        assert exc.value.status_code == 429

    _run(exceed_limit())


def test_upload_rejects_spoofed_pdf_signature():
    upload = UploadFile(filename="manual.pdf", file=io.BytesIO(b"not really a pdf"))
    with pytest.raises(HTTPException) as exc:
        _run(documents.upload_document(upload, "tenant-a"))
    assert exc.value.status_code == 400


def test_upload_limit_is_enforced_server_side(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 4)
    upload = UploadFile(filename="manual.txt", file=io.BytesIO(b"12345"))
    with pytest.raises(HTTPException) as exc:
        _run(documents.upload_document(upload, "tenant-a"))
    assert exc.value.status_code == 413


def test_tenant_image_rejects_spoofed_content(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "STATIC_IMAGES_PATH", str(tmp_path))
    upload = UploadFile(filename="promotion.png", file=io.BytesIO(b"not an image"))
    with pytest.raises(HTTPException) as exc:
        _run(tenant.upload_tenant_image("tenant-a", upload, "tenant-a"))
    assert exc.value.status_code == 400
    assert list(tmp_path.rglob("*.*")) == []
