import logging
from fastapi import APIRouter, HTTPException, Depends
from app.services.booking_service import _load_bookings, _save_bookings, booking_file_lock
from app.core.security import get_current_tenant

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/bookings", tags=["bookings"])

@router.get("")
async def list_bookings(tenant_id: str = Depends(get_current_tenant)):
    """
    Retrieves all bookings for the AUTHENTICATED tenant (derived from the token,
    never from a client-supplied parameter).
    """
    try:
        bookings = _load_bookings()
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
    with booking_file_lock:
        try:
            bookings = _load_bookings()
            new_bookings = []
            found = False
            
            for b in bookings:
                if b.get("booking_id") == booking_id and b.get("tenant_id") == tenant_id:
                    found = True
                    logger.info(f"Cancelling booking {booking_id} for customer {b.get('customer_name')}")
                    continue
                new_bookings.append(b)
                
            if not found:
                raise HTTPException(status_code=404, detail="Booking not found.")
                
            _save_bookings(new_bookings)
            return {"status": "success", "message": f"Successfully cancelled booking: {booking_id}"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to cancel booking {booking_id}: {e}")
            raise HTTPException(status_code=500, detail="Could not process cancellation.")
