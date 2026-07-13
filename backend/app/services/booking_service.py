import os
import re
import json
import uuid
import logging
import threading
from datetime import datetime, timedelta
from app.core.config import settings
from app.services import schedule as sched

logger = logging.getLogger(__name__)
booking_file_lock = threading.Lock()

# Lightweight, LLM-independent contact validation. Booking creation only happens
# through AI function-calling, so the model is the ONLY thing between a customer's
# typo and the stored record — and it lets malformed values through (observed:
# email "not-an-email" was persisted). These are the last line of defence so a
# booking never lands with contact info the clinic can't actually use to reach the
# customer. Kept deliberately permissive (format sanity, not deliverability).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _is_valid_email(email: str) -> bool:
    """True if `email` looks like local@domain.tld (basic shape check, not RFC-strict)."""
    return bool(email) and bool(_EMAIL_RE.match(email.strip()))


def _is_valid_phone(phone: str) -> bool:
    """True if `phone` carries a plausible number of digits (Thai numbers are 9-10).

    Allows +, spaces, dashes and parentheses as formatting; only the digit count
    matters. Rejects text like 'abc' or an empty/blank value.
    """
    if not phone:
        return False
    digits = re.sub(r"\D", "", phone)
    return 9 <= len(digits) <= 15


def _load_tenant_staff(tenant_id: str) -> list:
    """Read a tenant's staff list from its profile JSON (or [] if missing)."""
    profile_path = f"data/tenant_profile_{tenant_id}.json"
    if not os.path.exists(profile_path):
        return []
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            return json.load(f).get("staff", []) or []
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"Could not read staff for tenant {tenant_id}: {e}")
        return []


def _find_staff(tenant_id: str, staff_name: str) -> dict:
    """Fuzzy-match a staff record by name ('Dr. Jarinda' <-> 'Dr. Jarinda Thaisangsa-nga')."""
    if not staff_name:
        return {}
    want = staff_name.strip().lower()
    for s in _load_tenant_staff(tenant_id):
        nm = (s.get("name") or "").strip().lower()
        if nm and (nm == want or nm in want or want in nm):
            return s
    return {}


def get_staff_on_duty_sync(day: str, tenant_id: str = "default", specialty: str = None) -> dict:
    """
    Deterministically list which staff work on a given day/date, so the AI never
    has to reason over raw schedule strings. `day` is a Thai weekday name or an
    ISO date; `specialty` optionally filters by a role/specialty/name keyword.
    """
    staff = _load_tenant_staff(tenant_id)
    if not staff:
        return {"day": day, "on_duty": [], "note": "ร้านนี้ยังไม่มีข้อมูลตารางพนักงานในระบบ"}

    weekday, on_date = sched.resolve_day(day)
    if weekday is None and on_date is None:
        return {"day": day, "on_duty": [],
                "note": "ไม่เข้าใจวันที่ระบุ กรุณาระบุชื่อวัน (เช่น เสาร์) หรือวันที่แบบ YYYY-MM-DD"}

    rows = sched.staff_working_on(staff, weekday=weekday, on_date=on_date)

    if specialty:
        kw = specialty.strip().lower()
        filtered = [r for r in rows
                    if kw in (r.get("role") or "").lower()
                    or kw in " ".join(r.get("specialties") or []).lower()
                    or kw in (r.get("name") or "").lower()]
        # Only narrow when the filter actually matched something; otherwise the
        # profile simply lacks specialty tags — return all on-duty staff instead
        # of a misleading empty list.
        if filtered:
            rows = filtered

    return {"day": day, "on_duty": rows, "count": len(rows)}

def _load_bookings() -> list[dict]:
    """
    Load bookings from JSON file. Initializes the file if it does not exist.
    """
    file_path = settings.BOOKINGS_JSON_PATH
    
    # Ensure data directory exists
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        return []
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        logger.error(f"Bookings file {file_path} is corrupted. Resetting.")
        return []
    except Exception as e:
        logger.error(f"Error loading bookings: {e}")
        return []

