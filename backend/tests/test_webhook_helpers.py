"""Tests for the pure LINE message-shaping helpers in app/routers/webhooks.py."""
from app.routers.webhooks import (
    split_to_line_bubbles,
    _strip_markdown,
    contains_emoji,
    HANDOFF_MARKER,
)


def test_single_bubble_when_short():
    assert split_to_line_bubbles("สวัสดีค่ะ") == ["สวัสดีค่ะ"]


def test_split_on_separator():
    assert split_to_line_bubbles("a\n---\nb\n---\nc") == ["a", "b", "c"]


def test_split_falls_back_to_double_newline():
    assert split_to_line_bubbles("a\n\nb") == ["a", "b"]


def test_max_bubbles_cap_merges_overflow():
    text = "1\n---\n2\n---\n3\n---\n4\n---\n5\n---\n6"
    out = split_to_line_bubbles(text, max_bubbles=3)
    assert len(out) == 3
    assert "6" in out[-1]  # overflow merged into the last bubble


def test_strip_markdown():
    assert "**" not in _strip_markdown("**bold**")
    assert _strip_markdown("# Heading") == "Heading"


def test_contains_emoji():
    assert contains_emoji("hi 😊") is True
    assert contains_emoji("สวัสดีครับ") is False


def test_handoff_marker_value():
    assert HANDOFF_MARKER == "[[HANDOFF]]"
