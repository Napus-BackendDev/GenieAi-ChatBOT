import asyncio
from types import SimpleNamespace

from app.routers import documents
from app.services import openai_service


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def test_profile_extractor_keeps_promotions_out_of_services(monkeypatch):
    captured = {}

    async def fake_create(**kwargs):
        captured.update(kwargs)
        message = SimpleNamespace(
            content='{"company_name":"","business_hours":"","contact_number":"",'
            '"services":[],"staff":[],"promotions":[],"faq":[],"custom_rules":[]}'
        )
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])

    monkeypatch.setattr(
        openai_service.openai_client.chat.completions,
        "create",
        fake_create,
    )

    _run(documents.extract_all_profile_from_text("Special Promotion\nSave 20%"))

    prompt = captured["messages"][0]["content"]
    assert "belongs in promotions only, never services" in prompt
    assert "Put special prices, freebies, and percentage discounts in discount" in prompt
    assert "never emit several promotion records with the same name" in prompt
