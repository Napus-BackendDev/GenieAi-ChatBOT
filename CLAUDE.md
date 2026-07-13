# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GenieAI is a multi-tenant SaaS AI Business Assistant. Business owners upload service manuals (PDF/TXT/MD), and the system creates an AI chatbot that answers customer questions and handles appointment bookings via LINE, Facebook Messenger, or web chat.

**Current state:** Single-tenant prototype working end-to-end on LINE. Auth is real (JWT + bcrypt) — see `backend/app/core/security.py`; tenant_id is derived from the token, not client-supplied. Data stored in local JSON files (`data/`) instead of MongoDB. Only LINE webhook is implemented — Facebook and web chat webhooks are stubbed in architecture docs but not built.

**Checkpoint (2026-06-09):** LINE chatbot is fully functional with natural multi-bubble messaging, human-like typing delays, push message fallback, rich tenant profile (services, promotions, staff, FAQ), and hybrid RAG+CAG context engine.

## Working Principle — Ponytail (write less, spend fewer tokens)

The best code is the code you don't write. Before writing anything new, climb this ladder and STOP at the first rung that solves it:
1. Is it necessary at all? If not, don't build it.
2. Does the Python / JS standard library already do it?
3. Does the platform do it natively (FastAPI, React, the browser, LINE Messaging API)?
4. Can an already-installed dependency do it? Don't add a new dependency lightly.
5. If code is unavoidable, make it the smallest possible change / one-liner.

**Reuse before rebuild** — these already exist; do not duplicate or re-derive them:
- System prompt + tenant-profile context: `backend/app/services/prompt.py` is the **single source** (used by both `webhooks.py` and `chat.py`). Never re-inline a system prompt or profile-context builder.
- LINE send: `reply_to_line` / `push_to_line` (`webhooks.py`). Human-handoff state: Redis key `human_intervention:{tenant_id}:{session_id}` (set by AI `[[HANDOFF]]` marker or the dashboard pause/resume endpoints; a text reply must NOT clear it).
- Chat history: `redis_service.py`. RAG/CAG routing: `rag.py::retrieve_hybrid_context`. Bookings: `booking_service.py`. Mongo handle (optional): `app/core/mongodb.py::get_mongo_db`.
- Frontend webhook-URL builder (port 5173→8000 swap) is repeated in `SettingsPage`/`App`/`DashboardOverview` — reuse the pattern, don't invent a new one.

**Lazy ≠ careless.** Never skip: input validation, missing-data handling, error boundaries, security (LINE signature checks, secrets stay in `.env`), or auth. Cutting those is a bug, not economy. When you take a deliberate shortcut, leave a `ponytail:` comment noting why and the upgrade path.

**Token hygiene:** read targeted line ranges instead of whole large files; prefer Grep/Glob over broad exploration; don't re-read a file you just edited; keep diffs minimal.

## Parallel Agents (Claude Code + Antigravity)

Two agents may work this repo at once. To avoid conflicts:
- Split by area (e.g. one owns `backend/`, the other `frontend/`) and never let both edit the same file simultaneously.
- Use separate git branches or worktrees; merge via PR. Don't point two agents at the same working tree.
- Keep the three rule files in sync — `CLAUDE.md` (this file), `AGENTS.md` (Codex/others), `.antigravityrules` (Antigravity). Mirror any convention change across all three.
- Prefer changing the shared source of truth in code (`app/services/prompt.py`) and `System.md` over restating rules in prose.

## Subagents & Operating Procedure

Project subagents live in `.claude/agents/`. **Standard flow for any substantive build/change request** — run it through this pipeline, spawning independent agents concurrently (one message, multiple Agent calls) to finish faster:

1. **Refine** → `prompt-engineer` turns the raw request into a spec (goal, scope, acceptance criteria, edge cases, affected files, suggested specialists). Skip only for trivial edits or plain questions.
2. **Plan & distribute** → `software-engineer` (lead SE, IBM background) decomposes the spec, defines API/data contracts, distributes tasks to the specialists, and integrates/implements the complex cross-cutting parts himself. This is the work distributor.
3. **Build (parallel)** → specialists, split by area so no two edit the same file:
   `frontend` (React/HeroUI/Tailwind) · `backend` (FastAPI/services) · `line-integration` (LINE webhook/handoff) · `rag-engine` (RAG/CAG/OCR) · `data-migration` (JSON→Mongo) · `auth` (JWT+bcrypt) · `devops` (infra/run/deploy).
