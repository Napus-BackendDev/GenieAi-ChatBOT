"""Tests that booking + staff-on-duty queries respect real staff schedules."""
import os
import json
from datetime import date, datetime

import pytest

from app.services.booking_service import (
    get_staff_on_duty_sync,
    check_booking_availability_sync,
)

TENANT = "testsched"
PROFILE_PATH = f"data/tenant_profile_{TENANT}.json"


def nth_dow(year, month, weekday, n):
    d = date(year, month, 1)
    offset = (weekday - d.weekday()) % 7
    return date(year, month, 1 + offset + (n - 1) * 7)


@pytest.fixture(autouse=True)
def temp_profile():
    os.makedirs("data", exist_ok=True)
    profile = {
        "company_name": "Test Clinic",
        "staff": [
            {"name": "Dr. Sat4", "role": "ทันตแพทย์", "schedule": "เสาร์ (สัปดาห์ที่ 4) 13:00–17:00"},
            {"name": "Dr. ThuSun", "role": "ทันตแพทย์", "schedule": "พฤหัส–อาทิตย์ 09:00–16:00"},
            {"name": "Dr. SunOnly", "role": "ทันตแพทย์", "schedule": "อาทิตย์ (2, 3, 4) 09:00–16:00"},
            {"name": "Dr. Ask", "role": "ทันตแพทย์", "schedule": "โปรดสอบถามคลินิก"},
        ],
    }
    with open(PROFILE_PATH, "w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False)
    yield
    if os.path.exists(PROFILE_PATH):
        os.remove(PROFILE_PATH)


def test_staff_on_duty_saturday():
    res = get_staff_on_duty_sync("เสาร์", TENANT)
    names = {r["name"] for r in res["on_duty"]}
    assert "Dr. Sat4" in names       # works some Saturdays
    assert "Dr. ThuSun" in names     # Thu–Sun range includes Saturday
    assert "Dr. SunOnly" not in names  # Sunday only


def test_staff_on_duty_sunday():
    names = {r["name"] for r in get_staff_on_duty_sync("อาทิตย์", TENANT)["on_duty"]}
    assert "Dr. SunOnly" in names
    assert "Dr. ThuSun" in names
    assert "Dr. Sat4" not in names


def test_staff_on_duty_specific_date_filters_week():
    sat1 = nth_dow(2026, 8, 5, 1).isoformat()  # 1st Saturday
    sat4 = nth_dow(2026, 8, 5, 4).isoformat()  # 4th Saturday
    names1 = {r["name"] for r in get_staff_on_duty_sync(sat1, TENANT)["on_duty"]}
    names4 = {r["name"] for r in get_staff_on_duty_sync(sat4, TENANT)["on_duty"]}
    assert "Dr. Sat4" not in names1   # not the 4th Saturday
    assert "Dr. Sat4" in names4       # the 4th Saturday


def test_booking_blocked_when_staff_off_duty():
    # A Thursday — Dr. Sat4 does not work Thursdays (the original Jarinda bug).
    thu = nth_dow(2026, 12, 3, 1)
    dt = datetime(thu.year, thu.month, thu.day, 14, 0).isoformat()
    res = check_booking_availability_sync(dt, TENANT, staff_name="Dr. Sat4")
    assert res["available"] is False
    assert res.get("reason") == "staff_off_duty"


def test_booking_allowed_when_staff_on_duty():
    sat4 = nth_dow(2026, 12, 5, 4)
    dt = datetime(sat4.year, sat4.month, sat4.day, 14, 0).isoformat()
    res = check_booking_availability_sync(dt, TENANT, staff_name="Dr. Sat4")
    assert res["available"] is True


def test_unknown_schedule_not_blocked():
    # "โปรดสอบถามคลินิก" schedule must NOT hard-block booking (clinic decides).
    sat4 = nth_dow(2026, 12, 5, 4)
    dt = datetime(sat4.year, sat4.month, sat4.day, 10, 0).isoformat()
    res = check_booking_availability_sync(dt, TENANT, staff_name="Dr. Ask")
    assert res["available"] is True


def test_fuzzy_staff_name_match():
    # AI may pass a short name; schedule still validated against the full record.
    thu = nth_dow(2026, 12, 3, 2)
    dt = datetime(thu.year, thu.month, thu.day, 14, 0).isoformat()
    res = check_booking_availability_sync(dt, TENANT, staff_name="Sat4")
    assert res["available"] is False
    assert res.get("reason") == "staff_off_duty"
