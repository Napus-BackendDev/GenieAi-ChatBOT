"""Tests for the shared, tenant-agnostic prompt builder (app/services/prompt.py)."""
from app.services.prompt import (
    build_profile_context,
    build_system_prompt,
    build_rag_context_message,
    HANDOFF_MARKER,
)

SAMPLE = {
    "company_name": "ร้านกาแฟ",
    "business_hours": "8-18",
    "contact_number": "02-000-0000",
    "services": [{"name": "ลาเต้", "price": "65"}],
    "promotions": [{"name": "โปรเช้า", "description": "ลด 10%"}],
    "staff": [{"name": "บาริสต้า A", "role": "barista"}],
    "faq": [{"question": "มีที่จอดรถไหม", "answer": "มี"}],
}


def test_profile_context_includes_tenant_data():
    ctx = build_profile_context(SAMPLE)
    for token in ("ร้านกาแฟ", "ลาเต้", "โปรเช้า", "บาริสต้า A", "มีที่จอดรถไหม"):
        assert token in ctx


def test_system_prompt_is_tenant_agnostic():
    """Regression guard for cluster B: no hardcoded clinic data may leak into the prompt."""
    sp = build_system_prompt("cag", build_profile_context(SAMPLE))
    assert "ฟอกสีฟัน" not in sp        # old hardcoded whitening campaign
    assert "Dr." not in sp             # old hardcoded doctor names
    assert HANDOFF_MARKER in sp        # escalation contract present


def test_cag_embeds_context_but_rag_does_not():
    ctx = build_profile_context(SAMPLE)
    assert ctx in build_system_prompt("cag", ctx)
    assert ctx not in build_system_prompt("rag", ctx)


def test_rag_context_message_shape():
    msg = build_rag_context_message("HELLO-CTX")
    assert msg["role"] == "system"
    assert "HELLO-CTX" in msg["content"]


def test_empty_profile_does_not_crash():
    ctx = build_profile_context({})
    assert isinstance(ctx, str)