4. **Verify (parallel)** → `qa` (writes/runs tests, fixes bugs, UI beauty pass) + `code-reviewer` (read-only correctness) + `security-reviewer` (read-only, for sensitive changes). Drive to zero bugs before reporting.
5. **Docs** → `docs-writer` syncs CLAUDE.md / AGENTS.md / .antigravityrules / System.md / design.md whenever behaviour or architecture changed.

Rules: no two *editing* agents touch the same file at once; isolate risky parallel work on separate branches/worktrees. Every change ships verified — `npm run build`, `python -m pytest` (run with the `backend/venv` python), and preview proof for anything visible.

## Commands

### One-click launcher (non-technical users)
`start.bat` at the repo root sets up the backend venv + `npm install`, starts backend and frontend, and opens the browser. Use the per-tier commands below for dev work.

### Backend (FastAPI + Python 3.11)
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Note: `requirements.txt` now pins `openai>=2.40,<3` (a newer SDK is required for httpx compatibility).

### Frontend (React 19 + Vite 8 + Tailwind v4)
```bash
cd frontend
npm install
npm run dev      # Dev server on port 5173, proxied to backend :8000
npm run build    # Production build to dist/
npm run lint     # ESLint
```

### LINE Webhook Testing
```bash
ngrok http 8000
# Copy the https URL → LINE Developers Console → Messaging API → Webhook URL:
# https://<ngrok-id>.ngrok-free.dev/api/webhooks/line
```

### Infrastructure
```bash
docker-compose up -d   # Local Redis on port 6379
```
Production uses Upstash Redis (URL in `.env`). ChromaDB runs embedded (persistent, stored at `data/chroma/`).

## Architecture

### Backend (`backend/app/`)

**Entrypoint:** `main.py` — FastAPI app with lifespan (Redis + Mongo init/close), env-driven CORS allowlist (`CORS_ORIGINS`, comma-separated, default `http://localhost:5173`) with `allow_credentials=True` — never `*`, static file mount at `/static`.

**Routers:**
- `webhooks.py` — LINE webhook at `/api/webhooks/line`. Receives events, processes in BackgroundTasks. Multi-bubble reply with AIS-style human pacing: `show_line_loading()` fires LINE's official "typing…" animation, then a per-bubble delay proportional to length (`_typing_seconds()`, `_HUMANIZE_PROFILES`) precedes EVERY bubble incl. the first. First bubble uses reply API (free), remaining use push API. Includes `_strip_markdown()` and `split_to_line_bubbles()` post-processors.
- `chat.py` — `/api/chat` sandbox endpoint mirroring webhook logic but returning structured JSON (for admin dashboard testing).
- `documents.py` — `/api/documents/upload` handles PDF/TXT/MD upload. Parses with Vision OCR, indexes into ChromaDB, and extracts structured business rules via GPT-4o-mini. `reextract_schedules` guards the profile read-modify-write with `tenant_file_lock` + atomic write + CAG cache-bust + `_validate_tenant_id`.
- `auth.py` — `/api/auth/login` (issues `access_token` + `token_type: "bearer"`) and `/api/auth/questionnaire`. Real auth: email+bcrypt password (trust-on-first-use for legacy accounts; legacy email+phone path still accepted when no password sent); Google login also issues a token. Every tenant-data endpoint derives tenant_id from the token via `get_current_tenant`/`require_tenant` (`core/security.py`).
- `tenant.py` — `/api/tenant/profile/{tenant_id}` CRUD for structured business profile.
- `bookings.py` — `/api/bookings` list and cancel. Booking creation happens via AI function calling only.

