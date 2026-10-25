"""Shared harness for the e2e scripts (run directly, NOT collected by pytest).

Runs the real FastAPI app in-process against throw-away data: no Mongo, a local
Redis on :6390, a temp working dir, real OpenAI (only the suites that need it).
Start Redis first:  redis-server --port 6390 --save "" --appendonly no
"""
import os, sys, tempfile, asyncio, time, json, hmac, hashlib, base64
from datetime import datetime, timedelta

os.environ.update(MONGODB_URI="", REDIS_URL=os.environ.get("E2E_REDIS_URL", "redis://127.0.0.1:6390/0"),
                  ENVIRONMENT="development", ALLOW_LOCAL_DATA_FALLBACK="true", ALLOW_MOCK_LOGIN="false",
                  AI_TENANT_DAILY_TOKEN_CAP="5000000", AI_TENANT_DAILY_REQUEST_CAP="5000")
WORK = tempfile.mkdtemp(prefix="genie-e2e-")
os.chdir(WORK)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import httpx  # noqa: E402
from app.main import app  # noqa: E402
from app.core.redis import init_redis  # noqa: E402
import app.routers.webhooks as wh  # noqa: E402
import app.routers.chat as chat_mod  # noqa: E402

results: list[tuple[str, bool]] = []


def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra not in ("", None) else ""), flush=True)


sent: list[tuple[str, list]] = []  # captured outgoing LINE messages


async def _reply(reply_token, messages, access_token=None, fallback_user_id=None):
    sent.append(("reply", messages))


async def _push(user_id, messages, access_token=None):
    sent.append(("push", messages))


async def _noop(*a, **k):
    return None


async def _profile(user_id, tenant_id):
    return {"displayName": "ลูกค้าทดสอบ"}


wh.reply_to_line, wh.push_to_line, wh.show_line_loading = _reply, _push, _noop
chat_mod.get_line_user_profile = _profile
if hasattr(wh, "get_line_user_profile"):
    wh.get_line_user_profile = _profile


def texts():
    out = []
    for _kind, ms in sent:
        for m in ms:
            out.append(m["text"] if m.get("type") == "text" else f"<{m.get('type')}>")
    return out


def future(days=2, hour=10, minute=0):
    return (datetime.now() + timedelta(days=days)).replace(hour=hour, minute=minute, second=0, microsecond=0)


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%S")


def next_weekday(weekday, hour=10):
    """Next date (>= 2 days ahead) falling on weekday (Mon=0)."""
    d = future(2, hour)
    while d.weekday() != weekday:
        d += timedelta(days=1)
    return d


SEED = {
    "company_name": "คลินิกทดสอบ",
    "business_hours": "จันทร์-เสาร์ 09:00-18:00",
    "contact_number": "02-000-0000",
    "services": [
        {"name": "ขูดหินปูน", "price": "800", "duration": 30},
        {"name": "ฟอกสีฟัน", "price": "5,000 - 7,000", "duration": 60},
    ],
    "staff": [
        {"name": "ทพ.สมชาย", "role": "ทันตแพทย์ทั่วไป", "specialties": [], "schedule": "จันทร์-ศุกร์ 09:00-17:00"},
        {"name": "ทพญ.สมหญิง", "role": "ทันตแพทย์จัดฟัน", "specialties": [], "schedule": "เสาร์ (สัปดาห์ 2,4) 09:00-12:00"},
    ],
    "promotions": [{"name": "โปรขูดหินปูน", "description": "ลด 20%", "discount": "20%", "valid_until": "", "conditions": "ลูกค้าใหม่"}],
    "faq": [{"question": "จอดรถได้ไหม", "answer": "มีที่จอดรถฟรีชั้น B1 ค่ะ"}],
}


class Ctx:
    def __init__(self, c):
        self.c = c

    async def signup(self, email, password="E2e-Pass-12345!"):
        r = await self.c.post("/api/auth/signup", json={"email": email, "password": password})
        self.c.cookies.clear()
        if r.status_code != 200:
            raise RuntimeError(f"signup failed {r.status_code} {r.text[:200]}")
        j = r.json()
        return j["tenant_id"], {"Authorization": f"Bearer {j['access_token']}"}

    async def seed(self, tenant, h, extra=None, line=None):
        prof = {**SEED, **(extra or {})}
        r = await self.c.post(f"/api/tenant/profile/{tenant}", headers=h, json=prof)
        assert r.status_code == 200, r.text
        if line:
            from app.core.db import db_load_profile, db_save_profile
            p = await db_load_profile(tenant) or {}
            p.update(line_channel_secret=line["secret"], line_channel_access_token="tok-" + tenant,
                     line_bot_user_id=line["bot"], line_verified=True)
            p.setdefault("ai_settings", {})["humanize_mode"] = "off"
            await db_save_profile(tenant, p)

    async def line(self, tenant, line, text, uid="Uc1", eid=None, mtype="text"):
        msg = {"type": mtype, "id": str(time.time_ns())}
        if mtype == "text":
            msg["text"] = text
        else:
            msg.update(packageId="1", stickerId="1")
        ev = {"type": "message", "mode": "active", "webhookEventId": eid or f"ev-{time.time_ns()}",
              "replyToken": f"rt-{time.time_ns()}", "source": {"type": "user", "userId": uid},
              "timestamp": int(time.time() * 1000), "message": msg}
        b = json.dumps({"destination": line["bot"], "events": [ev]}).encode()
        sig = base64.b64encode(hmac.new(line["secret"].encode(), b, hashlib.sha256).digest()).decode()
        r = await self.c.post(f"/api/webhooks/line/{tenant}", content=b,
                              headers={"X-Line-Signature": sig, "content-type": "application/json"})
        return r, ev


async def run(main):
    client = await init_redis()
    try:
        await client.getdel("e2e:probe")
        needs_shim = False
    except Exception:
        needs_shim = True
    if needs_shim:
        # local test Redis (Windows build 3.0) predates GETDEL (6.2+); Upstash in production has it
        async def getdel(key):
            val = await client.get(key)
            await client.delete(key)
            return val
        client.getdel = getdel
    tr = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=tr, base_url="http://localhost:8000", timeout=300) as c:
        await main(Ctx(c))
    bad = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(bad)}/{len(results)} passed; failed={bad}")
    sys.exit(1 if bad else 0)
