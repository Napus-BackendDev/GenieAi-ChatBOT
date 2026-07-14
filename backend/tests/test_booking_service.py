"""Tests for booking conflict logic + tenant isolation (app/services/booking_service.py)."""
import json
import os
from datetime import datetime, timedelta

import pytest
from app.core.config import settings
from app.services import booking_service


@pytest.fixture
def isolated_bookings(tmp_path, monkeypatch):
    """Point the booking store at a throwaway file so tests don't touch real data."""
    monkeypatch.setattr(settings, "BOOKINGS_JSON_PATH", str(tmp_path / "bookings.json"))
    async def always_on_staff(_tenant_id):
        return [{"name": "Dr. Test", "schedule": "จันทร์–อาทิตย์ 00:00–23:59"}]
    monkeypatch.setattr(booking_service, "_load_tenant_staff", always_on_staff)


@pytest.fixture
def isolated_env(tmp_path, monkeypatch):
    """Isolate BOTH the booking store and the profile lookup.

    booking_service._load_booking_settings reads a RELATIVE path
    (data/tenant_profile_{id}.json), so chdir into tmp makes that resolve under
    the throwaway dir — no repo data/ pollution, fully deterministic.
    """
    monkeypatch.setattr(settings, "BOOKINGS_JSON_PATH", str(tmp_path / "bookings.json"))
    monkeypatch.chdir(tmp_path)
    os.makedirs(tmp_path / "data", exist_ok=True)

    def _write_profile(tenant_id: str, booking_settings: dict):
        path = tmp_path / "data" / f"tenant_profile_{tenant_id}.json"
        path.write_text(
            json.dumps({
                "booking_settings": booking_settings,
                "staff": [{"name": "Dr. Test", "schedule": "จันทร์–อาทิตย์ 00:00–23:59"}],
            }), encoding="utf-8"
        )

    return _write_profile


def test_available_then_conflict_within_30min(isolated_bookings):
    dt = "2099-01-01T10:00:00"
    assert booking_service.check_booking_availability_sync(dt, tenant_id="t1")["available"] is True

    res = booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service", dt, tenant_id="t1"
    )
    assert res["status"] == "success"

    # 20 min later → inside the 30-min conflict window → not available
    assert booking_service.check_booking_availability_sync(
        "2099-01-01T10:20:00", tenant_id="t1"
    )["available"] is False

    # 40 min later → outside the window → available again
    assert booking_service.check_booking_availability_sync(
        "2099-01-01T10:40:00", tenant_id="t1"
    )["available"] is True


def test_tenant_isolation_no_cross_conflict(isolated_bookings):
    dt = "2099-01-01T10:00:00"
    booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service", dt, tenant_id="t1"
    )
    # A different tenant booking the same slot must NOT see a conflict
    assert booking_service.check_booking_availability_sync(dt, tenant_id="t2")["available"] is True


def test_create_rejects_when_slot_taken(isolated_bookings):
    dt = "2099-01-01T10:00:00"
    booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service", dt, tenant_id="t1"
    )
    res = booking_service.create_booking_sync(
        "B", "0899999999", "b@example.com", "service", "2099-01-01T10:15:00", tenant_id="t1"
    )
    assert res["status"] == "error"


# --- Wave A regressions: past-datetime rejection, lead time, custom conflict window ---

def test_rejects_past_datetime(isolated_bookings):
    """A datetime in the past must never be available (regression)."""
    past = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    res = booking_service.check_booking_availability_sync(past, tenant_id="t1")
    assert res["available"] is False
    assert "ผ่านมาแล้ว" in res["message"]

    # create must also refuse it outright.
    created = booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service", past, tenant_id="t1"
    )
    assert created["status"] == "error"


