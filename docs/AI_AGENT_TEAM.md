# GenieAI Parallel Agent Team

เอกสารนี้เป็นคู่มือกลางสำหรับให้ AI agents หลายบทบาทพัฒนา GenieAI พร้อมกัน โดยยึด `AGENTS.md`, `System.md`, `design.md` และ source code ปัจจุบันเป็นแหล่งอ้างอิงหลัก

## 1. Team Structure

### 1.1 Product Intake - `prompt-engineer`

- เปลี่ยนคำขอของผู้ใช้ให้เป็น goal, scope, acceptance criteria และ edge cases ที่ตรวจสอบได้
- ระบุไฟล์หรือโมดูลที่คาดว่าจะได้รับผลกระทบ
- เลือก specialist ที่ต้องใช้และกำหนดสิ่งที่อยู่นอกขอบเขต
- ไม่แก้ product code

### 1.2 Lead Orchestrator - `software-engineer`

- รับ spec จาก Product Intake แล้วออกแบบ API/data contracts ก่อนเริ่มงาน
- แบ่งงานเป็น parallel lanes และกำหนดเจ้าของไฟล์แบบไม่ทับซ้อน
- ดูแล integration ของงานข้าม frontend, backend, AI และ infrastructure
- ตัดสินใจหยุดหรือจัดลำดับงานใหม่เมื่อ contract หรือ dependency เปลี่ยน

### 1.3 Backend - `backend`

- ดูแล `backend/app/routers/`, business services และ API contracts
- ใช้ async flow, tenant isolation และ data adapter ใน `backend/app/core/db.py`
- ไม่แก้ RAG, LINE delivery หรือ auth เมื่อมี specialist เจ้าของพื้นที่นั้น

### 1.4 AI Knowledge - `rag-engine`

- ดูแล `backend/app/services/rag.py`, `parsing.py`, `openai_service.py`
- รับผิดชอบ RAG/CAG routing, OCR, embedding, retrieval quality และ token budget
- ทุกการเปลี่ยน retrieval ต้องมี evaluation cases และ tenant-scoped checks

### 1.5 Conversation Rules - `prompt-engineer` + Lead

- พฤติกรรม chatbot ใช้ `backend/app/services/prompt.py` เป็น source of truth
- การเปลี่ยน prompt ต้องระบุ expected responses, refusal/handoff cases และ booking tool behavior
- Lead เป็นเจ้าของ integration เมื่อ prompt กระทบหลาย channel

### 1.6 LINE Channel - `line-integration`

- ดูแล `backend/app/routers/webhooks.py` และ LINE delivery behavior
- รับผิดชอบ signature verification, reply/push fallback, multi-bubble และ human pacing
- ห้ามลด security checks หรือแก้ shared AI pipeline โดยไม่มี contract จาก Lead

### 1.7 Frontend - `frontend`

- ดูแล `frontend/src/` และ visual assets ที่เกี่ยวข้อง
- ใช้ React 19, HeroUI, Tailwind v4 และข้อกำหนดใน `design.md`
- ตรวจ TH/EN, responsive, loading, empty, error และ dark/light states

### 1.8 Identity & Data - `auth` / `data-migration`

- `auth` ดูแล JWT, bcrypt, authorization และ tenant identity
- `data-migration` ดูแล MongoDB adapter, schema migration และ JSON fallback
- งานทั้งสองสายต้องผ่าน `security-reviewer`

### 1.9 Runtime - `devops`

- ดูแล dependency, environment, Docker, CI, startup และ deployment
- ยืนยัน health ของ backend `8000`, frontend `5173`, Redis และ MongoDB
- ไม่เปิดเผย secrets และไม่ commit `.env` หรือข้อมูลลูกค้า

### 1.10 Verification - `qa`, `code-reviewer`, `security-reviewer`

- `qa` รัน tests/build และทดสอบ workflow แบบ end-to-end
- `code-reviewer` ตรวจ correctness, regression และ Ponytail violations แบบ read-only
- `security-reviewer` ตรวจ auth, tenant isolation, signatures, uploads และ prompt injection แบบ read-only
- งานยังไม่ถือว่าเสร็จจน quality gates ที่เกี่ยวข้องผ่าน

### 1.11 Documentation - `docs-writer`

- อัปเดต `AGENTS.md`, `CLAUDE.md`, `.antigravityrules`, `System.md` และ `design.md` เมื่อ behavior หรือ architecture เปลี่ยน
- ไม่เขียนเอกสารแทนหลักฐานจาก code, tests หรือ runtime

## 2. Parallel Workflow

```text
User request
    |
    v
prompt-engineer -> buildable spec
    |
    v
software-engineer -> contracts + file ownership
    |
    +----------------+----------------+----------------+
    |                |                |                |
 backend         rag-engine       frontend      channel/auth/data
    |                |                |                |
    +----------------+----------------+----------------+
                             |
                             v
              qa + code-reviewer + security-reviewer
                             |
                             v
                    docs-writer + final report
```

