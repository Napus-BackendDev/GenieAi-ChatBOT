"""
Deterministic parser for Thai staff work-schedule strings.

The LLM cannot reliably reason over strings like
"เสาร์ (สัปดาห์ที่ 4) 13:00–17:00 | อาทิตย์ (1, 3) 09:00–16:00"
(it confuses เสาร์/อาทิตย์ and can't evaluate the week-of-month pattern), so both
the booking flow and the chat "who works on day X" answers compute availability
here instead of asking the model.

Schedule grammar (as produced by the extractor / stored in StaffItem.schedule):
  - Multiple shifts separated by '|'.
  - Each shift: <day(s)> [ (<weeks>) ] [ <HH:MM–HH:MM> ]
  - day(s): a single Thai day ("เสาร์"), or an inclusive range ("พฤหัส–อาทิตย์").
  - weeks: "(1, 3, 5)" or "(สัปดาห์ที่ 2, 4)" = the 1st/3rd/… occurrence of that
    weekday in the month (nth-weekday, not ISO calendar week).
  - "โปรดสอบถามคลินิก" / empty => schedule unknown (never auto-booked).
"""
import re
from datetime import datetime, date, time
from typing import Optional

# Thai day name -> Python weekday index (Monday=0 .. Sunday=6), matching date.weekday().
_DAY_TO_IDX = {
    "จันทร์": 0,
    "อังคาร": 1,
    "พุธ": 2,
    "พฤหัสบดี": 3,
    "พฤหัส": 3,
    "ศุกร์": 4,
    "เสาร์": 5,
    "อาทิตย์": 6,
}
_IDX_TO_DAY = {0: "จันทร์", 1: "อังคาร", 2: "พุธ", 3: "พฤหัส", 4: "ศุกร์", 5: "เสาร์", 6: "อาทิตย์"}

# Longer names first so "พฤหัสบดี" is matched before "พฤหัส".
_DAY_ALT = "|".join(sorted(_DAY_TO_IDX.keys(), key=len, reverse=True))
_DASH = r"[–—\-~]"
_RANGE_RE = re.compile(rf"({_DAY_ALT})\s*{_DASH}\s*({_DAY_ALT})")
_TIME_RE = re.compile(r"(\d{1,2}:\d{2})\s*" + _DASH + r"\s*(\d{1,2}:\d{2})(?:\s*/\s*(\d{1,2}:\d{2}))?")
_WEEK_PAREN_RE = re.compile(r"\(([^)]*)\)")

UNKNOWN_MARKERS = ("สอบถาม", "ask clinic", "inquire")


def _nth_weekday_of_month(d: date) -> int:
    """Which occurrence of this weekday in the month (1st, 2nd, ...). e.g. the 4th Saturday -> 4."""
    return (d.day - 1) // 7 + 1


def _expand_day_range(a_idx: int, b_idx: int) -> set:
    """Inclusive Mon..Sun range, wrapping if end precedes start (e.g. ศุกร์–จันทร์)."""
    days, i = set(), a_idx
    for _ in range(7):
        days.add(i)
        if i == b_idx:
            break
        i = (i + 1) % 7
    return days


def _parse_time(part: str):
    m = _TIME_RE.search(part)
    if not m:
        return None, None, ""
    start = m.group(1)
    end = m.group(3) or m.group(2)  # "16:00/18:00" -> take the later end (lenient)
    hours = m.group(0)
    try:
        st = time(*map(int, start.split(":")))
        en = time(*map(int, end.split(":")))
    except ValueError:
        return None, None, hours
    return st, en, hours


