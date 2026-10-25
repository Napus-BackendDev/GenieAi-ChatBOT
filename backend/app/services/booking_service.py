import re
import uuid
import logging
import asyncio
import hashlib
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.services import schedule as sched
from app.core.db import db_load_bookings, db_save_bookings, db_load_profile
from app.core.config import settings

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
    staff = await _load_tenant_staff(tenant_id)
    for s in staff:
        if _same_staff(s.get("name") or "", staff_name):
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


def _tenant_timezone(profile: dict) -> str:
    value = str(profile.get("timezone") or "").strip()
    try:
        ZoneInfo(value or "Asia/Bangkok")
        return value or "Asia/Bangkok"
    except ZoneInfoNotFoundError:
        return "Asia/Bangkok"


def _parse_booking_in_timezone(value: str, timezone_name: str) -> datetime:
    """Parse ISO input without discarding an explicit offset."""
    if not value or not isinstance(value, str):
        raise ValueError("booking datetime is required")
    raw = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(raw)
    zone = ZoneInfo(timezone_name)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=zone)
    return parsed.astimezone(zone)


def _booking_utc(value: str, timezone_name: str) -> datetime:
    return _parse_booking_in_timezone(value, timezone_name).astimezone(timezone.utc)


def _duration_for_service(profile: dict, service_topic: str) -> int:
    wanted = (service_topic or "").strip().lower()
    for service in profile.get("services", []) or []:
        name = str(service.get("name") or "").strip().lower()
        if name and (name == wanted or name in wanted or wanted in name):
            try:
                duration = int(service.get("duration") or 30)
                return max(5, min(duration, 24 * 60))
            except (TypeError, ValueError):
                break
    return 30

_STAFF_TITLE = re.compile(r"^(?:คุณหมอ|ทันตแพทย์หญิง|ทันตแพทย์|หมอ|ทพญ\.?|ทพ\.?|นพ\.?|พญ\.?|dr\.?|คุณ)\s*", re.IGNORECASE)


def _staff_core(name: str) -> str:
    core = (name or "").strip().lower()
    while True:
        stripped = _STAFF_TITLE.sub("", core, count=1).strip()
        if stripped == core:
            return core
        core = stripped


def _same_staff(a: str, b: str) -> bool:
    """Staff names reach us from the LLM ("หมอสมชาย") and the profile ("ทพ.สมชาย"); compare without titles."""
    a, b = _staff_core(a), _staff_core(b)
    return bool(a and b and (a == b or a in b or b in a))


def _find_conflict(
    bookings: list[dict],
    target_dt: datetime,
    tenant_id: str,
    staff_name: str,
    conflict_window_mins: int,
    duration_minutes: int = 30,
    timezone_name: str = "Asia/Bangkok",
) -> dict | None:
    target_start = target_dt.replace(tzinfo=ZoneInfo(timezone_name)).astimezone(timezone.utc)

    for booking in bookings:
        if booking.get("tenant_id") != tenant_id:
            continue

        if staff_name and booking.get("staff_name") and not _same_staff(booking.get("staff_name"), staff_name):
            continue

        try:
            raw_start = booking.get("start_at_utc") or booking.get("booking_datetime", "")
            if booking.get("start_at_utc"):
                booked_start = datetime.fromisoformat(
                    str(raw_start).replace("Z", "+00:00")
                ).astimezone(timezone.utc)
            else:
                booked_start = _booking_utc(raw_start, timezone_name)
            booked_duration = int(booking.get("duration_minutes") or 30)
        except ValueError:
            continue

        # Keep the configured start-time buffer while also preventing long
        # services from overlapping merely because their starts are apart.
        effective_window = max(
            1, int(conflict_window_mins), int(duration_minutes), booked_duration
        )
        if abs((target_start - booked_start).total_seconds()) < effective_window * 60:
            return booking

    return None

def _select_available_staff(
    staff: list[dict],
    bookings: list[dict],
    target_dt: datetime,
    tenant_id: str,
    conflict_window_mins: int,
    duration_minutes: int = 30,
    timezone_name: str = "Asia/Bangkok",
) -> dict | None:
    for member in staff:
        name = (member.get("name") or "").strip()
        if name and sched.covers_datetime(member.get("schedule") or "", target_dt) and not _find_conflict(
            bookings,
            target_dt,
            tenant_id,
            name,
            conflict_window_mins,
            duration_minutes,
            timezone_name,
        ):
            return member
    return None