## 3. Parallelization Rules

1. Agent แต่ละตัวต้องได้รับ goal, acceptance criteria, read/write scope และ verification command
2. ห้าม editing agents สองตัวแก้ไฟล์เดียวกันพร้อมกัน
3. งานข้ามหลายโมดูลต้องกำหนด contract ก่อนแยก build lanes
4. งานเสี่ยงสูงใช้ branch หรือ worktree แยก
5. Agent ต้องไม่ revert การเปลี่ยนแปลงที่ตนไม่ได้สร้าง
6. Shared files เช่น `prompt.py`, `App.jsx`, `index.css`, `core/db.py` ให้ Lead กำหนดเจ้าของเพียงคนเดียว
7. Review agents เป็น read-only เว้นแต่ Lead มอบหมาย fix scope ใหม่อย่างชัดเจน
8. ห้าม `git push` จนกว่าผู้ใช้สั่งโดยตรง

## 4. Work Order Contract

ทุกงานที่มอบให้ agent ต้องมีข้อมูลต่อไปนี้:

```yaml
goal: ผลลัพธ์ที่ผู้ใช้มองเห็นหรือวัดได้
acceptance_criteria:
  - พฤติกรรมที่ QA ตรวจซ้ำได้
ownership:
  read:
    - path/or/module
  write:
    - exact/path/or/module
do_not_touch:
  - files owned by other agents
dependencies:
  - contract or task that must finish first
verification:
  - exact command or browser workflow
handoff:
  - changed files
  - tests and results
  - risks or unresolved questions
```

## 5. Quality Gates

