"""Seed a realistic tenant (profile, bookings, LINE conversations) for manual/UI testing.

Run with E2E_WORKDIR=<dir> so a dev server started from the same dir sees the data:
  E2E_WORKDIR=/tmp/genie-ui python tests/e2e/e2e_seed_ui.py
Login afterwards: ui-seed@example.test / UiSeed-Pass-123!
"""
import asyncio
from harness import *  # noqa

LINE = {"secret": "secret-UI-0123456789abcdef", "bot": "UbotUUUU000000000000000000000000"}


async def main(x):
    c = x.c
    t, h = await x.signup("ui-seed@example.test", "UiSeed-Pass-123!")
    prof = dict(SEED)
    prof["services"] = SEED["services"] + [{"name": "จัดฟันเหล็ก", "price": "35,000 - 60,000", "duration": 45},
                                           {"name": "อุดฟัน", "price": "600 - 1,200", "duration": 30}]
    prof["staff"] = SEED["staff"] + [{"name": "ทพ.วิชัย", "role": "ทันตแพทย์รากฟันเทียม", "specialties": ["รากฟันเทียม"], "schedule": "อังคาร-พฤหัส 10:00-16:00"}]
    await x.seed(t, h, extra=prof, line=LINE)
    # questionnaire marks onboarding complete so the app opens the dashboard
    r = await c.post("/api/auth/questionnaire", headers=h, json={"tenant_id": t, "email": "ui-seed@example.test", "phone": "0812345678", "company_name": "คลินิกทดสอบ", "business_type": "คลินิกทันตกรรม"})
    print("questionnaire", r.status_code)
    for i, (days, hour, name, svc) in enumerate([(2, 10, "สมชาย ใจดี", "ขูดหินปูน"), (3, 11, "สมหญิง รักดี", "ฟอกสีฟัน"), (5, 14, "ปรีชา มั่นคง", "อุดฟัน"), (9, 10, "มานี มีสุข", "ขูดหินปูน")]):
        d = future(days, hour)
        while d.weekday() > 4:
            d += timedelta(days=1)
        r = await c.post("/api/bookings", headers=h, json={"customer_name": name, "phone_number": f"08{i}1234567", "email": f"c{i}@example.com", "service_id": svc, "start_at": iso(d), "staff_id": "ทพ.สมชาย" if svc != "อุดฟัน" else "ทพ.วิชัย"})
        print("booking", name, r.status_code, r.text[:80])
    for uid, msg in (("Ucust0001", "สวัสดีค่ะ ขูดหินปูนราคาเท่าไหร่"), ("Ucust0002", "จอดรถได้ไหมคะ"), ("Ucust0003", "มีโปรโมชั่นอะไรบ้าง")):
        sent.clear()
        await x.line(t, LINE, msg, uid=uid)
        for _ in range(40):
            await asyncio.sleep(1)
            if sent:
                await asyncio.sleep(2)
                break
        print("chat", uid, texts()[:1])
    print("SEEDED", t)


if __name__ == "__main__":
    asyncio.run(run(main))