**Services:**
- `rag.py` — Hybrid RAG+CAG engine. Core logic: `retrieve_hybrid_context()` checks tenant corpus size against `CAG_TOKEN_THRESHOLD` (15K tokens). Small corpus → CAG (full context in system prompt). Large corpus → RAG (ChromaDB vector search, top-5 chunks). Embedding via `get_embedding()`. Redis caches tenant profiles for 10 min.
- `openai_service.py` — OpenAI client. `get_embedding()` uses `text-embedding-3-small`. `chat_completion_with_tools()` uses `gpt-4o-mini` with iterative tool calling loop (max 5 iterations). `BOOKING_TOOLS` = `get_staff_on_duty` (→ `booking_service.get_staff_on_duty_sync`), `check_booking_availability`, `create_booking`.
- `parsing.py` — `parse_pdf()` renders each PDF page as image → GPT-4o-mini Vision OCR → text. Extracts embedded images to `static/images/{tenant_id}/{doc_id}/`. Falls back to PyMuPDF text extraction on Vision API failure.
- `schedule.py` — Deterministic parser for Thai staff work-schedule strings (day ranges `พฤหัส–อาทิตย์`, nth-weekday-of-month `สัปดาห์ที่ 2,4`, multi-shift `|`). Functions: `parse_schedule`, `is_on_duty`, `covers_datetime`, `staff_working_on`, `resolve_day`. Exists because the LLM cannot reliably reason over these schedules — booking and "who works day X" answers compute here, not in the model.
- `booking_service.py` — Synchronous booking logic. Per-tenant conflict window (default 30 min) + min lead time. `_find_conflict` (lock-free) is called under ONE `booking_file_lock` for the check-then-write critical section (TOCTOU fix). Validates chosen staff is on-duty via `schedule.py` (reason `staff_off_duty`), validates contact info (`_is_valid_email`/`_is_valid_phone`) before create, and returns machine-readable reason codes (`past_date`, `under_lead_time`, `slot_taken`, `staff_off_duty`). `_parse_booking_dt` handles negative UTC offsets. `get_staff_on_duty_sync` backs the AI tool. JSON file storage.
- `redis_service.py` — Chat history management. Max 10 messages per session, 2-hour TTL.

**Data storage (all local JSON — no MongoDB yet):**
- `data/users.json` — User accounts
- `data/documents.json` — Document metadata with page-to-image mappings
- `data/bookings.json` — Booking records
- `data/tenant_profile_{tenant_id}.json` — Structured business profiles (services, promotions, staff, FAQ)
- `data/chroma/` — ChromaDB persistent vector store

### Frontend (`frontend/src/`)

React 19 SPA with HeroUI component library and Tailwind v4. No router — tab-based navigation via state in `App.jsx`.

**Flow:** AuthPage → OnboardingUpload (upload doc → AI parsing → verify extracted rules) → Dashboard

**Pages:**
- `DashboardOverview` — Stats cards, webhook URL clipboard, recent bookings
- `DocumentManager` — Edit tenant profile (services/prices) + manage uploaded documents
- `BookingsManager` — Calendar view with daily booking list, search, filters
- `ChatSandbox` — Split view: chat bubbles (left) + AI diagnostics panel showing RAG/CAG mode, citations, images (right)

**Design system:** Glass morphism (`glass-panel` class), gradient accents (cyan-to-indigo), dark/light theme toggle. Custom CSS in `index.css`.

### Key Data Flow: Customer Message → AI Response

1. LINE webhook receives message → `handle_line_event()` in background task
2. `retrieve_hybrid_context()` checks tenant corpus size → routes to CAG or RAG mode
3. Chat history fetched from Redis (keyed `chat_history:{tenant_id}:{session_id}`)
4. System prompt assembled: static rules + tenant profile (services, promotions, staff, FAQ) + document context + current time
5. `chat_completion_with_tools()` sends to GPT-4o-mini with booking tools
6. If AI triggers `check_booking_availability` or `create_booking`, tool results feed back into conversation loop
7. Response split into bubbles via `split_to_line_bubbles()` (AI decides where to split using `---` separators)
8. First bubble sent via reply API (free), remaining bubbles sent via push API with 2-4s random delay each

### LINE Multi-Bubble Messaging

The AI naturally decides how to split responses into chat bubbles:
- System prompt gives AI freedom to use `---` separators based on conversational rhythm
- Short answers (1-2 sentences) → single bubble, no split
- Longer answers → split into greeting / content / follow-up question
- `split_to_line_bubbles()` post-processes: splits on `---`, falls back to `\n\n`, merges overflow into last bubble (max 5 total)
- Images (if any) are attached to the last bubble

