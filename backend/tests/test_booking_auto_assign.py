"""Regression tests for provider auto-assignment in booking tools."""
from app.services import booking_service


def _install_store(monkeypatch, staff, bookings=None):
    store = list(bookings or [])

    async def load_staff(_tenant_id):
        return staff

    async def load_bookings():
        return list(store)

    async def save_bookings(updated):
        store[:] = updated

    async def booking_settings(_tenant_id):
        return {"conflict_window_mins": 30, "min_lead_time_hours": 0}

    monkeypatch.setattr(booking_service, "_load_tenant_staff", load_staff)
    monkeypatch.setattr(booking_service, "db_load_bookings", load_bookings)
    monkeypatch.setattr(booking_service, "db_save_bookings", save_bookings)
    monkeypatch.setattr(booking_service, "_load_booking_settings", booking_settings)
    return store


def test_auto_assign_skips_busy_provider_and_persists_next(monkeypatch):
    target = "2099-01-03T14:00:00"
    staff = [
        {"name": "Dr. First", "schedule": "จันทร์–อาทิตย์ 09:00–17:00"},
        {"name": "Dr. Second", "schedule": "จันทร์–อาทิตย์ 09:00–17:00"},
    ]
    store = _install_store(monkeypatch, staff, [{
        "tenant_id": "clinic",
        "staff_name": "Dr. First",
        "booking_datetime": target,
    }])

    availability = booking_service.check_booking_availability_sync(target, tenant_id="clinic")
    assert availability["available"] is True
    assert availability["staff_name"] == "Dr. Second"

    created = booking_service.create_booking_sync(
        "Customer", "0812345678", "customer@example.com", "Filling", target,
        tenant_id="clinic",
    )
    assert created["status"] == "success"
    assert created["staff_name"] == "Dr. Second"
    assert store[-1]["staff_name"] == "Dr. Second"


def test_auto_assign_reports_when_every_on_duty_provider_is_busy(monkeypatch):
    target = "2099-01-03T14:00:00"
    staff = [{"name": "Dr. Only", "schedule": "จันทร์–อาทิตย์ 09:00–17:00"}]
    _install_store(monkeypatch, staff, [{
        "tenant_id": "clinic",
        "staff_name": "Dr. Only",
        "booking_datetime": target,
    }])

    availability = booking_service.check_booking_availability_sync(target, tenant_id="clinic")
    assert availability["available"] is False
    assert availability["reason"] == "no_staff_available"
    assert "เวลาอื่น" in availability["message"]

    created = booking_service.create_booking_sync(
        "Customer", "0812345678", "customer@example.com", "Filling", target,
        tenant_id="clinic",
    )
    assert created["status"] == "error"
    assert created["reason"] == "no_staff_available"