def _save_bookings(bookings: list[dict]) -> None:
    """
    Save bookings list to JSON file.
    """
    file_path = settings.BOOKINGS_JSON_PATH
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(bookings, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving bookings to {file_path}: {e}")

# Graceful defaults used when a tenant has no booking_settings saved.
_DEFAULT_CONFLICT_WINDOW_MINS = 30
_DEFAULT_MIN_LEAD_TIME_HOURS = 2


def _parse_booking_dt(s: str) -> datetime:
    """Parse an ISO datetime string to a NAIVE (tz-stripped, local-wall-clock) datetime.

    The old cleaner did `.replace("Z","").split("+")[0]`, which handled `Z` and a
    positive `+HH:MM` offset but NOT a negative `-HH:MM` one — a value like
    `2027-01-01T10:00:00-05:00` slipped through offset-aware and then blew up with a
    TypeError when compared to a naive `datetime.now()`. Here we normalise a trailing
    `Z` to `+00:00`, parse with `fromisoformat`, and drop any tzinfo so every downstream
    comparison stays naive. Raises ValueError on genuinely malformed input (callers
    catch it and return the standard "invalid datetime" error).
    """
    if s and s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


def _find_conflict(
    bookings: list[dict],
    target_dt: datetime,
    tenant_id: str,
    staff_name: str,
    conflict_window_mins: int,
) -> dict | None:
    """Pure, NON-locking conflict detection over an already-loaded bookings list.

    Returns the first booking that collides with `target_dt` for this tenant (and
    staff, when specified) inside the tenant's conflict window, or None if the slot is
    free. Kept lock-free so it can be called both from the availability check (under
    its own lock) and from the create path's single write-lock block — re-acquiring
    `booking_file_lock` here would deadlock (threading.Lock is not reentrant).
    """
    window_edge = max(conflict_window_mins - 1, 0)
    start_conflict = target_dt - timedelta(minutes=window_edge)
    end_conflict = target_dt + timedelta(minutes=window_edge)

    for booking in bookings:
        # Only check for the same tenant
        if booking.get("tenant_id") != tenant_id:
            continue

        # If staff_name is provided, only check conflict if the booking matches the same staff.
        # If either booking has no staff, we still check it (to be safe/backwards compatible).
        if staff_name and booking.get("staff_name") and booking.get("staff_name") != staff_name:
            continue

        try:
            b_dt = _parse_booking_dt(booking.get("booking_datetime", ""))
        except ValueError:
            continue

        if start_conflict <= b_dt <= end_conflict:
            return booking

    return None

def _load_booking_settings(tenant_id: str) -> dict:
    """
    Load the tenant's booking_settings from data/tenant_profile_{tenant_id}.json.
    Falls back to defaults (conflict_window_mins=30, min_lead_time_hours=2) if the
    file / section / values are missing or invalid, so bookings never break on a
    misconfigured profile.

    ponytail: profile JSON is read inline here (single small read) to keep tenant
    isolation local to this service; if a shared cached profile loader lands later,
    swap this for it.
    """
    conflict_window = _DEFAULT_CONFLICT_WINDOW_MINS
    min_lead_time = _DEFAULT_MIN_LEAD_TIME_HOURS

    profile_path = f"data/tenant_profile_{tenant_id}.json"
    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                profile = json.load(f)
            bs = profile.get("booking_settings") or {}
            # Coerce and validate; ignore non-positive / non-numeric overrides.
            cw = bs.get("conflict_window_mins")
            if isinstance(cw, (int, float)) and cw > 0:
                conflict_window = int(cw)
            lt = bs.get("min_lead_time_hours")
            if isinstance(lt, (int, float)) and lt >= 0:
                min_lead_time = lt
        except (json.JSONDecodeError, OSError) as e:
            logger.error(f"Could not read booking_settings for tenant {tenant_id}: {e}. Using defaults.")

    return {"conflict_window_mins": conflict_window, "min_lead_time_hours": min_lead_time}

def check_booking_availability_sync(booking_datetime: str, tenant_id: str = "default", staff_name: str = None) -> dict:
    """
    Checks if a slot is available: not in the past, respects the tenant's minimum
    lead time, and has no conflicting booking within the tenant's conflict window
    for the same staff member.
    """
    try:
        # Parse target booking time (naive; handles Z and ±HH:MM offsets).
        target_dt = _parse_booking_dt(booking_datetime)
    except ValueError as e:
        logger.error(f"Invalid datetime format received: {booking_datetime}. Error: {e}")
        return {"available": False, "message": "รูปแบบวันเวลาไม่ถูกต้อง กรุณาใช้ ISO format เช่น YYYY-MM-DDTHH:MM:SS"}

    # Load per-tenant booking rules (with graceful defaults).
    booking_settings = _load_booking_settings(tenant_id)
    conflict_window_mins = booking_settings["conflict_window_mins"]
    min_lead_time_hours = booking_settings["min_lead_time_hours"]

    # Reject bookings in the past (compare in local naive time to match parsed input).
    now = datetime.now()
    if target_dt <= now:
        return {"available": False, "reason": "past_date", "message": "ไม่สามารถจองเวลาที่ผ่านมาแล้วได้"}

    # Enforce minimum lead time.
    if target_dt < now + timedelta(hours=min_lead_time_hours):
        # Show a clean number (drop trailing .0 for whole hours).
        lead_display = int(min_lead_time_hours) if float(min_lead_time_hours).is_integer() else min_lead_time_hours
        return {"available": False, "reason": "under_lead_time", "message": f"กรุณาจองล่วงหน้าอย่างน้อย {lead_display} ชั่วโมง"}

    # Validate the requested staff member actually works that day/time. Only blocks
    # when the schedule is KNOWN and does not cover the slot (unknown/blank schedules
    # are left to the clinic). This prevents booking a doctor on a day they are off.
    if staff_name:
        staff = _find_staff(tenant_id, staff_name)
        staff_schedule = staff.get("schedule", "") if staff else ""
        if staff_schedule and sched.parse_schedule(staff_schedule) and not sched.covers_datetime(staff_schedule, target_dt):
            return {
                "available": False,
                "reason": "staff_off_duty",
                "message": (
                    f"คุณหมอ {staff.get('name', staff_name)} ไม่ได้ออกตรวจในวันและเวลาที่เลือกค่ะ "
                    f"ตารางออกตรวจของคุณหมอคือ: {staff_schedule} "
                    f"รบกวนเลือกวัน/เวลาที่คุณหมอออกตรวจ หรือให้ช่วยแนะนำแพทย์ท่านอื่นที่ออกตรวจในวันนั้นแทนนะคะ"
                ),
            }

    with booking_file_lock:
        bookings = _load_bookings()
        conflict = _find_conflict(bookings, target_dt, tenant_id, staff_name, conflict_window_mins)

    if conflict is not None:
        try:
            b_dt = _parse_booking_dt(conflict.get("booking_datetime", ""))
            formatted_time = f"{b_dt.strftime('%d/%m/%Y')} เวลา {b_dt.strftime('%H:%M')}"
        except ValueError:
            formatted_time = conflict.get("booking_datetime", "")
        staff_info = f" กับ {conflict.get('staff_name')}" if conflict.get("staff_name") else ""
        return {
            "available": False,
            "reason": "slot_taken",
            "message": f"ขออภัยค่ะ วันและเวลาดังกล่าวมีผู้อื่นจองแล้ว ({formatted_time}){staff_info} กรุณาเลือกเวลาอื่นที่ห่างกันอย่างน้อย {conflict_window_mins} นาที"
        }

    return {"available": True, "message": "ช่วงเวลานี้ว่างและสามารถจองนัดหมายได้ค่ะ"}

def create_booking_sync(
    customer_name: str,
    phone_number: str,
    email: str,
    service_topic: str,
    booking_datetime: str,
    tenant_id: str = "default",
    staff_name: str = None
) -> dict:
    """
    Creates a new booking if the slot is available.
    """
    # 0. Validate contact info BEFORE anything else. The AI is unreliable at this
    # (it forwarded "not-an-email" verbatim), so reject malformed values here and
    # return an error the AI relays so it re-asks the customer.
    if not _is_valid_email(email):
        return {"status": "error", "message": "อีเมลไม่ถูกต้องค่ะ รบกวนขออีเมลที่ถูกต้องอีกครั้ง (เช่น name@example.com)"}
    if not _is_valid_phone(phone_number):
        return {"status": "error", "message": "เบอร์โทรศัพท์ไม่ถูกต้องค่ะ รบกวนขอเบอร์โทรศัพท์ที่ติดต่อได้อีกครั้งนะคะ"}

    # 1. Pre-flight, non-conflict checks (past/lead-time/staff-schedule) run OUTSIDE the
    # write lock — they don't need it, and check_booking_availability_sync acquires the
    # lock itself, so calling it here then re-acquiring below is safe (threading.Lock is
    # NOT reentrant; nesting would deadlock). Its conflict verdict is advisory only — the
    # authoritative, race-free conflict check happens inside the single write-lock block.
    avail_status = check_booking_availability_sync(booking_datetime, tenant_id, staff_name)
    if not avail_status["available"]:
        return {"status": "error", "message": avail_status["message"]}

    try:
        target_dt = _parse_booking_dt(booking_datetime)
    except ValueError:
        return {"status": "error", "message": "รูปแบบวันเวลาไม่ถูกต้อง"}

    # Conflict window for the authoritative re-check under the write lock.
    conflict_window_mins = _load_booking_settings(tenant_id)["conflict_window_mins"]

    # 2. Single critical section: load → re-check conflict → append → save, all under one
    # lock hold so two concurrent bookings for the same slot cannot both slip through
    # (TOCTOU fix — the earlier availability call released the lock before we got here).
    with booking_file_lock:
        bookings = _load_bookings()

        conflict = _find_conflict(bookings, target_dt, tenant_id, staff_name, conflict_window_mins)
        if conflict is not None:
            try:
                b_dt = _parse_booking_dt(conflict.get("booking_datetime", ""))
                formatted_time = f"{b_dt.strftime('%d/%m/%Y')} เวลา {b_dt.strftime('%H:%M')}"
            except ValueError:
                formatted_time = conflict.get("booking_datetime", "")
            staff_info = f" กับ {conflict.get('staff_name')}" if conflict.get("staff_name") else ""
            return {
                "status": "error",
                "message": f"ขออภัยค่ะ วันและเวลาดังกล่าวมีผู้อื่นจองแล้ว ({formatted_time}){staff_info} กรุณาเลือกเวลาอื่นที่ห่างกันอย่างน้อย {conflict_window_mins} นาที"
            }

        new_booking = {
            "booking_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "customer_name": customer_name,
            "phone_number": phone_number,
            "email": email,
            "service_topic": service_topic,
            "booking_datetime": booking_datetime,
            "staff_name": staff_name,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }

        bookings.append(new_booking)
        _save_bookings(bookings)

    formatted_date = target_dt.strftime("%d/%m/%Y")
    formatted_time = target_dt.strftime("%H:%M")

    logger.info(f"Created new booking {new_booking['booking_id']} for {customer_name} with staff {staff_name}")

    staff_msg = f" (แพทย์: {staff_name})" if staff_name else ""
    return {
        "status": "success",
        "booking_id": new_booking["booking_id"],
        "message": f"ระบบได้ลงทะเบียนการนัดหมายของคุณเรียบร้อยแล้วค่ะ: \n📌 คุณ: {customer_name}\n📌 เรื่อง: {service_topic}{staff_msg}\n📅 วันที่: {formatted_date}\n⏰ เวลา: {formatted_time} น."
    }