async def _load_booking_settings(tenant_id: str) -> dict:
    conflict_window = _DEFAULT_CONFLICT_WINDOW_MINS
    min_lead_time = _DEFAULT_MIN_LEAD_TIME_HOURS

    profile = await db_load_profile(tenant_id)
    timezone_name = _tenant_timezone(profile or {})
    if profile:
        bs = profile.get("booking_settings") or {}
        cw = bs.get("conflict_window_mins")
        if isinstance(cw, (int, float)) and cw > 0:
            conflict_window = int(cw)
        lt = bs.get("min_lead_time_hours")
        if isinstance(lt, (int, float)) and lt >= 0:
            min_lead_time = lt

    return {
        "conflict_window_mins": conflict_window,
        "min_lead_time_hours": min_lead_time,
        "timezone": timezone_name,
    }


async def _issue_availability_token(
    tenant_id: str,
    booking_datetime: str,
    staff_name: str,
    service_topic: str = "",
) -> str | None:
    """Issue a short-lived capability for the exact availability result."""
    import json
    import secrets
    from app.core.redis import get_redis

    token = secrets.token_urlsafe(32)
    try:
        await get_redis().set(
            f"booking:availability:{token}",
            json.dumps({
                "tenant_id": tenant_id,
                "booking_datetime": booking_datetime,
                "staff_name": staff_name,
                "service_topic": service_topic or "",
            }),
            ex=300,
        )
        return token
    except Exception as exc:
        if settings.is_production:
            logger.error("Booking capability store unavailable: %s", type(exc).__name__)
            return None
        return token


async def _consume_availability_token(
    token: str,
    tenant_id: str,
    booking_datetime: str,
    staff_name: str | None,
    service_topic: str = "",
) -> tuple[bool, str | None]:
    import json
    from app.core.redis import get_redis

    try:
        raw = await get_redis().getdel(f"booking:availability:{token}")
        if not raw:
            return False, None
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        data = json.loads(raw)
        if data.get("tenant_id") != tenant_id or data.get("booking_datetime") != booking_datetime:
            return False, None
        if service_topic and data.get("service_topic") and data.get("service_topic") != service_topic:
            return False, None
        token_staff = data.get("staff_name")
        if staff_name and token_staff and not _same_staff(staff_name, token_staff):
            return False, None
        return True, token_staff
    except Exception as exc:
        logger.warning("Booking capability validation failed: %s", type(exc).__name__)
        return False, None

