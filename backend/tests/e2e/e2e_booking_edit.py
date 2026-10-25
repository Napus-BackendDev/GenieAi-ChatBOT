"""Booking rules + data-editing workflow (deterministic, no OpenAI)."""
import asyncio
from harness import *  # noqa


async def main(x):
    c = x.c
    t, h = await x.signup("book@example.test")
    await x.seed(t, h)
    sm = "ทพ.สมชาย"
    mon = next_weekday(0, 10)

    def body(start, staff=sm, service="ขูดหินปูน", phone="0812345678", email="a@example.com", **kw):
        return {"customer_name": "สมชาย ใจดี", "phone_number": phone, "email": email, "service_id": service,
                "start_at": iso(start), "staff_id": staff, **kw}

    async def book(b, hh=None):
        return await c.post("/api/bookings", headers=hh or h, json=b)

    r = await book(body(mon)); check("book: success on duty slot", r.status_code == 201, f"{r.status_code} {r.text[:120]}")
    bid = r.json().get("booking_id") if r.status_code == 201 else None
    r = await c.get("/api/bookings", headers=h); check("book: listed for tenant", r.status_code == 200 and len(r.json()) == 1, r.status_code)
    r = await book(body(mon)); check("book: same slot same staff -> 409 slot_taken", r.status_code == 409 and "slot_taken" in r.text, r.status_code)
    r = await book(body(mon + timedelta(minutes=15), email="b@example.com")); check("book: overlap inside 30m window -> 409", r.status_code == 409, r.status_code)
    r = await book(body(mon + timedelta(minutes=30), email="c@example.com")); check("book: next free slot (30m later) ok", r.status_code == 201, f"{r.status_code} {r.text[:100]}")
    r = await book(body(datetime.now() - timedelta(days=1))); check("book: past date -> 409 past_date", r.status_code == 409 and "past_date" in r.text, r.status_code)
    r = await book(body(datetime.now() + timedelta(minutes=10))); check("book: under lead time -> 409", r.status_code == 409 and "under_lead_time" in r.text, f"{r.status_code} {r.text[:80]}")
    sun = next_weekday(6, 10); r = await book(body(sun)); check("book: staff off duty (Sunday) -> 409 staff_off_duty", r.status_code == 409 and "staff_off_duty" in r.text, f"{r.status_code} {r.text[:80]}")
    r = await book(body(mon.replace(hour=20))); check("book: after shift hours -> 409", r.status_code == 409, f"{r.status_code} {r.text[:80]}")
    r = await book(body(mon.replace(hour=11), staff="ไม่มีหมอคนนี้")); check("book: unknown staff -> 400", r.status_code == 400, r.status_code)
    r = await book(body(mon.replace(hour=11), phone="abcdefgh")); check("book: invalid phone rejected", r.status_code in (400, 409, 422), f"{r.status_code} {r.text[:80]}")
    r = await book(body(mon.replace(hour=11), email="not-an-email")); check("book: invalid email rejected", r.status_code in (400, 409, 422), f"{r.status_code} {r.text[:80]}")
    r = await book({**body(mon.replace(hour=11)), "start_at": "tomorrow afternoon"}); check("book: garbage datetime rejected", r.status_code in (400, 409, 422), r.status_code)
    r = await book({**body(mon.replace(hour=11)), "customer_name": ""}); check("book: empty name -> 422", r.status_code == 422, r.status_code)
    r = await book({**body(mon.replace(hour=11)), "timezone": "America/New_York"}); check("book: wrong timezone -> 400", r.status_code == 400, r.status_code)

    k = body(mon.replace(hour=14), email="idem@example.com", idempotency_key="idem-1")
    r1, r2 = await book(k), await book(k)
    check("book: idempotency key replays same booking", r1.status_code == 201 and r2.status_code in (200, 201) and r1.json().get("booking_id") == r2.json().get("booking_id"), f"{r1.status_code}/{r2.status_code}")

    slot = mon.replace(hour=15)
    rs = await asyncio.gather(*[book(body(slot, email=f"r{i}@example.com")) for i in range(8)])
    wins = sum(1 for r in rs if r.status_code == 201)
    check("book: 8 concurrent same-slot requests -> exactly 1 success", wins == 1, f"wins={wins} codes={[r.status_code for r in rs]}")

    r = await c.delete(f"/api/bookings/{bid}", headers=h); check("cancel: owner can cancel", r.status_code == 200, r.status_code)
    r = await c.delete(f"/api/bookings/{bid}", headers=h); check("cancel: twice -> 404", r.status_code == 404, r.status_code)
    r = await book(body(mon)); check("book: slot free again after cancel", r.status_code == 201, f"{r.status_code} {r.text[:100]}")

    t2, h2 = await x.signup("book2@example.test"); await x.seed(t2, h2)
    r = await c.get("/api/bookings", headers=h2); check("isolation: B sees no bookings", r.status_code == 200 and r.json() == [], r.status_code)
    new_id = (await c.get("/api/bookings", headers=h)).json()[0]["booking_id"]
    r = await c.delete(f"/api/bookings/{new_id}", headers=h2); check("isolation: B cannot cancel A's booking", r.status_code == 404, r.status_code)
    r = await book(body(mon), h2); check("isolation: tenant B can book same slot as A", r.status_code == 201, f"{r.status_code} {r.text[:100]}")

    # ---- data editing workflow
    r = await c.get(f"/api/tenant/profile/{t}", headers=h); p = r.json(); p = p.get("profile", p)
    check("edit: profile round-trips services/staff/promos/faq", len(p["services"]) == 2 and len(p["staff"]) == 2 and len(p["promotions"]) == 1 and len(p["faq"]) == 1, {k: len(p[k]) for k in ("services", "staff", "promotions", "faq")})
    p["services"].append({"name": "จัดฟัน", "price": "30,000", "duration": 45}); p["services"][0]["price"] = "900"
    r = await c.post(f"/api/tenant/profile/{t}", headers=h, json=p); check("edit: save changed profile", r.status_code == 200, f"{r.status_code} {r.text[:150]}")
    r = await c.get(f"/api/tenant/profile/{t}/services", headers=h); sv = r.json(); sv = sv.get("services", sv)
    check("edit: services endpoint reflects change", any(s["name"] == "จัดฟัน" for s in sv) and any(s["price"] == "900" for s in sv), len(sv))
    r = await c.post(f"/api/tenant/profile/{t}/services", headers=h, json={"services": [{"name": "A", "price": "1", "duration": 30}]}); check("edit: replace services list", r.status_code == 200, f"{r.status_code} {r.text[:100]}")
    r = await c.post(f"/api/tenant/profile/{t}/services", headers=h, json={"services": [{"name": "", "price": "1", "duration": 30}]}); check("edit: empty service name rejected", r.status_code == 422, r.status_code)
    r = await c.post(f"/api/tenant/profile/{t}/services", headers=h, json={"services": [{"name": "X", "price": "1", "duration": 1}]}); check("edit: duration < 5 rejected", r.status_code == 422, r.status_code)
    r = await c.post(f"/api/tenant/profile/{t}/services", headers=h, json={"services": [{"name": "x" * 5000, "price": "1", "duration": 30}]}); check("edit: oversized field rejected", r.status_code == 422, r.status_code)
    r = await c.post(f"/api/tenant/profile/{t}/staff", headers=h, json={"staff": [{"name": "ทพ.ใหม่", "role": "x", "specialties": [], "schedule": "จันทร์ 09:00-12:00"}]}); check("edit: replace staff", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    r = await c.get(f"/api/tenant/profile/{t}/staff", headers=h); check("edit: staff list reflects replace", r.status_code == 200 and "ทพ.ใหม่" in r.text and sm not in r.text, r.status_code)
    r = await c.post(f"/api/tenant/profile/{t}/promotions", headers=h, json={"promotions": []}); check("edit: clear promotions", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    r = await c.post(f"/api/tenant/profile/{t}/faq", headers=h, json={"faq": [{"question": "q", "answer": "a"}]}); check("edit: replace faq", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    r = await c.post(f"/api/tenant/profile/{t}/custom-rules", headers=h, json={"custom_rules": [{"category": "c", "rule": "r"}]}); check("edit: replace custom rules", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    r = await c.get(f"/api/tenant/profile/{t}/settings", headers=h); check("edit: settings readable", r.status_code == 200, r.status_code)
    r = await book(body(mon.replace(hour=13), staff=sm)); check("edit: removed staff can no longer be booked", r.status_code == 400, r.status_code)


if __name__ == "__main__":
    asyncio.run(run(main))
