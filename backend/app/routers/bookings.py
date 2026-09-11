import logging
import inspect
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends
from app.core.security import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/bookings", tags=["bookings"])


class BookingCreateRequest(BaseModel):
    """Versioned public booking contract.

    ``start_at`` may be a timezone-aware ISO-8601 value. A naive value is
    interpreted using the tenant's configured timezone by booking_service.
    ``service_id``/``staff_id`` accept the current name identifiers while the
    data migration introduces stable IDs.
    """

    customer_name: str = Field(..., min_length=1, max_length=200)
    phone_number: str = Field(..., min_length=7, max_length=40)
    email: str = Field(..., min_length=3, max_length=320)
    service_id: str = Field(..., min_length=1, max_length=200)
    start_at: str = Field(..., min_length=10, max_length=80)
    staff_id: str = Field(default="", max_length=200)
    timezone: str = Field(default="", max_length=80)
    availability_token: str = Field(default="", max_length=512)
    idempotency_key: str = Field(default="", max_length=200)

# Keep the helper definition at module level so test monkeypatch works.
# Returns the async adapter's coroutine directly — the routes' isawaitable branch
# awaits it on the running loop (the old sync wrapper called run_until_complete
# inside uvicorn's loop → "This event loop is already running" → 500).
def _load_bookings():
    from app.core.db import db_load_bookings
    return db_load_bookings()


async def _resolve_service_and_staff(tenant_id: str, body: BookingCreateRequest) -> tuple[str, str | None, str]:
    from app.core.db import db_load_profile
    from app.services.booking_service import _tenant_timezone

    profile = await db_load_profile(tenant_id) or {}
    services = profile.get("services", []) or []
    requested_service = body.service_id.strip().lower()
    service = next(
        (
            item for item in services
            if str(item.get("id") or item.get("service_id") or item.get("name") or "").strip().lower()
            == requested_service
            or str(item.get("name") or "").strip().lower() == requested_service
        ),
        None,
    )
    # Keep compatibility with existing profiles that have no generated service
    # IDs, but never let a client choose a different tenant's service object.
    service_topic = str((service or {}).get("name") or body.service_id).strip()

    requested_staff = body.staff_id.strip()
    staff_name = None
    if requested_staff:
        for member in profile.get("staff", []) or []:
            member_id = str(member.get("id") or member.get("staff_id") or "").strip()
            member_name = str(member.get("name") or "").strip()
            if requested_staff.lower() in {member_id.lower(), member_name.lower()}:
                staff_name = member_name
                break
        if staff_name is None:
            raise HTTPException(status_code=400, detail="Unknown staff_id for this tenant")

    configured_timezone = _tenant_timezone(profile)
    if body.timezone.strip() and body.timezone.strip() != configured_timezone:
        raise HTTPException(
            status_code=400,
            detail="timezone must match the tenant configured timezone",
        )
    return service_topic, staff_name, configured_timezone


@router.post("", status_code=201)
async def create_booking_endpoint(
    body: BookingCreateRequest,
    tenant_id: str = Depends(get_current_tenant),
):
    """Create one tenant-scoped booking through the v2 correctness boundary."""
    from app.services.booking_service import (
        _booking_idempotency_response,
        check_booking_availability,
        create_booking,
        find_booking_by_idempotency,
    )

    service_topic, staff_name, configured_timezone = await _resolve_service_and_staff(tenant_id, body)
    idempotency_key = body.idempotency_key.strip() or None
    if idempotency_key:
        existing = await find_booking_by_idempotency(tenant_id, idempotency_key)
        if existing:
            result = _booking_idempotency_response(existing)
            result["timezone"] = configured_timezone
            return result

    availability_token = body.availability_token.strip() or None
    if not availability_token:
        availability = await check_booking_availability(
            body.start_at,
            tenant_id=tenant_id,
            staff_name=staff_name,
            service_topic=service_topic,
        )
        if not availability.get("available"):
            raise HTTPException(status_code=409, detail=availability)
        availability_token = availability.get("availability_token")

    result = await create_booking(
        customer_name=body.customer_name.strip(),
        phone_number=body.phone_number.strip(),
        email=body.email.strip().lower(),
        service_topic=service_topic,
        booking_datetime=body.start_at,
        tenant_id=tenant_id,
        staff_name=staff_name,
        idempotency_key=idempotency_key,
        availability_token=availability_token,
    )
    if result.get("status") != "success":
        raise HTTPException(status_code=409, detail=result)
    result["timezone"] = configured_timezone
    return result

@router.get("")
async def list_bookings(tenant_id: str = Depends(get_current_tenant)):
    """
    Retrieves all bookings for the AUTHENTICATED tenant (derived from the token,
    never from a client-supplied parameter).
    """
    try:
        # Call _load_bookings (might be monkeypatched synchronously in unit tests)
        res = _load_bookings()
        if inspect.isawaitable(res):
            bookings = await res
        else:
            bookings = res
            
        # Filter by tenant
        tenant_bookings = [b for b in bookings if b.get("tenant_id") == tenant_id]
        # Sort bookings by date/time ascending
        tenant_bookings.sort(key=lambda x: x.get("booking_datetime", ""))
        return tenant_bookings
    except Exception as e:
        logger.error(f"Failed to retrieve bookings: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve bookings list.")

@router.delete("/{booking_id}")
async def cancel_booking(booking_id: str, tenant_id: str = Depends(get_current_tenant)):
    """
    Cancels and deletes a booking by its ID, scoped to the AUTHENTICATED tenant.
    """
    try:
        # Check if _load_bookings is monkeypatched or regular
        res = _load_bookings()
        if inspect.isawaitable(res):
            bookings = await res
        else:
            bookings = res

        # Verify the booking exists AND belongs to this tenant before deleting.
        owned = next(
            (b for b in bookings
             if b.get("booking_id") == booking_id and b.get("tenant_id") == tenant_id),
            None,
        )
        if owned is None:
            raise HTTPException(status_code=404, detail="Booking not found.")

        logger.info("Cancelling tenant booking %s", booking_id)

        # Targeted delete by id (never a full-list rewrite that could clobber others).
        from app.core.db import db_delete_booking
        del_res = db_delete_booking(booking_id, tenant_id=tenant_id)
        if inspect.isawaitable(del_res):
            await del_res
        return {"status": "success", "message": f"Successfully cancelled booking: {booking_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel booking {booking_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not process cancellation.")
