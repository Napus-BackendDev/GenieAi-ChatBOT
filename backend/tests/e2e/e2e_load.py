"""Burst test: 20 customers message one LINE bot at once; all must be answered, no cross-talk (real OpenAI)."""
import asyncio, time
from harness import *  # noqa

LINE = {"secret": "secret-L-0123456789abcdef", "bot": "UbotLLLL000000000000000000000000"}
N = 20


async def main(x):
    t, h = await x.signup("load@example.test")
    await x.seed(t, h, line=LINE)
    sent.clear()
    t0 = time.time()
    rs = await asyncio.gather(*[x.line(t, LINE, f"สวัสดีค่ะ ขูดหินปูนราคาเท่าไหร่ (ลูกค้า {i})", uid=f"Uload{i:03d}") for i in range(N)])
    check(f"load: all {N} webhooks accepted fast (200)", all(r.status_code == 200 for r, _ in rs), [r.status_code for r, _ in rs][:5])
    for _ in range(90):
        await asyncio.sleep(1)
        if len(sent) >= N:
            break
    await asyncio.sleep(8)
    secs = time.time() - t0
    replied = len(sent)
    check(f"load: >= {N} replies sent within 95s", replied >= N, f"{replied} replies in {secs:.0f}s")
    joined = " ".join(texts())
    check("load: replies contain the price", joined.count("800") >= N // 2, joined.count("800"))
    sess = (await x.c.get("/api/chat/sessions", headers=h)).json()
    sess = sess.get("sessions", sess) if isinstance(sess, dict) else sess
    check(f"load: inbox has {N} separate conversations", len(sess) == N, len(sess))


if __name__ == "__main__":
    asyncio.run(run(main))
