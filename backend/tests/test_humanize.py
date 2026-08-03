"""Tests for the AIS-style human reply pacing (LINE typing animation + delays)."""
import os
import json
import asyncio

import pytest

from app.routers.webhooks import (
    _typing_seconds,
    _load_humanize_mode,
    _HUMANIZE_PROFILES,
    DEFAULT_HUMANIZE_MODE,
)

SLOW = _HUMANIZE_PROFILES["slow"]


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


def test_typing_seconds_respects_min_and_cap():
    short = _typing_seconds("hi", SLOW)
    long = _typing_seconds("x" * 1000, SLOW)
    assert short >= SLOW["type_min"]
    assert short <= SLOW["type_cap"]
    assert long == SLOW["type_cap"]  # long text is capped


def test_typing_seconds_grows_with_length():
    # A longer message should never take less "typing" time than a short one.
    assert _typing_seconds("x" * 200, SLOW) >= _typing_seconds("x", SLOW)


def test_slow_is_slower_than_normal():
    normal = _HUMANIZE_PROFILES["normal"]
    txt = "x" * 60
    # Same text: slow profile's cap/rate should not be faster than normal's.
    assert SLOW["type_cap"] >= normal["type_cap"]
    assert SLOW["per_char"] >= normal["per_char"]


def test_humanize_mode_defaults_to_slow():
    assert DEFAULT_HUMANIZE_MODE == "slow"
    assert _run(_load_humanize_mode("nonexistent-tenant-xyz")) == "slow"


@pytest.mark.parametrize("mode", ["slow", "normal", "off"])
def test_humanize_mode_read_from_profile(mode):
    tid = "htest_tenant"
    path = f"data/tenant_profile_{tid}.json"
    os.makedirs("data", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"company_name": "X", "ai_settings": {"humanize_mode": mode}}, f)
    try:
        assert _run(_load_humanize_mode(tid)) == mode
    finally:
        os.remove(path)


def test_invalid_humanize_mode_falls_back_to_default():
    tid = "htest_bad"
    path = f"data/tenant_profile_{tid}.json"
    os.makedirs("data", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"ai_settings": {"humanize_mode": "banana"}}, f)
    try:
        assert _run(_load_humanize_mode(tid)) == "slow"
    finally:
        os.remove(path)
