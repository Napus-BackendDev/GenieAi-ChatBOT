"""Regression tests for three booking_service bugs:

BUG 1 — TOCTOU double-booking race: two concurrent create_booking_sync calls for the
        same tenant+datetime+staff must NOT both succeed.
BUG 2 — machine-readable refusal reason codes on the availability check.
BUG 3 — negative UTC offset (e.g. -05:00) must not raise a naive/aware compare TypeError.
"""
import threading
from datetime import datetime, timedelta

import pytest
from app.core.config import settings
from app.services import booking_service


@pytest.fixture
def isolated_bookings(tmp_path, monkeypatch):
    """Point the booking store at a throwaway file so tests don't touch real data."""
    monkeypatch.setattr(settings, "BOOKINGS_JSON_PATH", str(tmp_path / "bookings.json"))


# --- BUG 1: concurrent create for the same slot → exactly one success -------------

def test_concurrent_create_only_one_succeeds(isolated_bookings):
    """Two threads booking the identical tenant+datetime+staff: one wins, one errors.

    A barrier lines both threads up so they enter create_booking_sync together, then
    contend for the write lock. Before the fix, both could pass the (lock-released)
    availability check and both append — now the authoritative re-check inside the
    single write-lock block lets only the first through.
    """
    dt = "2099-03-01T10:00:00"
    tenant = "race"
    staff = "Dr. A"

    barrier = threading.Barrier(2)
    results: list[dict] = []
    results_lock = threading.Lock()

    def worker(name: str):
        barrier.wait()  # release both threads as simultaneously as possible
        res = booking_service.create_booking_sync(
            name, "0800000000", "a@example.com", "service", dt,
            tenant_id=tenant, staff_name=staff,
        )
        with results_lock:
            results.append(res)

    t1 = threading.Thread(target=worker, args=("A",))
    t2 = threading.Thread(target=worker, args=("B",))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    successes = [r for r in results if r.get("status") == "success"]
    errors = [r for r in results if r.get("status") == "error"]
    assert len(successes) == 1, f"expected exactly one success, got {results}"
    assert len(errors) == 1, f"expected exactly one error, got {results}"

    # And the store must contain exactly ONE booking for that slot.
    bookings = booking_service._load_bookings()
    same_slot = [
        b for b in bookings
        if b.get("tenant_id") == tenant and b.get("booking_datetime") == dt
    ]
    assert len(same_slot) == 1, f"double-booking persisted: {same_slot}"


# --- BUG 2: machine-readable reason codes ----------------------------------------

def test_reason_past_date(isolated_bookings):
    past = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    res = booking_service.check_booking_availability_sync(past, tenant_id="t1")
    assert res["available"] is False
    assert res["reason"] == "past_date"
    assert "ผ่านมาแล้ว" in res["message"]  # existing Thai text preserved


def test_reason_under_lead_time(isolated_bookings):
    # ~30 min ahead is inside the default 2h lead time.
    soon = (datetime.now() + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%S")
    res = booking_service.check_booking_availability_sync(soon, tenant_id="t1")
    assert res["available"] is False
    assert res["reason"] == "under_lead_time"
    assert "ล่วงหน้า" in res["message"]  # existing Thai text preserved


def test_reason_slot_taken(isolated_bookings):
    dt = "2099-04-01T10:00:00"
    booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service", dt, tenant_id="t1"
    )
    # 15 min later is inside the default 30-min conflict window.
    res = booking_service.check_booking_availability_sync("2099-04-01T10:15:00", tenant_id="t1")
    assert res["available"] is False
    assert res["reason"] == "slot_taken"


# --- BUG 3: negative UTC offset must not raise -----------------------------------

def test_negative_offset_does_not_raise(isolated_bookings):
    """A -05:00 offset input parses fine and is treated as a naive local time.

    Before the fix, the cleaner only stripped `Z`/`+HH:MM`, so the `-05:00` remained
    and datetime.fromisoformat produced a tz-aware value that crashed on comparison
    with the naive datetime.now().
    """
    res = booking_service.check_booking_availability_sync(
        "2099-01-01T10:00:00-05:00", tenant_id="t1"
    )
    # Far-future date → available; the point is that it did not raise.
    assert res["available"] is True


def test_negative_offset_create_does_not_raise(isolated_bookings):
    res = booking_service.create_booking_sync(
        "A", "0800000000", "a@example.com", "service",
        "2099-05-01T10:00:00-05:00", tenant_id="t1",
    )
    assert res["status"] == "success"


def test_parse_helper_strips_all_offset_forms():
    """_parse_booking_dt returns a naive datetime for Z, +HH:MM and -HH:MM inputs."""
    for s in (
        "2027-01-01T10:00:00",
        "2027-01-01T10:00:00Z",
        "2027-01-01T10:00:00+07:00",
        "2027-01-01T10:00:00-05:00",
    ):
        dt = booking_service._parse_booking_dt(s)
        assert dt.tzinfo is None, f"{s} -> tzinfo should be None"
        assert dt.year == 2027 and dt.hour == 10  # wall-clock preserved


def test_parse_helper_raises_on_garbage():
    with pytest.raises(ValueError):
        booking_service._parse_booking_dt("not-a-datetime")