**AIS-style human pacing** (webhook only — the `/api/chat` sandbox stays instant for testing):
- `show_line_loading()` (`POST /v2/bot/chat/loading/start`) shows LINE's official "typing…" animation. 1-on-1 chats only, doesn't count against message quota, `loadingSeconds` clamped to 5–60 in multiples of 5, best-effort (never blocks the reply).
- Before EACH bubble (incl. the first — no more instant reply) the bot pauses: a "reading" jitter before bubble 1, then per-bubble "typing" time scaled by bubble length (jittered, capped) via `_typing_seconds()`/`_HUMANIZE_PROFILES`.
- Tunable per tenant via `ai_settings.humanize_mode`: `"slow"` (AIS-like, DEFAULT) | `"normal"` (faster) | `"off"` (near-instant, no typing animation). Read by `_load_humanize_mode()`. Wall-clock for a 3-bubble reply ≈ 18–20s slow / 10s normal / 1s off.

### Tenant Profile Structure

`data/tenant_profile_{tenant_id}.json` contains:
- `company_name`, `business_hours`, `contact_number` — basic info
- `services[]` — name, price, duration per service
- `promotions[]` — name, description, discount, valid_until, conditions
- `staff[]` — name, role, specialties[], experience, `schedule` (Thai work-schedule string parsed by `schedule.py`)
- `faq[]` — question/answer pairs for common customer queries
- `booking_settings` — optional `conflict_window_mins` / `min_lead_time_hours` overrides
- `ai_settings` — optional AI tuning (`model_name`, `temperature`, `cag_token_threshold`, and `humanize_mode`: `"slow"` default | `"normal"` | `"off"` for LINE reply pacing)

All sections are assembled by the shared `build_profile_context` in `prompt.py` and injected for both `webhooks.py` and `chat.py`. The extractor tags staff specialties from KB group headers and never invents promo `valid_until`.

### Multi-tenancy Model

Tenant isolation is achieved through `tenant_id` parameter filtering at every layer:
- ChromaDB: `where={"tenant_id": tenant_id}` on all queries
- Redis: key pattern `{prefix}:{tenant_id}:{session_id}`
- JSON files: filtered in-memory by `tenant_id` field
- Static images: path `static/images/{tenant_id}/{doc_id}/`

**Current limitation:** LINE webhook uses `get_active_tenant_id()` which reads the first user from `users.json` — effectively single-tenant. Architecture doc specifies `/api/webhooks/line/{tenant_id}` but this isn't implemented yet.

## Environment Variables (`.env` in `backend/`)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI API (embeddings + chat + vision OCR) |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API |
| `LINE_CHANNEL_SECRET` | LINE webhook signature verification |
| `REDIS_URL` | Redis connection (supports `rediss://` for TLS) |
| `JWT_SECRET` | HS256 signing key for access tokens. MUST be set for production — a blank value falls back to a dev-only key with a startup warning. (`JWT_ALGORITHM` default HS256, `JWT_EXPIRE_DAYS` default 7 are optional overrides.) |
| `CORS_ORIGINS` | Comma-separated CORS allowlist (default `http://localhost:5173`) |
| `CHROMA_DB_PATH` | ChromaDB persistent storage path |
| `DOCUMENTS_JSON_PATH` | Document metadata JSON location |
| `BOOKINGS_JSON_PATH` | Bookings JSON location |
| `PORT` | Backend server port (default 8000) |

## Important Patterns

