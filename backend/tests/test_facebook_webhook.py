"""Tests for the pure logic in app/routers/webhooks_facebook.py.

No real secrets and no external HTTP — only the signature helper and the
messaging-event parser are exercised.
"""
import hmac
import hashlib

from app.routers.webhooks_facebook import (
    verify_fb_signature,
    parse_messaging_events,
)

APP_SECRET = "test_app_secret"  # not a real secret


def _sign(body: bytes, secret: str = APP_SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_valid_signature_accepted():
    body = b'{"object":"page"}'
    assert verify_fb_signature(body, _sign(body), APP_SECRET) is True


def test_wrong_secret_rejected():
    body = b'{"object":"page"}'
    assert verify_fb_signature(body, _sign(body, "other"), APP_SECRET) is False


def test_tampered_body_rejected():
    body = b'{"object":"page"}'
    sig = _sign(body)
    assert verify_fb_signature(b'{"object":"tampered"}', sig, APP_SECRET) is False


def test_missing_or_malformed_signature_rejected():
    body = b"{}"
    assert verify_fb_signature(body, None, APP_SECRET) is False
    assert verify_fb_signature(body, "", APP_SECRET) is False
    assert verify_fb_signature(body, "md5=abc", APP_SECRET) is False
    assert verify_fb_signature(body, "deadbeef", APP_SECRET) is False


def test_empty_app_secret_rejected():
    body = b"{}"
    assert verify_fb_signature(body, _sign(body), "") is False


def test_parse_text_message_event():
    payload = {
        "object": "page",
        "entry": [
            {"id": "PAGE1", "messaging": [{"sender": {"id": "USER123"}, "message": {"text": "hello"}}]}
        ],
    }
    events = parse_messaging_events(payload)
    # page_id (entry.id) is carried through for multi-tenant routing.
    assert events == [{"sender_id": "USER123", "text": "hello", "page_id": "PAGE1"}]


def test_parse_skips_echo_and_non_text():
    payload = {
        "object": "page",
        "entry": [
            {"id": "PAGE2", "messaging": [
                {"sender": {"id": "U1"}, "message": {"text": "hi", "is_echo": True}},
                {"sender": {"id": "U2"}, "message": {"attachments": [{"type": "image"}]}},
                {"sender": {"id": "U3"}, "delivery": {"mids": ["m1"]}},
                {"sender": {"id": "U4"}, "message": {"text": "  keep me  "}},
            ]}
        ],
    }
    events = parse_messaging_events(payload)
    assert events == [{"sender_id": "U4", "text": "keep me", "page_id": "PAGE2"}]


def test_parse_ignores_non_page_object():
    assert parse_messaging_events({"object": "instagram", "entry": []}) == []
    assert parse_messaging_events({}) == []
