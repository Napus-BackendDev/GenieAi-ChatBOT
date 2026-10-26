"""Booking through the LLM with production-strict capability tokens (E2E_STRICT=1, real OpenAI)."""
import asyncio
from harness import *  # noqa

LINE = {"secret": "secret-S-0123456789abcdef", "bot": "UbotSSSS000000000000000000000000"}


HEADERS = {}


async def say(x, t, text, uid, wait=60):
    # /api/chat runs the same chat_completion_with_tools pipeline as LINE but works in production mode without Mongo
    r = await x.c.post("/api/chat", headers=HEADERS, json={"user_message": text, "session_id": uid})
    return r, (r.json().get("ai_response", "") if r.status_code == 200 else r.text)


async def main(x):
    t, h = await x.signup("strict@example.test")
    await x.seed(t, h, line=LINE)
    HEADERS.update(h)
    mon = next_weekday(0, 10)
    when = f"วันจันทร์ที่ {mon.day}/{mon.month}/{mon.year} เวลา 10:00 น."
    # one-shot request with every detail (the case that failed on production)
    r, a = await say(x, t, f"จองคิวขูดหินปูน {when} กับหมอสมชาย ชื่อทดสอบ ระบบ เบอร์ 0800000000 อีเมล qa-test@example.com ยืนยันจองเลยค่ะ", "Ustrict1")
    bk = (await x.c.get("/api/bookings", headers=h)).json()
    check("strict: one-shot LLM booking creates the booking", len(bk) == 1, f"{len(bk)} bookings; reply={a[:160]}")
    # step-by-step conversation (check in one turn, create in a later turn)
    when2 = f"วันจันทร์ที่ {mon.day}/{mon.month}/{mon.year} เวลา 11:00 น."  # 10:00 is taken by the first booking
    r, a = await say(x, t, f"อยากจองคิวฟอกสีฟัน {when2} ค่ะ", "Ustrict2")
    r, a = await say(x, t, "ชื่อ สมใจ ทดสอบ เบอร์ 0811111111 อีเมล somjai-test@example.com ยืนยันค่ะ", "Ustrict2")
    bk = (await x.c.get("/api/bookings", headers=h)).json()
    check("strict: multi-turn LLM booking creates the booking", len(bk) == 2, f"{len(bk)} bookings; reply={a[:160]}")
    # same slot, other customer -> refused, never double-booked
    r, a = await say(x, t, f"จองคิวขูดหินปูน {when} กับหมอสมชาย ชื่อซ้ำ ทดสอบ เบอร์ 0822222222 อีเมล dup@example.com", "Ustrict3")
    bk = (await x.c.get("/api/bookings", headers=h)).json()
    check("strict: same slot never double-booked", len([b for b in bk if "ซ้ำ" in str(b)]) == 0, f"{len(bk)} bookings; reply={a[:160]}")


if __name__ == "__main__":
    asyncio.run(run(main))