def test_enforces_default_min_lead_time(isolated_bookings):
    """Default lead time is 2h; a slot 30 min out is rejected, 3h out is fine."""
    soon = (datetime.now() + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S")
    assert booking_service.check_booking_availability_sync(soon, tenant_id="t1")["available"] is False

    later = (datetime.now() + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")
    assert booking_service.check_booking_availability_sync(later, tenant_id="t1")["available"] is True


def test_custom_min_lead_time_from_profile(isolated_env):
    """A tenant profile with min_lead_time_hours=24 rejects slots inside 24h."""
    isolated_env("clinic", {"min_lead_time_hours": 24})

    in_12h = (datetime.now() + timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%S")
    assert booking_service.check_booking_availability_sync(in_12h, tenant_id="clinic")["available"] is False

    in_30h = (datetime.now() + timedelta(hours=30)).strftime("%Y-%m-%dT%H:%M:%S")
    assert booking_service.check_booking_availability_sync(in_30h, tenant_id="clinic")["available"] is True


def test_custom_conflict_window_from_profile(isolated_env):
    """conflict_window_mins=60 makes a 45-min-later slot conflict (default 30 would not)."""
    isolated_env("spa", {"conflict_window_mins": 60, "min_lead_time_hours": 0})

    base = "2099-06-01T10:00:00"
    created = booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service", base, tenant_id="spa"
    )
    assert created["status"] == "success"

    # 45 min later is inside a 60-min window → conflict.
    in_45 = "2099-06-01T10:45:00"
    assert booking_service.check_booking_availability_sync(in_45, tenant_id="spa")["available"] is False

    # 70 min later is outside the 60-min window → available.
    in_70 = "2099-06-01T11:10:00"
    assert booking_service.check_booking_availability_sync(in_70, tenant_id="spa")["available"] is True


def test_invalid_profile_settings_fall_back_to_defaults(isolated_env):
    """Non-positive / non-numeric overrides are ignored; defaults (30/2h) apply."""
    isolated_env("bad", {"conflict_window_mins": -5, "min_lead_time_hours": "nope"})

    # Default 2h lead time still enforced despite the garbage min_lead_time_hours.
    soon = (datetime.now() + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S")
    assert booking_service.check_booking_availability_sync(soon, tenant_id="bad")["available"] is False

    # Default 30-min conflict window still applies despite the negative override.
    base = "2099-07-01T10:00:00"
    booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service", base, tenant_id="bad"
    )
    in_20 = "2099-07-01T10:20:00"
    assert booking_service.check_booking_availability_sync(in_20, tenant_id="bad")["available"] is False


# --- Wave B regression: contact-info validation (email/phone) ---
# Booking creation only runs via AI function-calling, so these guard against the
# model forwarding malformed contact info (observed: email "not-an-email" stored).

@pytest.mark.parametrize("bad_email", ["not-an-email", "foo@bar", "@example.com", "a b@x.com", ""])
def test_create_rejects_invalid_email(isolated_bookings, bad_email):
    res = booking_service.create_booking_sync(
        "A", "0800000000", bad_email, "service", "2099-01-01T10:00:00", tenant_id="t1"
    )
    assert res["status"] == "error"
    assert "อีเมล" in res["message"]
    # Nothing must have been persisted.
    assert booking_service.check_booking_availability_sync(
        "2099-01-01T10:00:00", tenant_id="t1"
    )["available"] is True


@pytest.mark.parametrize("bad_phone", ["abc", "123", "", "phone please", "12345678"])
def test_create_rejects_invalid_phone(isolated_bookings, bad_phone):
    res = booking_service.create_booking_sync(
        "A", bad_phone, "a@example.com", "service", "2099-01-01T10:00:00", tenant_id="t1"
    )
    assert res["status"] == "error"
    assert "เบอร์" in res["message"]
    assert booking_service.check_booking_availability_sync(
        "2099-01-01T10:00:00", tenant_id="t1"
    )["available"] is True


@pytest.mark.parametrize("good_phone", ["0812345678", "081-234-5678", "+66 81 234 5678", "(081) 234 5678"])
def test_create_accepts_wellformed_contact(isolated_bookings, good_phone):
    res = booking_service.create_booking_sync(
        "A", good_phone, "customer@example.com", "service", "2099-02-01T10:00:00", tenant_id="t1"
    )
    assert res["status"] == "success"