async def check_booking_availability(
    booking_datetime: str,
    tenant_id: str = "default",
    staff_name: str = None,
    service_topic: str = None,
    issue_token: bool = True,
) -> dict:
    try:
        booking_settings = await _load_booking_settings(tenant_id)
        timezone_name = booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE)
        target_dt = _parse_booking_in_timezone(booking_datetime, timezone_name).replace(tzinfo=None)
    except ValueError as e:
        logger.error("Invalid booking datetime received: %s", type(e).__name__)
        return {"available": False, "message": "รูปแบบวันเวลาไม่ถูกต้อง กรุณาใช้ ISO format เช่น YYYY-MM-DDTHH:MM:SS"}

    conflict_window_mins = booking_settings["conflict_window_mins"]
    min_lead_time_hours = booking_settings["min_lead_time_hours"]

    timezone_name = booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE)
    profile = await db_load_profile(tenant_id) or {}
    duration_minutes = _duration_for_service(profile, service_topic or "")
    now = datetime.now(ZoneInfo(timezone_name)).replace(tzinfo=None)
    if target_dt <= now:
        return {"available": False, "reason": "past_date", "message": "ไม่สามารถจองเวลาที่ผ่านมาแล้วได้"}

    if target_dt < now + timedelta(hours=min_lead_time_hours):
        lead_display = int(min_lead_time_hours) if float(min_lead_time_hours).is_integer() else min_lead_time_hours
        return {"available": False, "reason": "under_lead_time", "message": f"กรุณาจองล่วงหน้าอย่างน้อย {lead_display} ชั่วโมง"}

    staff_name = staff_name.strip() if staff_name and staff_name.strip() else None
    if staff_name:
        staff = await _find_staff(tenant_id, staff_name)
        if staff and staff.get("name"):
            staff_name = staff["name"]  # canonical profile name, so conflicts/tokens compare the same string
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
        if not staff_name:
            staff = _select_available_staff(
                await _load_tenant_staff(tenant_id),
                bookings,
                target_dt,
                tenant_id,
                conflict_window_mins,
                duration_minutes,
                timezone_name,
            )
            if not staff:
                return {
                    "available": False,
                    "reason": "no_staff_available",
                    "message": "ขออภัยค่ะ ไม่มีแพทย์ที่ออกตรวจและว่างในเวลานี้ กรุณาเลือกเวลาอื่นนะคะ",
                }
            staff_name = staff["name"]
        conflict = _find_conflict(
            bookings,
            target_dt,
            tenant_id,
            staff_name,
            conflict_window_mins,
            duration_minutes,
            timezone_name,
        )

    if conflict is not None:
        try:
            b_dt = _parse_booking_in_timezone(
                conflict.get("booking_datetime", ""), timezone_name
            ).replace(tzinfo=None)
            formatted_time = f"{b_dt.strftime('%d/%m/%Y')} เวลา {b_dt.strftime('%H:%M')}"
        except ValueError:
            formatted_time = conflict.get("booking_datetime", "")
        staff_info = f" กับ {conflict.get('staff_name')}" if conflict.get("staff_name") else ""
        return {
            "available": False,
            "reason": "slot_taken",
            "message": f"ขออภัยค่ะ วันและเวลาดังกล่าวมีผู้อื่นจองแล้ว ({formatted_time}){staff_info} กรุณาเลือกเวลาอื่นที่ห่างกันอย่างน้อย {conflict_window_mins} นาที"
        }

    availability_token = (
        await _issue_availability_token(
            tenant_id, booking_datetime, staff_name, service_topic or ""
        )
        if issue_token
        else None
    )
    if settings.is_production and not availability_token:
        return {
            "available": False,
            "reason": "availability_guard_unavailable",
            "message": "ระบบตรวจสอบสิทธิ์การจองขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งค่ะ",
        }
    return {
        "available": True,
        "staff_name": staff_name,
        "availability_token": availability_token,
        "message": "ช่วงเวลานี้ว่างและสามารถจองนัดหมายได้ค่ะ",
    }


