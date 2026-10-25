"""Failure-mode behaviour: OpenAI down/slow/429, quota exhausted, Redis down, suspended tenant, web chat."""
import asyncio
import httpx
from harness import *  # noqa
import app.services.openai_service as oai
import openai as _openai
oai.openai = _openai
import app.core.redis as redis_mod

LINE_A = {"secret": "secret-R-0123456789abcdef", "bot": "UbotRRRR000000000000000000000000"}


async def wait_reply(x, t, text, uid, secs=25):
    sent.clear()
    r, _ = await x.line(t, LINE_A, text, uid=uid)
    for _ in range(secs):
        await asyncio.sleep(1)
        if sent:
            await asyncio.sleep(1)
            break
    return r, " | ".join(texts())


async def main(x):
    c = x.c
    t, h = await x.signup("resil@example.test")
    await x.seed(t, h, line=LINE_A)
    orig_create = oai.openai_client.chat.completions.create
    req = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")

    for label, exc in (
        ("timeout", oai.openai.APITimeoutError(request=req)),
        ("rate limit 429", oai.openai.RateLimitError("rate", response=httpx.Response(429, request=req), body=None)),
        ("server error 500", oai.openai.InternalServerError("boom", response=httpx.Response(500, request=req), body=None)),
    ):
        async def boom(*a, _e=exc, **k):
            raise _e
        oai.openai_client.chat.completions.create = boom
        r, a = await wait_reply(x, t, "ขูดหินปูนราคาเท่าไหร่", f"Ur-{label[:4]}")
        check(f"LINE: OpenAI {label} -> webhook 200 and customer still gets a message", r.status_code == 200 and len(a) > 0, a[:140])
        check(f"LINE: OpenAI {label} -> no stack trace/secret in message", "Traceback" not in a and "sk-" not in a and "openai" not in a.lower(), a[:140])
        rs = await c.post("/api/chat", headers=h, json={"user_message": "ราคา", "session_id": "s-" + label[:4]})
        check(f"sandbox: OpenAI {label} -> controlled response (<500)", rs.status_code < 500, f"{rs.status_code} {rs.text[:100]}")
    oai.openai_client.chat.completions.create = orig_create

    # --- quota exhausted for this tenant
    from app.core.redis import get_redis
    from app.services.ai_budget import _day_key
    await get_redis().set(f"ai:budget:tenant:{t}:{_day_key()}", "99999999")
    r, a = await wait_reply(x, t, "สวัสดี", "Ur-quota")
    check("LINE: quota exhausted -> friendly fallback to customer", r.status_code == 200 and len(a) > 0 and "quota" not in a.lower(), a[:140])
    ru = await c.get("/api/tenant/ai-usage", headers=h)
    check("dashboard: ai-usage endpoint works", ru.status_code == 200, f"{ru.status_code} {ru.text[:100]}")
    await get_redis().delete(f"ai:budget:tenant:{t}:{_day_key()}")
    r, a = await wait_reply(x, t, "สวัสดี", "Ur-quota2")
    check("LINE: bot recovers after quota reset", len(a) > 0 and "ครบโควตา" not in a, a[:120])

    # --- Redis down
    real_get = redis_mod.get_redis

    def dead():
        raise RuntimeWarning("redis down")
    redis_mod.get_redis = dead
    import app.core.redis
    rs = await c.get("/health/ready"); check("health: reports not_ready/503 when Redis down (or 200 degraded)", rs.status_code in (200, 503), rs.status_code)
    rs = await c.get("/api/chat/sessions", headers=h); check("inbox: Redis down -> no 500 crash", rs.status_code < 500, f"{rs.status_code} {rs.text[:80]}")
    rs = await c.get("/api/bookings", headers=h); check("bookings list: works without Redis", rs.status_code == 200, rs.status_code)
    rs = await c.get(f"/api/tenant/profile/{t}", headers=h); check("profile read: works without Redis", rs.status_code == 200, rs.status_code)
    redis_mod.get_redis = real_get

    # --- suspended tenant
    from app.core.db import db_set_tenant_status
    await db_set_tenant_status(t, "locked")
    r, _ = await x.line(t, LINE_A, "hi", uid="Ur-lock")
    check("LINE: locked tenant webhook ignored (no AI spend)", r.status_code == 200 and "ignored" in r.text, r.text[:100])
    rs = await c.get(f"/api/tenant/profile/{t}", headers=h)
    check("locked tenant: dashboard API refused", rs.status_code in (401, 403), rs.status_code)
    await db_set_tenant_status(t, "active")

    # --- web chat widget
    t2, h2 = await x.signup("webchat@example.test"); await x.seed(t2, h2)
    rs = await c.get(f"/api/tenant/profile/{t2}/settings", headers=h2); st = rs.json() if rs.status_code == 200 else {}
    print("  webchat settings keys:", list(st.keys())[:12])
    rs = await c.post("/api/webhooks/web", json={"session_id": "w1", "message": "ราคาขูดหินปูน", "token": "bad"})
    check("web chat: invalid token rejected", rs.status_code in (401, 403), f"{rs.status_code} {rs.text[:100]}")


if __name__ == "__main__":
    asyncio.run(run(main))