### Backend

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest
```

ตรวจเพิ่มตามขอบเขต: auth, tenant isolation, booking race conditions, webhook signatures, Redis/OpenAI failure และ malformed input

### Frontend

```powershell
cd frontend
npm run build
npm run lint
```

งาน UI ต้องมี browser proof ที่ desktop และ mobile รวมถึง TH/EN, dark/light, loading, empty และ error states

### AI/RAG

- มี mock conversations ครอบคลุม FAQ, ราคา, ตารางพนักงาน, booking, handoff และข้อมูลที่ไม่มีในเอกสาร
- ตรวจ CAG ต่ำกว่า threshold และ RAG เหนือ threshold
- ยืนยันว่า citation/context เป็นของ tenant เดียวกัน
- ห้ามตอบข้อมูลธุรกิจที่ไม่มีหลักฐานใน profile หรือ document context

### Release

- Backend tests ผ่าน
- Frontend build ผ่าน
- Reviewer ไม่มี unresolved critical/high findings
- Security-sensitive changes ผ่าน security review
- Architecture/docs สอดคล้องกับ behavior จริง

## 6. Default Delivery Team

งานทั่วไปใช้ทีมขนาดเล็กก่อน:

1. `prompt-engineer`
2. `software-engineer`
3. Specialist ตาม ownership 1-3 ตัว
4. `qa` + `code-reviewer`
5. `security-reviewer` เมื่อแตะ auth, tenant data, webhook, upload หรือ secrets
6. `docs-writer` เมื่อ architecture หรือ behavior เปลี่ยน

ไม่จำเป็นต้องเปิด agent ทุกตัวในทุกงาน เพราะจำนวน handoffs ที่มากเกินไปทำให้งานช้าลงและเพิ่มโอกาส contract drift

## 7. Current Recommended Lanes

จากสถาปัตยกรรมปัจจุบัน งานพัฒนาระยะถัดไปควรแยกเป็น:

- Lane A: multi-tenant channel routing สำหรับ LINE, Facebook และ web widget
- Lane B: AI evaluation suite สำหรับ RAG/CAG, pricing, staff schedule และ booking tools
- Lane C: frontend end-to-end states และ bilingual consistency
- Lane D: operational readiness สำหรับ MongoDB, Redis, environment และ CI
- Lane E: security and release regression review

Lead ต้องจัดลำดับ dependency ก่อนเริ่ม build โดยเฉพาะ tenant routing contract ซึ่งกระทบ channel, auth, data และ frontend พร้อมกัน

## 8. Audit Snapshot - 2026-07-30

ทีม agent ทำ read-only audit พร้อมกัน 5 สาย: Product, Backend, AI/RAG, Frontend และ QA/Security

ผลตรวจที่ยืนยันแล้ว:

- Backend test suite ผ่าน 126 tests
- AI/RAG targeted tests ผ่าน 15 tests
- Chroma retrieval ที่ตรวจมี `tenant_id` filter และดึง top 5 ตามที่ออกแบบ
- Frontend lint ไม่ผ่าน: 55 errors และ 20 warnings
- `npm audit` พบ high-severity advisory 1 รายการใน PostCSS
- ยังไม่มี frontend behavior tests และ CI workflow
- ระบบยังไม่พร้อม release แบบ multi-tenant production

### P0 Parallel Plan

#### Wave 1 - Contracts and immediate correctness

| Workstream | Owner | Write scope | Acceptance gate |
|---|---|---|---|
| Signed web-widget identity และ tenant-safe channel routing | `auth` + `line-integration` + Lead | `webhooks_web.py`, `webhooks.py`, `webhooks_facebook.py`, security contract | ไม่สามารถเปลี่ยน `tenant_id` เพื่อเข้าถึง tenant อื่น; unknown channel mapping ถูก reject |
| Account deletion repair | `backend` | `tenant.py` และ endpoint tests | ลบ tenant ที่เลือกได้ครบโดยไม่เกิด `ImportError`; tenant อื่นไม่เปลี่ยน |
| Onboarding business-info flow | `frontend` | `OnboardingUpload.jsx` | questionnaire ถูกบันทึกก่อน upload/review และทำงานทั้ง TH/EN |
| Frontend release baseline | `frontend` + `qa` | lint findings ตาม ownership | `npm run lint` และ `npm run build` ผ่าน |

ห้ามให้ agent ที่แก้ channel routing แตะไฟล์เดียวกันพร้อมกัน Lead ต้องแบ่งลำดับเป็น contract -> LINE/Facebook -> web chat integration

#### Wave 2 - Data integrity

| Workstream | Owner | Write scope | Acceptance gate |
|---|---|---|---|
| Mongo-atomic booking reservation | `data-migration` + `backend` | `booking_service.py`, Mongo indexes/adapter, tests | concurrent requests สร้าง booking ใน slot เดียวได้ไม่เกิน 1 รายการ |
| Transactional document indexing | `rag-engine` | `rag.py`, `documents.py`, parsing/index tests | failure ทุก boundary ไม่เหลือ chunks, metadata หรือ extracted images |
| Stable persistence mode | `data-migration` | `core/db.py`, startup/config tests | production ไม่สลับ Mongo/JSON ต่อ operation และไม่มี split-brain writes |
| Atomic profile/history updates | `backend` | `tenant.py`, `redis_service.py`, adapter tests | concurrent update ไม่สูญหายและไม่ hold thread lock ข้าม `await` |

#### Wave 3 - Product completion

| Workstream | Owner | Write scope | Acceptance gate |
|---|---|---|---|
| Real embeddable widget | `frontend` + `backend` | widget asset, Settings, signed web endpoint | external test page เปิด widget, ส่งข้อความ, คง session และแสดง retry state |
| Responsive dashboard | `frontend` | `App.jsx`, `Sidebar.jsx`, page-specific responsive styles | ใช้งานได้ที่ 390, 768 และ 1440 px โดยไม่มี clipped navigation |
| Honest async states | `frontend` | shared API helper และ affected pages | แยก loading, empty, offline, error และ retry ได้ทุกหน้าหลัก |
| AI quality evaluation | `rag-engine` + `qa` | `backend/tests/evals/` และ targeted tests | TH/EN Recall@5 >= 90%, irrelevant context <= 5%, tenant leakage = 0 |

#### Wave 4 - Release verification

| Workstream | Owner | Gate |
|---|---|---|
| Backend regression | `qa` | 126 existing tests และ tests ใหม่ผ่าน |
| Security audit | `security-reviewer` | ไม่มี unresolved critical/high ใน routing, auth, uploads, PII และ tenant isolation |
| Frontend behavior | `qa` | auth, onboarding, TH/EN, dark/light, mobile, backend-down และ chat handoff ผ่าน |
| Dependency/repository hygiene | `devops` | lint, build, dependency audit, no tracked logs/secrets/tenant corpus |
| Documentation sync | `docs-writer` | `System.md`, `AGENTS.md`, `CLAUDE.md`, `.antigravityrules`, `design.md` ตรงกับ behavior จริง |

### Confirmed Risks Requiring Explicit Decisions

- `backend/data/chroma/` มี tracked corpus ประมาณ 10.4 MB ต้องตรวจว่าเป็นข้อมูลจริงหรือ mock ก่อนแก้ Git history
- public `/static` อาจเปิดเผย extracted document images ต้องกำหนด data classification
- JSON fallback ใช้เป็น local development เท่านั้นหรือรองรับ production ต้องตัดสินใจให้ชัด
- owner-side booking จะยังเป็น AI-only หรือเพิ่ม manual create/edit/reschedule ต้องมี product decision ก่อนสร้าง API
- mascot แบบ animated เหมาะกับ marketing/auth แต่ sidebar ควรใช้รูปนิ่งขนาดเล็กเพื่อลด distraction และ render cost