async def _reserve_mongo_booking_slots(
    tenant_id: str,
    staff_name: str,
    start_utc: datetime,
    duration_minutes: int,
    booking_id: str,
    session=None,
) -> bool:
    """Reserve unique five-minute slots; unique index protects multiple workers."""
    from app.core.mongodb import get_mongo_db

    db = get_mongo_db()
    if db is None:
        return True
    slot_count = max(1, (int(duration_minutes) + 4) // 5)
    slots = [
        {
            "tenant_id": tenant_id,
            "staff_name": staff_name,
            "slot_start_utc": start_utc + timedelta(minutes=index * 5),
            "booking_id": booking_id,
        }
        for index in range(slot_count)
    ]
    try:
        await db.booking_slot_locks.insert_many(slots, ordered=True, session=session)
        return True
    except Exception as exc:
        # DuplicateKeyError is the expected contention result. Remove any
        # partial inserts from this attempt before returning a clean refusal.
        await db.booking_slot_locks.delete_many({"booking_id": booking_id}, session=session)
        if exc.__class__.__name__ == "DuplicateKeyError":
            return False
        raise


def _booking_idempotency_response(existing: dict) -> dict:
    return {
        "status": "success",
        "booking_id": existing.get("booking_id"),
        "staff_name": existing.get("staff_name"),
        "start_at_utc": existing.get("start_at_utc"),
        "end_at_utc": existing.get("end_at_utc"),
        "local_start": existing.get("booking_datetime"),
        "timezone": existing.get("timezone", settings.DEFAULT_TENANT_TIMEZONE),
        "message": "ระบบได้ลงทะเบียนการนัดหมายของคุณเรียบร้อยแล้วค่ะ",
    }


async def find_booking_by_idempotency(tenant_id: str, idempotency_key: str) -> dict | None:
    if not idempotency_key:
        return None
    from app.core.mongodb import get_mongo_db

    mongo_db = get_mongo_db()
    if mongo_db is not None:
        return await mongo_db.bookings.find_one({
            "tenant_id": tenant_id,
            "idempotency_key": idempotency_key,
        })
    return next(
        (
            item for item in await db_load_bookings()
            if item.get("tenant_id") == tenant_id
            and item.get("idempotency_key") == idempotency_key
        ),
        None,
    )


async def create_booking(
    customer_name: str,
    phone_number: str,
    email: str,
    service_topic: str,
    booking_datetime: str,
    tenant_id: str = "default",
    staff_name: str = None,
    idempotency_key: str = None,
    availability_token: str = None,
) -> dict:
    if not _is_valid_email(email):
        return {"status": "error", "message": "อีเมลไม่ถูกต้องค่ะ รบกวนขออีเมลที่ถูกต้องอีกครั้ง (เช่น name@example.com)"}
    if not _is_valid_phone(phone_number):
        return {"status": "error", "message": "เบอร์โทรศัพท์ไม่ถูกต้องค่ะ รบกวนขอเบอร์โทรศัพท์ที่ติดต่อได้อีกครั้งนะคะ"}

    capability_staff = None
    if availability_token and not idempotency_key:
        # A capability token is single-use, but a provider/network retry after
        # a committed booking must still return the original result instead of
        # creating a second appointment.
        idempotency_key = "cap:" + hashlib.sha256(availability_token.encode("utf-8")).hexdigest()

    if idempotency_key:
        existing = await find_booking_by_idempotency(tenant_id, idempotency_key)
        if existing:
            return _booking_idempotency_response(existing)

    # Check an explicit idempotency key before requiring a capability token so
    # a client retry after a committed response is safe even if the original
    # one-time token was not persisted by the client.
    if settings.is_production and not availability_token:
        return {
            "status": "error",
            "reason": "availability_token_required",
            "message": "ต้องตรวจสอบช่วงเวลาว่างก่อนยืนยันการจองค่ะ",
        }

    if availability_token:
        valid_capability, capability_staff = await _consume_availability_token(
            availability_token,
            tenant_id,
            booking_datetime,
            staff_name,
            service_topic,
        )
        if settings.is_production and not valid_capability:
            return {
                "status": "error",
                "reason": "availability_token_invalid",
                "message": "สิทธิ์การจองหมดอายุหรือไม่ตรงกับช่วงเวลาที่ตรวจสอบ กรุณาตรวจสอบใหม่ค่ะ",
            }
        if capability_staff and not staff_name:
            staff_name = capability_staff

    staff_name = staff_name.strip() if staff_name and staff_name.strip() else None
    auto_assign = staff_name is None
    avail_status = await check_booking_availability(
        booking_datetime,
        tenant_id,
        staff_name,
        service_topic=service_topic,
        issue_token=False,
    )
    if not avail_status["available"]:
        return {
            "status": "error",
            **({"reason": avail_status["reason"]} if avail_status.get("reason") else {}),
            "message": avail_status["message"],
        }
    staff_name = avail_status.get("staff_name") or staff_name

    try:
        booking_settings = await _load_booking_settings(tenant_id)
        timezone_name = booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE)
        target_dt = _parse_booking_in_timezone(booking_datetime, timezone_name).replace(tzinfo=None)
    except ValueError:
        return {"status": "error", "message": "รูปแบบวันเวลาไม่ถูกต้อง"}

    conflict_window_mins = booking_settings["conflict_window_mins"]
    profile = await db_load_profile(tenant_id) or {}
    duration_minutes = _duration_for_service(profile, service_topic)
    staff = await _load_tenant_staff(tenant_id) if auto_assign else []
    selected_staff_record = await _find_staff(tenant_id, staff_name) if staff_name else {}

    async with booking_file_lock:
        bookings = await db_load_bookings()
        conflict = _find_conflict(
            bookings,
            target_dt,
            tenant_id,
            staff_name,
            conflict_window_mins,
            duration_minutes,
            booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE),
        )
        if conflict is not None and auto_assign:
            selected = _select_available_staff(
                staff,
                bookings,
                target_dt,
                tenant_id,
                conflict_window_mins,
                duration_minutes,
                timezone_name,
            )
            if not selected:
                return {
                    "status": "error",
                    "reason": "no_staff_available",
                    "message": "ขออภัยค่ะ ไม่มีแพทย์ที่ออกตรวจและว่างในเวลานี้ กรุณาเลือกเวลาอื่นนะคะ",
                }
            staff_name = selected["name"]
            conflict = None
        if conflict is not None:
            try:
                b_dt = _parse_booking_in_timezone(
                    conflict.get("booking_datetime", ""), timezone_name
                ).replace(tzinfo=None)
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
            "start_at_utc": _booking_utc(booking_datetime, booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE)).isoformat().replace("+00:00", "Z"),
            "end_at_utc": (_booking_utc(booking_datetime, booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE)) + timedelta(minutes=duration_minutes)).isoformat().replace("+00:00", "Z"),
            "timezone": booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE),
            "duration_minutes": duration_minutes,
            "idempotency_key": idempotency_key or str(uuid.uuid4()),
            "staff_id": selected_staff_record.get("id") or selected_staff_record.get("staff_id") or staff_name,
            "staff_name": staff_name,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }

        from app.core.mongodb import get_mongo_db
        mongo_db = get_mongo_db()
        if mongo_db is not None:
            if idempotency_key:
                existing = await mongo_db.bookings.find_one({
                    "tenant_id": tenant_id,
                    "idempotency_key": idempotency_key,
                })
                if existing:
                    return {
                        "status": "success",
                        "booking_id": existing.get("booking_id"),
                        "staff_name": existing.get("staff_name"),
                        "start_at_utc": existing.get("start_at_utc"),
                        "end_at_utc": existing.get("end_at_utc"),
                        "local_start": existing.get("booking_datetime"),
                        "timezone": existing.get("timezone", settings.DEFAULT_TENANT_TIMEZONE),
                        "message": "ระบบได้ลงทะเบียนการนัดหมายของคุณเรียบร้อยแล้วค่ะ",
                    }

            # Slot locks and the booking row commit together on Atlas/replica set.
            # This is the correctness boundary across multiple backend instances.
            try:
                async with await mongo_db.client.start_session() as session:
                    async with session.start_transaction():
                        reserved = await _reserve_mongo_booking_slots(
                            tenant_id,
                            staff_name or "",
                            _booking_utc(booking_datetime, booking_settings.get("timezone", settings.DEFAULT_TENANT_TIMEZONE)),
                            duration_minutes,
                            new_booking["booking_id"],
                            session=session,
                        )
                        if not reserved:
                            return {
                                "status": "error",
                                "reason": "slot_taken",
                                "message": "ขออภัยค่ะ วันและเวลาดังกล่าวมีผู้อื่นจองแล้ว กรุณาเลือกเวลาอื่นนะคะ",
                            }
                        await mongo_db.bookings.insert_one(new_booking, session=session)
            except Exception as exc:
                if exc.__class__.__name__ == "DuplicateKeyError" and idempotency_key:
                    existing = await mongo_db.bookings.find_one({
                        "tenant_id": tenant_id,
                        "idempotency_key": idempotency_key,
                    })
                    if existing:
                        return {
                            "status": "success",
                            "booking_id": existing.get("booking_id"),
                            "staff_name": existing.get("staff_name"),
                            "start_at_utc": existing.get("start_at_utc"),
                            "end_at_utc": existing.get("end_at_utc"),
                            "local_start": existing.get("booking_datetime"),
                            "timezone": existing.get("timezone", settings.DEFAULT_TENANT_TIMEZONE),
                            "message": "ระบบได้ลงทะเบียนการนัดหมายของคุณเรียบร้อยแล้วค่ะ",
                        }
                raise
        else:
            bookings.append(new_booking)
            await db_save_bookings(bookings)

    formatted_date = target_dt.strftime("%d/%m/%Y")
    formatted_time = target_dt.strftime("%H:%M")

    logger.info("Created booking %s for tenant %s with staff %s", new_booking["booking_id"], tenant_id, staff_name)

    staff_msg = f" (แพทย์: {staff_name})" if staff_name else ""
    return {
        "status": "success",
        "booking_id": new_booking["booking_id"],
        "staff_name": staff_name,
        "start_at_utc": new_booking["start_at_utc"],
        "end_at_utc": new_booking["end_at_utc"],
        "local_start": new_booking["booking_datetime"],
        "timezone": new_booking["timezone"],
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
