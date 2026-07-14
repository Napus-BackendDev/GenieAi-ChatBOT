import re
import uuid
import logging
import asyncio
from datetime import datetime, timedelta
from app.services import schedule as sched
from app.core.db import db_load_bookings, db_save_bookings, db_load_profile

logger = logging.getLogger(__name__)

# asyncio.Lock (not threading.Lock): these critical sections `await` the DB adapter,
# which yields the event loop when Mongo is enabled. A threading.Lock held across an
# await would block the loop thread and deadlock the whole server.
booking_file_lock = asyncio.Lock()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def _is_valid_email(email: str) -> bool:
    return bool(email) and bool(_EMAIL_RE.match(email.strip()))

def _is_valid_phone(phone: str) -> bool:
    if not phone:
        return False
    digits = re.sub(r"\D", "", phone)
    return 9 <= len(digits) <= 15

async def _load_tenant_staff(tenant_id: str) -> list:
    profile = await db_load_profile(tenant_id)
    return profile.get("staff", []) or []

async def _find_staff(tenant_id: str, staff_name: str) -> dict:
    if not staff_name:
        return {}
    want = staff_name.strip().lower()
    staff = await _load_tenant_staff(tenant_id)
    for s in staff:
        nm = (s.get("name") or "").strip().lower()
        if nm and (nm == want or nm in want or want in nm):
            return s
    return {}

async def get_staff_on_duty(day: str, tenant_id: str = "default", specialty: str = None) -> dict:
    staff = await _load_tenant_staff(tenant_id)
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
        if filtered:
            rows = filtered

    return {"day": day, "on_duty": rows, "count": len(rows)}

_DEFAULT_CONFLICT_WINDOW_MINS = 30
_DEFAULT_MIN_LEAD_TIME_HOURS = 2

def _parse_booking_dt(s: str) -> datetime:
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
    window_edge = max(conflict_window_mins - 1, 0)
    start_conflict = target_dt - timedelta(minutes=window_edge)
    end_conflict = target_dt + timedelta(minutes=window_edge)

    for booking in bookings:
        if booking.get("tenant_id") != tenant_id:
            continue

        if staff_name and booking.get("staff_name") and booking.get("staff_name") != staff_name:
            continue

        try:
            b_dt = _parse_booking_dt(booking.get("booking_datetime", ""))
        except ValueError:
            continue

        if start_conflict <= b_dt <= end_conflict:
            return booking

    return None

async def _load_booking_settings(tenant_id: str) -> dict:
    conflict_window = _DEFAULT_CONFLICT_WINDOW_MINS
    min_lead_time = _DEFAULT_MIN_LEAD_TIME_HOURS

    profile = await db_load_profile(tenant_id)
    if profile:
        bs = profile.get("booking_settings") or {}
        cw = bs.get("conflict_window_mins")
        if isinstance(cw, (int, float)) and cw > 0:
            conflict_window = int(cw)
        lt = bs.get("min_lead_time_hours")
        if isinstance(lt, (int, float)) and lt >= 0:
            min_lead_time = lt

    return {"conflict_window_mins": conflict_window, "min_lead_time_hours": min_lead_time}

async def check_booking_availability(booking_datetime: str, tenant_id: str = "default", staff_name: str = None) -> dict:
    try:
        target_dt = _parse_booking_dt(booking_datetime)
    except ValueError as e:
        logger.error(f"Invalid datetime format received: {booking_datetime}. Error: {e}")
        return {"available": False, "message": "รูปแบบวันเวลาไม่ถูกต้อง กรุณาใช้ ISO format เช่น YYYY-MM-DDTHH:MM:SS"}

    booking_settings = await _load_booking_settings(tenant_id)
    conflict_window_mins = booking_settings["conflict_window_mins"]
    min_lead_time_hours = booking_settings["min_lead_time_hours"]

    now = datetime.now()
    if target_dt <= now:
        return {"available": False, "reason": "past_date", "message": "ไม่สามารถจองเวลาที่ผ่านมาแล้วได้"}

    if target_dt < now + timedelta(hours=min_lead_time_hours):
        lead_display = int(min_lead_time_hours) if float(min_lead_time_hours).is_integer() else min_lead_time_hours
        return {"available": False, "reason": "under_lead_time", "message": f"กรุณาจองล่วงหน้าอย่างน้อย {lead_display} ชั่วโมง"}

    if staff_name:
        staff = await _find_staff(tenant_id, staff_name)
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

    async with booking_file_lock:
        bookings = await db_load_bookings()
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

async def create_booking(
    customer_name: str,
    phone_number: str,
    email: str,
    service_topic: str,
    booking_datetime: str,
    tenant_id: str = "default",
    staff_name: str = None
) -> dict:
    if not _is_valid_email(email):
        return {"status": "error", "message": "อีเมลไม่ถูกต้องค่ะ รบกวนขออีเมลที่ถูกต้องอีกครั้ง (เช่น name@example.com)"}
    if not _is_valid_phone(phone_number):
        return {"status": "error", "message": "เบอร์โทรศัพท์ไม่ถูกต้องค่ะ รบกวนขอเบอร์โทรศัพท์ที่ติดต่อได้อีกครั้งนะคะ"}

    avail_status = await check_booking_availability(booking_datetime, tenant_id, staff_name)
    if not avail_status["available"]:
        return {"status": "error", "message": avail_status["message"]}

    try:
        target_dt = _parse_booking_dt(booking_datetime)
    except ValueError:
        return {"status": "error", "message": "รูปแบบวันเวลาไม่ถูกต้อง"}

    booking_settings = await _load_booking_settings(tenant_id)
    conflict_window_mins = booking_settings["conflict_window_mins"]

    async with booking_file_lock:
        bookings = await db_load_bookings()
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
        await db_save_bookings(bookings)

    formatted_date = target_dt.strftime("%d/%m/%Y")
    formatted_time = target_dt.strftime("%H:%M")

    logger.info(f"Created new booking {new_booking['booking_id']} for {customer_name} with staff {staff_name}")

    staff_msg = f" (แพทย์: {staff_name})" if staff_name else ""
    return {
        "status": "success",
        "booking_id": new_booking["booking_id"],
        "message": f"ระบบได้ลงทะเบียนการนัดหมายของคุณเรียบร้อยแล้วค่ะ: \n📌 คุณ: {customer_name}\n📌 เรื่อง: {service_topic}{staff_msg}\n📅 วันที่: {formatted_date}\n⏰ เวลา: {formatted_time} น."
    }

# Sync helpers for backward compatibility in test suites
def _load_bookings() -> list[dict]:
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(db_load_bookings())

def _save_bookings(bookings: list[dict]) -> None:
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(db_save_bookings(bookings))

# Synchronous wrappers for test-suite backward compatibility
def get_staff_on_duty_sync(*args, **kwargs):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(get_staff_on_duty(*args, **kwargs))

def check_booking_availability_sync(*args, **kwargs):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(check_booking_availability(*args, **kwargs))

def create_booking_sync(*args, **kwargs):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(create_booking(*args, **kwargs))