def parse_schedule(schedule_str: str) -> list:
    """
    Parse a schedule string into a list of shift dicts:
      {days: set[int], weeks: set[int] | None, start: time|None, end: time|None, hours: str}
    Returns [] when the schedule is empty or 'ask the clinic' (unknown).
    """
    if not schedule_str:
        return []
    low = schedule_str.lower()
    if any(mk in low for mk in UNKNOWN_MARKERS):
        return []

    shifts = []
    for part in schedule_str.split("|"):
        part = part.strip()
        if not part:
            continue

        # Weeks constraint from "(...)" — keep only the numeric occurrences.
        weeks = None
        for paren in _WEEK_PAREN_RE.findall(part):
            nums = re.findall(r"\d+", paren)
            if nums:
                weeks = {int(n) for n in nums}
                break

        # Days: prefer an explicit range, else every day name mentioned.
        days = set()
        rng = _RANGE_RE.search(part)
        if rng:
            days = _expand_day_range(_DAY_TO_IDX[rng.group(1)], _DAY_TO_IDX[rng.group(2)])
        else:
            for name, idx in _DAY_TO_IDX.items():
                if name in part:
                    days.add(idx)
        if not days:
            continue

        st, en, hours = _parse_time(part)
        shifts.append({"days": days, "weeks": weeks, "start": st, "end": en, "hours": hours})
    return shifts


def is_on_duty(schedule_str: str, when: datetime) -> tuple:
    """
    Is this staff member on duty on the given date? Returns (bool, hours_str).
    Week-of-month constraints are honoured; time-of-day is NOT checked here
    (use covers_datetime for that).
    """
    wd = when.weekday()
    nth = _nth_weekday_of_month(when.date() if isinstance(when, datetime) else when)
    for sh in parse_schedule(schedule_str):
        if wd in sh["days"] and (sh["weeks"] is None or nth in sh["weeks"]):
            return True, sh["hours"]
    return False, ""


def covers_datetime(schedule_str: str, when: datetime) -> bool:
    """
    True if the staff works that day AND the time falls within a matching shift's hours.
    Shifts with no parsed time are treated as covering the whole day (lenient).
    """
    wd = when.weekday()
    nth = _nth_weekday_of_month(when.date())
    t = when.time()
    for sh in parse_schedule(schedule_str):
        if wd not in sh["days"]:
            continue
        if sh["weeks"] is not None and nth not in sh["weeks"]:
            continue
        if sh["start"] is None or sh["end"] is None:
            return True
        if sh["start"] <= t <= sh["end"]:
            return True
    return False


def _thai_day_to_idx(text: str) -> Optional[int]:
    for name, idx in _DAY_TO_IDX.items():
        if name in text:
            return idx
    return None


def resolve_day(day_str: str) -> tuple:
    """
    Turn a free-form 'day' argument into (weekday, on_date).
    - An ISO date (or a string containing YYYY-MM-DD) -> (None, date).
    - A Thai weekday name -> (weekday_index, None).
    - Unrecognised -> (None, None).
    """
    s = (day_str or "").strip()
    if not s:
        return None, None
    try:
        return None, (datetime.fromisoformat(s).date() if "T" in s else date.fromisoformat(s))
    except ValueError:
        pass
    m = re.search(r"\d{4}-\d{2}-\d{2}", s)
    if m:
        try:
            return None, date.fromisoformat(m.group(0))
        except ValueError:
            pass
    return _thai_day_to_idx(s), None


def staff_working_on(staff_list: list, *, weekday: Optional[int] = None, on_date: Optional[date] = None) -> list:
    """
    Return the staff working on a given day, as [{name, role, hours, weeks_note}].
    - on_date: exact date (applies week-of-month filter).
    - weekday: a bare weekday (0=Mon..6=Sun) => any week that weekday, with a note
      describing week constraints (used when the customer names a day, not a date).
    """
    if on_date is not None:
        weekday = on_date.weekday()
        nth = _nth_weekday_of_month(on_date)
    else:
        nth = None

    out = []
    for s in staff_list or []:
        for sh in parse_schedule(s.get("schedule", "")):
            if weekday not in sh["days"]:
                continue
            if nth is not None and sh["weeks"] is not None and nth not in sh["weeks"]:
                continue
            note = ""
            if nth is None and sh["weeks"]:
                note = "สัปดาห์ที่ " + ", ".join(str(w) for w in sorted(sh["weeks"]))
            out.append({
                "name": s.get("name", ""),
                "role": s.get("role", ""),
                "specialties": s.get("specialties", []) or [],
                "hours": sh["hours"],
                "weeks_note": note,
            })
            break  # one entry per staff member is enough
    return out
