"""Upload the real sample business PDFs and compare every extracted value against the source text.

Prints a report: for each extracted service/staff/promo/faq/phone/hours, is the value actually
present in the PDFs' own text? Run:  python tests/e2e/e2e_extract_accuracy.py   (real OpenAI)
"""
import asyncio, glob, os, re, json
from harness import *  # noqa
import fitz

DOCS = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "Tooth Therapy - เอกสารธุรกิจ"))


def norm(s):
    return re.sub(r"[\s,\-–—:()/]+", "", str(s)).lower()


async def main(x):
    c = x.c
    t, h = await x.signup("accuracy@example.test")
    files = sorted(glob.glob(os.path.join(DOCS, "*.pdf")))
    src = ""
    for f in files:
        with fitz.open(f) as d:
            src += "\n".join(p.get_text() for p in d) + "\n"
    print("source text chars (embedded text):", len(src))
    S = norm(src)
    merged = {"services": [], "staff": [], "promotions": [], "faq": [], "company_name": "", "business_hours": "", "contact_number": ""}
    for f in files:
        with open(f, "rb") as fh:
            r = await c.post("/api/documents/upload", headers=h, files={"file": (os.path.basename(f), fh.read(), "application/pdf")})
        jid = r.json()["job_id"]
        for _ in range(150):
            st = (await c.get(f"/api/documents/upload/status/{jid}", headers=h)).json()
            if st.get("status") in ("done", "error", "blocked_quota"):
                break
            await asyncio.sleep(2)
        ej = st.get("extracted_json") or {}
        print(os.path.basename(f)[:30], st.get("status"), {k: (len(v) if isinstance(v, list) else v) for k, v in ej.items() if v})
        for k in ("services", "staff", "promotions", "faq"):
            merged[k] += ej.get(k) or []
        for k in ("company_name", "business_hours", "contact_number"):
            merged[k] = merged[k] or ej.get(k) or ""
    json.dump(merged, open("extracted.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    miss = []

    def has(label, val):
        ok = norm(val) in S if val else True
        check(f"{label}: {str(val)[:60]}", ok)
        if not ok:
            miss.append((label, val))

    for k in ("company_name", "business_hours", "contact_number"):
        has(k, merged[k])
    for s in merged["services"]:
        has("service name", s.get("name")); has("service price", s.get("price"))
    for s in merged["staff"]:
        has("staff name", s.get("name")); has("staff schedule", s.get("schedule"))
    for p in merged["promotions"]:
        has("promo name", p.get("name")); has("promo discount", p.get("discount"))
    for q in merged["faq"]:
        has("faq question", q.get("question"))
    # reverse: every price-looking number in the source should appear in extraction
    out = norm(json.dumps(merged, ensure_ascii=False))
    nums = set(re.findall(r"\d{1,3}(?:,\d{3})+|\d{3,}", src))
    lost = sorted(n for n in nums if norm(n) not in out)
    print("numbers in source but not in extraction:", lost[:40])
    print("MISMATCHES:", json.dumps(miss, ensure_ascii=False)[:1500])


if __name__ == "__main__":
    asyncio.run(run(main))
