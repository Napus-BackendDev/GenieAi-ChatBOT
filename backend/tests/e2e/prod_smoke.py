"""Production smoke test (read-only; creates and changes nothing).

  python tests/e2e/prod_smoke.py                       # public checks only
  PROD_EMAIL=you@x.com PROD_PASSWORD=... python tests/e2e/prod_smoke.py   # + logged-in checks

Logged-in checks confirm what only the owner can see: the AI quota limits that Render is
actually using, LINE/Facebook channel status, and that the dashboard APIs answer.
"""
import os
import sys
import httpx

API = os.environ.get("PROD_API", "https://genieai-chatbot.onrender.com")
WEB = os.environ.get("PROD_WEB", "https://genie-ai-chat-bot.vercel.app")
results = []


def check(name, cond, extra=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra not in ("", None) else ""))


with httpx.Client(timeout=60) as c:
    r = c.get(f"{API}/health/ready")
    j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    check("API ready (Redis + Mongo up)", r.status_code == 200 and j.get("redis") and j.get("mongodb"), j)
    for path in ("/docs", "/openapi.json", "/.env"):
        check(f"API hides {path}", c.get(f"{API}{path}").status_code == 404)
    for path in ("/api/bookings", "/api/tenant/profile/x", "/api/chat/sessions", "/api/documents"):
        check(f"{path} needs auth", c.get(f"{WEB}{path}").status_code == 401)
    check("legacy single-tenant LINE webhook closed", c.post(f"{API}/api/webhooks/line", json={"events": []}).status_code in (403, 404))
    h = c.get(f"{WEB}/login").headers
    check("COOP allows Google popup", h.get("cross-origin-opener-policy") == "same-origin-allow-popups", h.get("cross-origin-opener-policy"))
    r = c.post(f"{WEB}/api/auth/signup", json={"email": "smoke@example.invalid", "password": "short"}, headers={"Origin": WEB})
    check("weak password refused", r.status_code == 400, r.status_code)

    email, password = os.environ.get("PROD_EMAIL"), os.environ.get("PROD_PASSWORD")
    if email and password:
        r = c.post(f"{WEB}/api/auth/login", json={"provider": "credentials", "email": email, "password": password}, headers={"Origin": WEB})
        check("owner login works", r.status_code == 200, r.status_code)
        if r.status_code == 200:
            tid = r.json()["tenant_id"]
            hh = {"Authorization": f"Bearer {r.json().get('access_token', '')}"}
            u = c.get(f"{WEB}/api/tenant/ai-usage", headers=hh).json()
            check("AI tenant quota >= 1,000,000 (Render env applied)", int(u.get("tenant_token_limit", 0)) >= 1_000_000, u.get("tenant_token_limit"))
            s = c.get(f"{WEB}/api/tenant/profile/{tid}/settings", headers=hh).json()
            print("  LINE configured/verified:", s.get("line_configured"), s.get("line_verified"), "| Facebook:", s.get("facebook_configured"))
            check("dashboard APIs answer", c.get(f"{WEB}/api/bookings", headers=hh).status_code == 200)
    else:
        print("  (set PROD_EMAIL / PROD_PASSWORD to also verify the quota env and channel status)")

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
