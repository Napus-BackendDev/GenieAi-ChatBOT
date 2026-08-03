"""Security regression tests for the signed embeddable web-chat contract."""
import asyncio

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from pydantic import ValidationError

from app.core.security import (
    create_access_token,
    create_webchat_token,
    verify_webchat_token,
)
from app.routers import tenant, webhooks_web


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def _request(ip="127.0.0.1"):
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [], "client": (ip, 1234)})


def test_webchat_token_is_purpose_scoped_and_tamper_safe():
    token = create_webchat_token("tenant-a")
    assert verify_webchat_token(token) == "tenant-a"

    with pytest.raises(HTTPException) as access_error:
        verify_webchat_token(create_access_token("tenant-a", "owner@example.com"))
    assert access_error.value.status_code == 401

    parts = token.split(".")
    parts[2] = ("a" if parts[2][0] != "a" else "b") + parts[2][1:]
    changed = ".".join(parts)
    with pytest.raises(HTTPException) as tamper_error:
        verify_webchat_token(changed)
    assert tamper_error.value.status_code == 401


def test_settings_supplies_token_without_raw_tenant(monkeypatch):
    async def load_profile(_tenant_id):
        return {"company_name": "Shop"}

    monkeypatch.setattr(tenant, "db_load_profile", load_profile)
    settings = _run(tenant.get_settings("tenant-a", "tenant-a"))

    assert verify_webchat_token(settings.webchat_config.token) == "tenant-a"
    assert not hasattr(settings.webchat_config, "tenant_id")


def test_request_rejects_raw_tenant_id():
    with pytest.raises(ValidationError):
        webhooks_web.WebChatRequest(
            token=create_webchat_token("tenant-a"),
            tenant_id="tenant-other",
            session_id="browser_123",
            message="Hi",
        )


def test_webhook_derives_tenant_only_from_signed_token(monkeypatch):
    captured = {}

    async def tenant_exists(tenant_id):
        return tenant_id == "tenant-signed"

    async def load_profile(_tenant_id):
        return {"webchat_settings": {"enabled": True, "token_version": 1}}

    async def allow_rate(*_args):
        return None

    async def generate(**kwargs):
        captured.update(kwargs)
        return {
            "bubbles": ["Hello"],
            "mode": "cag",
            "citations": [],
            "requires_human": False,
            "skipped": False,
        }

    from app.core import db
    monkeypatch.setattr(db, "db_tenant_exists", tenant_exists)
    monkeypatch.setattr(db, "db_load_profile", load_profile)
    monkeypatch.setattr(webhooks_web, "_enforce_widget_rate_limits", allow_rate)
    monkeypatch.setattr(webhooks_web, "generate_ai_bubbles", generate)

    response = _run(
        webhooks_web.web_webhook(
            webhooks_web.WebChatRequest(
                token=create_webchat_token("tenant-signed"),
                session_id="browser_123",
                message="Hi",
            ),
            _request(),
        )
    )

    assert captured["tenant_id"] == "tenant-signed"
    assert response.bubbles == ["Hello"]


def test_webhook_rejects_unknown_signed_tenant(monkeypatch):
    async def tenant_missing(_tenant_id):
        return False

    from app.core import db
    monkeypatch.setattr(db, "db_tenant_exists", tenant_missing)

    with pytest.raises(HTTPException) as exc:
        _run(
            webhooks_web.web_webhook(
                webhooks_web.WebChatRequest(
                    token=create_webchat_token("deleted-tenant"),
                    session_id="browser_123",
                    message="Hi",
                ),
                _request(),
            )
        )
    assert exc.value.status_code == 404


def test_webhook_rejects_disabled_widget(monkeypatch):
    async def tenant_exists(_tenant_id):
        return True

    async def load_profile(_tenant_id):
        return {"webchat_settings": {"enabled": False, "token_version": 1}}

    from app.core import db
    monkeypatch.setattr(db, "db_tenant_exists", tenant_exists)
    monkeypatch.setattr(db, "db_load_profile", load_profile)

    with pytest.raises(HTTPException) as exc:
        _run(
            webhooks_web.web_webhook(
                webhooks_web.WebChatRequest(
                    token=create_webchat_token("tenant-a"),
                    session_id="browser_123",
                    message="Hi",
                ),
                _request(),
            )
        )
    assert exc.value.status_code == 403


def test_session_rate_limit_blocks_request_21(monkeypatch):
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

    from app.core import redis as redis_core
    monkeypatch.setattr(redis_core, "get_redis", lambda: FakeRedis())
    fake = redis_core.get_redis()
    monkeypatch.setattr(redis_core, "get_redis", lambda: fake)

    async def exceed_limit():
        for _ in range(20):
            await webhooks_web._enforce_widget_rate_limits("tenant-a", "session-a", "127.0.0.1")
        with pytest.raises(HTTPException) as exc:
            await webhooks_web._enforce_widget_rate_limits("tenant-a", "session-a", "127.0.0.1")
        assert exc.value.status_code == 429

    _run(exceed_limit())