- **System prompt is centralized** in `backend/app/services/prompt.py` (`BASE_SYSTEM_PROMPT`, `build_system_prompt`, `build_profile_context`, `build_rag_context_message`), imported by both `webhooks.py` and `chat.py`. Change AI behaviour rules there ONCE — never re-inline a prompt or profile builder into a router. The prompt is tenant-agnostic; business specifics come only from the injected profile. `build_profile_context` uses defensive `.get()` so a malformed profile no longer 500s every chat.
- **AI behaviour rules baked into `BASE_SYSTEM_PROMPT`:** answer in the customer's language (not Thai-only); content-based emergency handling (surface the emergency number for pus/swelling/bleeding/trauma/severe pain); price grounding (a `X–Y` range is the whole-service min/max — never split into per-variant/brand prices, never multiply into a total; custom/full-mouth → escalate with `[[HANDOFF]]`; unavailable service → say so; never invent procedure timing/duration); relay the booking refusal reason verbatim; don't re-check after a booking succeeds; and always call `get_staff_on_duty` for "who works on day X" and before assigning booking staff.
- **Staff schedules are parser-driven, not LLM-guessed** — the AI MUST call `get_staff_on_duty` (backed by `schedule.py`) for any "who works day X" question and before assigning booking staff. `check_booking_availability` blocks off-duty staff.
- **Booking creation only happens through AI function calling** — there is no direct REST endpoint to create bookings. The AI must call `check_booking_availability` then `create_booking`.
- **PDF parsing uses Vision OCR by default** (renders page as image → GPT-4o-mini), not text extraction. This is expensive but handles Thai text and tables well.
- **CAG mode injects the entire document corpus into the system prompt**. This only works when corpus is under ~15K tokens (~10-12K words).
- **Frontend proxies API calls** to the backend. In dev, Vite proxy or port replacement (`5173` → `8000`) handles this. The dashboard webhook URL display does this port swap client-side.
- **Thread safety:** JSON file operations use `threading.Lock()` instances (`doc_file_lock`, `booking_file_lock`, `users_file_lock`) since FastAPI runs with multiple async workers.
- **LINE bubble splitting:** AI output uses `---` separators (AI decides placement). `_strip_markdown()` cleans formatting, `split_to_line_bubbles()` splits into max 5 bubbles. First bubble uses reply API, subsequent bubbles use push API. Pacing/typing-animation is AIS-style and per-tenant (`ai_settings.humanize_mode`) — see the LINE Multi-Bubble Messaging section.
- **Push message fallback:** `reply_to_line()` tries the free reply API first; if the token expired (~1 min), it falls back to `push_to_line()` which uses messaging quota.
- **Prompt-injection defense:** `chat.py` and `webhooks.py` strip the literal `[[HANDOFF]]` marker from inbound customer text before use, so a customer can't self-handoff/pause the bot.
- **Auth (real, enforced):** `core/security.py` provides bcrypt `hash_password`/`verify_password`, PyJWT `create_access_token` (HS256, `sub`=tenant_id), a `get_current_tenant` dependency (401 on missing/invalid/expired `Authorization: Bearer` header) and a `require_tenant` helper (403 when a path/query tenant_id ≠ the token's). Every tenant-data endpoint (bookings, chat [all 5 routes], documents list/upload/delete/reextract, tenant profile/save/upload-image/verify-line, auth/questionnaire) derives tenant_id FROM THE TOKEN — a client-supplied tenant_id can no longer reach another tenant. Exempt by design: `/api/auth/login`, `/api/webhooks/*` (LINE signature), `/` health, `/static`, and the UUID-keyed `/api/documents/upload/status/{job_id}`. Frontend: login stores `genie_ai_token`; `frontend/src/main.jsx` wraps `window.fetch` to inject the Bearer header on all `/api/*` (non-login) calls and logs out on 401.
- **Tenant-scoped deletes:** `rag.py::delete_document` checks tenant ownership of the doc metadata BEFORE deleting and scopes the ChromaDB delete by tenant (`where={"$and": [{document_id}, {tenant_id}]}` — Chroma requires `$and` for multi-key filters).
- **Dependency pins:** `requirements.txt` pins `openai>=2.40,<3`, `python-multipart>=0.0.18` (CVE-2024-53981), `PyJWT>=2.8`, `bcrypt>=4.1`. The PII/secret JSON files under `backend/data/` are gitignored (`git rm --cached`) — never re-commit them.

## Planned Work

- **Ollama migration:** Replace OpenAI (gpt-4o-mini + text-embedding-3-small) with local LLM via Ollama (e.g. qwen2.5:7b + nomic-embed-text). Requires adapting RAG/CAG thresholds for smaller context windows.
- **Multi-tenant LINE routing:** Change webhook from `/api/webhooks/line` to `/api/webhooks/line/{tenant_id}` so multiple businesses can use separate LINE channels.
- **MongoDB migration:** Replace JSON file storage with MongoDB for production scalability.
- **Facebook & Web Chat:** Implement additional messaging channel webhooks.
