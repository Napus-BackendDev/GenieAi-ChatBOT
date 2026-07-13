"""Tests for the Thai staff-schedule parser using the real Tooth Therapy schedules."""
from datetime import date, datetime

from app.services.schedule import (
    parse_schedule,
    is_on_duty,
    covers_datetime,
    staff_working_on,
)


def nth_dow(year, month, weekday, n):
    """Date of the nth given weekday (0=Mon..6=Sun) in a month."""
    d = date(year, month, 1)
    offset = (weekday - d.weekday()) % 7
    return date(year, month, 1 + offset + (n - 1) * 7)


# ---- day-range expansion (the frontend parser's blind spot) ----
def test_day_range_includes_middle_days():
    # Dr. Yupares: "พฤหัส–อาทิตย์" = Thu, Fri, Sat, Sun
    sched = "พฤหัส–อาทิตย์ 09:00–16:00/18:00"
    sat = datetime.combine(nth_dow(2026, 8, 5, 1), datetime.min.time())  # a Saturday
    thu = datetime.combine(nth_dow(2026, 8, 3, 1), datetime.min.time())  # a Thursday
    mon = datetime.combine(nth_dow(2026, 8, 0, 1), datetime.min.time())  # a Monday
    assert is_on_duty(sched, sat)[0] is True
    assert is_on_duty(sched, thu)[0] is True
    assert is_on_duty(sched, mon)[0] is False


def test_tue_wed_range():
    sched = "อังคาร–พุธ 09:00–15:00"
    tue = datetime.combine(nth_dow(2026, 8, 1, 1), datetime.min.time())
    thu = datetime.combine(nth_dow(2026, 8, 3, 1), datetime.min.time())
    assert is_on_duty(sched, tue)[0] is True
    assert is_on_duty(sched, thu)[0] is False


# ---- week-of-month (nth weekday) ----
def test_jarinda_fourth_saturday_only():
    # Dr. Jarinda: "เสาร์ (สัปดาห์ที่ 4) 13:00–17:00"
    sched = "เสาร์ (สัปดาห์ที่ 4) 13:00–17:00"
    sat4 = datetime.combine(nth_dow(2026, 8, 5, 4), datetime.min.time())
    sat1 = datetime.combine(nth_dow(2026, 8, 5, 1), datetime.min.time())
    thu = datetime.combine(nth_dow(2026, 8, 3, 1), datetime.min.time())
    assert is_on_duty(sched, sat4)[0] is True
    assert is_on_duty(sched, sat1)[0] is False
    assert is_on_duty(sched, thu)[0] is False


def test_jarinda_booking_time_window():
    # The exact production bug: booked Jarinda Thu 2026-08-20 14:00 (she works Sat wk4 only)
    sched = "เสาร์ (สัปดาห์ที่ 4) 13:00–17:00"
    assert covers_datetime(sched, datetime(2026, 8, 20, 14, 0)) is False  # Thursday
    sat4 = nth_dow(2026, 8, 5, 4)
    assert covers_datetime(sched, datetime(sat4.year, sat4.month, sat4.day, 14, 0)) is True
    assert covers_datetime(sched, datetime(sat4.year, sat4.month, sat4.day, 18, 0)) is False  # after hours


def test_unknown_schedule_never_on_duty():
    for d in range(1, 8):
        assert is_on_duty("โปรดสอบถามคลินิก", datetime(2026, 8, d, 10, 0))[0] is False
    assert parse_schedule("") == []


# ---- multi-shift ----
def test_multi_shift_wed_and_sunday_weeks():
    # Dr. Suthasinee: "พุธ 11:00–16:00 | อาทิตย์ (1, 3, 5) 10:00–16:00"
    sched = "พุธ 11:00–16:00 | อาทิตย์ (1, 3, 5) 10:00–16:00"
    wed = datetime.combine(nth_dow(2026, 8, 2, 1), datetime.min.time())
    sun1 = datetime.combine(nth_dow(2026, 8, 6, 1), datetime.min.time())
    sun2 = datetime.combine(nth_dow(2026, 8, 6, 2), datetime.min.time())
    assert is_on_duty(sched, wed)[0] is True
    assert is_on_duty(sched, sun1)[0] is True
    assert is_on_duty(sched, sun2)[0] is False  # week 2 not in (1,3,5)


# ---- the exact Q07 chat bug: "which pediatric dentist works Saturday" ----
PEDS = [
    {"name": "Dr. Aungsuma", "schedule": "อาทิตย์ (2, 3, 4) 09:00–16:00"},      # Sunday
    {"name": "Dr. Donhathai", "schedule": "อาทิตย์ (1, 3) 09:00–16:00"},        # Sunday
    {"name": "Dr. Methaphon", "schedule": "เสาร์ (2, 4) 09:00–18:00"},          # Saturday
    {"name": "Dr. Oranuch", "schedule": "พุธ 17:00–19:00 | เสาร์ (2) 10:00–18:00 | อาทิตย์ (4) 10:00–16:00"},
    {"name": "Dr. Supisara", "schedule": "เสาร์ (1, 3, 5) 09:00–18:00"},        # Saturday
    {"name": "Dr. Tewarit", "schedule": "เสาร์ (1, 3, 4, 5) 10:00–18:00 | อาทิตย์ (1) 09:00–16:00"},
    {"name": "Dr. Sirinthorn", "schedule": "พฤหัส–ศุกร์ 14:00–18:00"},          # Thu-Fri
]


def test_saturday_pediatric_dentists():
    names = {d["name"] for d in staff_working_on(PEDS, weekday=5)}  # Saturday
    assert names == {"Dr. Methaphon", "Dr. Oranuch", "Dr. Supisara", "Dr. Tewarit"}
    # The Q07 hallucination must NOT appear:
    assert "Dr. Aungsuma" not in names
    assert "Dr. Donhathai" not in names
    assert "Dr. Sirinthorn" not in names


def test_sunday_pediatric_dentists():
    names = {d["name"] for d in staff_working_on(PEDS, weekday=6)}  # Sunday
    assert "Dr. Aungsuma" in names
    assert "Dr. Donhathai" in names
    assert "Dr. Methaphon" not in names


def test_weekday_note_shows_week_constraint():
    rows = staff_working_on(PEDS, weekday=5)
    supisara = next(r for r in rows if r["name"] == "Dr. Supisara")
    assert "1" in supisara["weeks_note"] and "3" in supisara["weeks_note"]
