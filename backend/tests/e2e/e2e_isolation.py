import os, sys, asyncio, tempfile, json
os.environ.update(MONGODB_URI="", REDIS_URL="redis://127.0.0.1:1/0", ENVIRONMENT="development",
                  ALLOW_LOCAL_DATA_FALLBACK="true", ALLOW_MOCK_LOGIN="false")
work = tempfile.mkdtemp(prefix="genie-e2e-")
os.chdir(work)
sys.path.insert(0, r"C:\Users\asus\Desktop\Fastwork\GenieAI\backend")
import httpx
from app.main import app
from app.core.config import settings

results = []
def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

async def main():
    tr = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=tr, base_url="http://localhost:8000") as c:
        async def signup(email):
            r = await c.post("/api/auth/signup", json={"email": email, "password": "E2e-Test-Pass-123!"})
            return r
        ra, rb = await signup("e2e-a@example.test"), await signup("e2e-b@example.test")
        check("signup A/B", ra.status_code == 200 and rb.status_code == 200, f"{ra.status_code},{rb.status_code}")
        A, B = ra.json(), rb.json()
        ta, tb = A["tenant_id"], B["tenant_id"]
        check("distinct tenants", ta != tb)
        ha = {"Authorization": f"Bearer {A.get('access_token','')}"}
        hb = {"Authorization": f"Bearer {B.get('access_token','')}"}
        check("token returned (local)", A.get("access_token"))
        c.cookies.clear()

        g = lambda u, h: c.get(u, headers=h)
        r = await g(f"/api/tenant/profile/{ta}", ha); check("A reads own profile", r.status_code == 200, r.status_code)
        r = await g(f"/api/tenant/profile/{tb}", ha); check("A cannot read B profile", r.status_code == 403, r.status_code)
        r = await g(f"/api/tenant/profile/{tb}/staff", ha); check("A cannot read B staff", r.status_code == 403, r.status_code)
        r = await g(f"/api/bookings?tenant_id={tb}", ha); check("A cannot list B bookings via query", r.status_code in (403, 404) or (r.status_code == 200 and r.json() in ([], {"bookings": []}) ), r.status_code)
        r = await g(f"/api/chat/sessions?tenant_id={tb}", ha); check("chat sessions scoped to token tenant (query ignored)", r.status_code == 200 and tb not in r.text, r.status_code)
        r = await g("/api/documents", ha); check("A lists own documents", r.status_code == 200, r.status_code)
        r = await g(f"/api/documents?tenant_id={tb}", ha)
        check("documents tenant_id query ignored/denied", r.status_code in (200, 403) and (r.status_code == 403 or not r.json() or r.json() == [] or "documents" in str(r.json())), r.status_code)
        r = await c.put(f"/api/tenant/profile/{tb}", headers=ha, json={"company_name": "HACKED"}); check("A cannot write B profile (PUT)", r.status_code in (403, 404, 405), r.status_code)
        r = await c.post(f"/api/tenant/profile/{tb}", headers=ha, json={"company_name": "HACKED"}); check("A cannot write B profile (POST)", r.status_code in (403, 404, 405), r.status_code)
        from app.core.db import db_save_profile
        await db_save_profile(ta, {"company_name": "E2E A Co"}); await db_save_profile(tb, {"company_name": "E2E B Co"})
        rr = await c.post("/api/auth/reauthenticate", headers=ha, json={"provider": "credentials", "password": "E2e-Test-Pass-123!"})
        r = await c.request("DELETE", f"/api/tenant/profile/{tb}", headers=ha, json={"reauth_token": rr.json().get("reauth_token", "x"), "confirmation": "E2E B Co"})
        check("A (with valid reauth) cannot delete B", r.status_code in (401, 403), r.status_code)
        r = await c.delete(f"/api/tenant/profile/{tb}", headers=ha); check("delete without reauth refused", r.status_code == 428, r.status_code)
        r = await c.delete("/api/documents/not-mine", headers=ha); check("A delete foreign doc -> 403/404", r.status_code in (403, 404), r.status_code)
        r = await g(f"/api/tenant/profile/{tb}", hb); check("B profile intact, B reads own", r.status_code == 200 and r.json().get("company_name") != "HACKED", r.status_code)

        # token attacks
        import jwt, time
        forged = jwt.encode({"sub": tb, "iss": "genieai", "aud": "genieai-admin", "purpose": "admin", "exp": int(time.time()) + 600}, "wrong-secret-wrong-secret-wrong-secret", algorithm="HS256")
        r = await g(f"/api/tenant/profile/{tb}", {"Authorization": f"Bearer {forged}"}); check("forged-signature token rejected", r.status_code == 401, r.status_code)
        none_tok = jwt.encode({"sub": tb}, key=None, algorithm="none")
        r = await g(f"/api/tenant/profile/{tb}", {"Authorization": f"Bearer {none_tok}"}); check("alg=none token rejected", r.status_code == 401, r.status_code)
        r = await g(f"/api/tenant/profile/{ta}", {"Authorization": "Bearer garbage"}); check("garbage token rejected", r.status_code == 401, r.status_code)
        r = await g(f"/api/tenant/profile/{ta}", {}); check("no token rejected", r.status_code == 401, r.status_code)

        # login: wrong pw / unknown / no autocreate
        r = await c.post("/api/auth/login", json={"provider": "credentials", "email": "e2e-a@example.test", "password": "bad"}); check("wrong password 401", r.status_code == 401, r.status_code)
        r = await c.post("/api/auth/login", json={"provider": "credentials", "email": "ghost@example.test", "password": "whatever123"}); check("unknown email 401 (no autocreate)", r.status_code == 401, r.status_code)
        r = await c.post("/api/auth/login", json={"provider": "credentials", "email": "E2E-A@example.test ", "password": "E2e-Test-Pass-123!"}); check("login normalizes email", r.status_code == 200, r.status_code)
        r = await c.post("/api/auth/signup", json={"email": "e2e-c@example.test", "password": "short"}); check("weak password rejected on signup", r.status_code in (400, 422), r.status_code)

        # webhooks
        r = await c.post(f"/api/webhooks/line/{ta}", json={"events": []}, headers={"X-Line-Signature": "bad"}); check("LINE webhook unconfigured/bad sig rejected", r.status_code in (403, 404), r.status_code)
        r = await c.post("/api/webhooks/line", json={"events": []}); check("legacy LINE webhook closed", r.status_code in (404, 403) or settings.ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS, r.status_code)
        r = await c.post("/api/webhooks/facebook", json={"object": "page", "entry": []}); check("FB webhook unsigned rejected", r.status_code == 403, r.status_code)

        c.cookies.clear()
        for t, h, name in ((ta, ha, "E2E A Co"), (tb, hb, "E2E B Co")):
            rr = await c.post("/api/auth/reauthenticate", headers=h, json={"provider": "credentials", "password": "E2e-Test-Pass-123!"})
            r = await c.request("DELETE", f"/api/tenant/profile/{t}", headers=h, json={"reauth_token": rr.json().get("reauth_token", "x"), "confirmation": name})
            check(f"delete own account {t[:14]}", r.status_code in (200, 202, 204), f"{r.status_code} {r.text[:150]} reauth={rr.status_code}")
        await asyncio.sleep(2)
        c.cookies.clear()
        r = await c.post("/api/auth/login", json={"provider": "credentials", "email": "e2e-a@example.test", "password": "E2e-Test-Pass-123!"})
        check("deleted account cannot log in", r.status_code in (401, 403), r.status_code)

asyncio.run(main())
bad = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(bad)}/{len(results)} passed; workdir={work}")
sys.exit(1 if bad else 0)
