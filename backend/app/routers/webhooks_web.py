"""Web-chat webhook for GenieAI.

A signed JSON endpoint used by the embeddable web widget:
    POST /api/webhooks/web   { token, session_id, message }
      -> { bubbles: [...], mode, citations, requires_human }

Ponytail: this deliberately reuses the SAME AI pipeline as the LINE webhook
(`generate_ai_bubbles` below) rather than re-implementing it. It differs from the
authenticated `/api/chat` sandbox (chat.py) in two ways that justify a separate
route: (1) it authenticates a public widget token instead of a user's Bearer
token, and (2) it returns pre-split `bubbles` for a chat
widget instead of a single `ai_response` string. `generate_ai_bubbles` is the
single source of the pipeline and is imported by webhooks_facebook.py too.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import decode_webchat_token
from app.core.config import settings
from app.services.redis_service import get_chat_history, add_chat_message
from app.services.rag import retrieve_hybrid_context
from app.services.openai_service import chat_completion_with_tools
# Reuse LINE bubble post-processing — do not re-implement (Ponytail).
from app.routers.webhooks import split_to_line_bubbles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Marker the AI appends when it decides to hand off to a human agent.
HANDOFF_MARKER = "[[HANDOFF]]"


async def generate_ai_bubbles(
    tenant_id: str,
    session_id: str,
    user_message: str,
    max_bubbles: int = 5,
) -> dict:
    """Run the shared RAG/CAG + LLM pipeline and return split chat bubbles.

    Single source of the customer-facing AI pipeline for the non-LINE channels
    (web + Facebook). Mirrors `webhooks.py::_handle_line_event_inner` but returns
    structured data instead of sending LINE messages.

    Returns a dict:
        { "bubbles": [str], "mode": str, "citations": [...], "requires_human": bool,
          "skipped": bool }
    `skipped` is True when the session is paused for human intervention — the
    caller should NOT send an AI reply (the inbound message is still recorded).
    """
    # Strip the handoff marker from inbound customer text so a customer cannot
    # inject "[[HANDOFF]]" to force a self-handoff / silently pause their own AI.
    user_message = (user_message or "").replace(HANDOFF_MARKER, "").strip()
    session_id = (session_id or "").strip()
    tenant_id = (tenant_id or "").strip() or "default"

    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    from app.core.redis import get_redis
    redis_client = get_redis()

    # Increment unread messages count for the admin dashboard
    try:
        await redis_client.incr(f"unread:{tenant_id}:{session_id}")
        await redis_client.expire(f"unread:{tenant_id}:{session_id}", 604800)
    except Exception as e:
        logger.warning(f"Failed to increment unread for {tenant_id}:{session_id}: {e}")

    # Honor the human-intervention pause flag (set by AI [[HANDOFF]] or the
    # dashboard pause endpoint). When paused, record the inbound message so the
    # admin sees it in live chat, but do not generate an AI reply.
    try:
        is_human_active = await redis_client.exists(f"human_intervention:{tenant_id}:{session_id}")
    except Exception as e:
        logger.warning(f"Could not read human_intervention flag for {tenant_id}:{session_id}: {e}")
        is_human_active = False

    if is_human_active:
        await add_chat_message(session_id=session_id, role="user", content=user_message, tenant_id=tenant_id)
        return {"bubbles": [], "mode": "handoff", "citations": [], "requires_human": True, "skipped": True}

    # 1. Retrieve RAG/CAG hybrid context
    rag_result = await retrieve_hybrid_context(user_message, tenant_id=tenant_id)
    doc_context = rag_result.get("context", "")
    citations = rag_result.get("citations", [])
    mode = rag_result.get("mode", "rag")

    # Load tenant profile via the shared, tenant-agnostic builder
    from app.services.prompt import load_tenant_profile_context, build_system_prompt, build_rag_context_message
    profile_context = await load_tenant_profile_context(tenant_id)

    full_context = ""
    if profile_context:
        full_context += profile_context + "\n====================\nข้อมูลเพิ่มเติมจากเอกสารความรู้:\n"
    full_context += doc_context

    # 2. History + 3. record inbound message
    history = await get_chat_history(session_id=session_id, tenant_id=tenant_id)
    await add_chat_message(session_id=session_id, role="user", content=user_message, tenant_id=tenant_id)

    # 4. Build prompt (shared builder)
    system_prompt = build_system_prompt(mode, full_context)
    rag_context_message = None if mode == "cag" else build_rag_context_message(full_context)

    current_time_str = datetime.now().strftime("%A, %d %B %Y %H:%M")
    time_instruction_msg = {
        "role": "system",
        "content": f"[SYSTEM INFO] ข้อมูลปัจจุบัน (Current Time): วันนี้คือวัน {current_time_str}. ให้ใช้ข้อมูลนี้ประกอบการระบุวันเวลาสำหรับนัดหมาย เช่น 'วันพรุ่งนี้' หรือ 'วันศุกร์นี้'.",
    }

    final_messages = history.copy()
    final_messages.append(time_instruction_msg)
    if rag_context_message:
        final_messages.append(rag_context_message)
    final_messages.append({"role": "user", "content": user_message})

    # 5. Call OpenAI
    ai_response = await chat_completion_with_tools(
        messages=final_messages,
        system_prompt=system_prompt,
        tenant_id=tenant_id,
    )

    # Detect + strip AI-initiated handoff marker
    requires_human = HANDOFF_MARKER in ai_response
    if requires_human:
        ai_response = ai_response.replace(HANDOFF_MARKER, "").strip()

    # 6. Save AI reply
    await add_chat_message(session_id=session_id, role="assistant", content=ai_response, tenant_id=tenant_id)

    if requires_human:
        try:
            await redis_client.set(f"human_intervention:{tenant_id}:{session_id}", "1")
        except Exception as re:
            logger.warning(f"Failed to flag session in Redis: {re}")

    bubbles = split_to_line_bubbles(ai_response, max_bubbles=max_bubbles)
    return {
        "bubbles": bubbles,
        "mode": mode,
        "citations": citations,
        "requires_human": requires_human,
        "skipped": False,
    }


class WebChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(..., min_length=1, max_length=4096)
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(
        default="web_session",
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9_-]+$",
    )


class WebChatDiagnostics(BaseModel):
    mode: str
    citations: list = Field(default_factory=list)
    skipped: bool


class WebChatResponse(BaseModel):
    bubbles: list[str]
    requires_human: bool
    diagnostics: WebChatDiagnostics


async def _enforce_widget_rate_limits(tenant_id: str, session_id: str, client_ip: str) -> None:
    """Bound public-widget cost by session, caller, and tenant."""
    from app.core.redis import get_redis
    from app.core.rate_limit import increment_with_expiry

    limits = (
        (f"webchat:rate:session:{tenant_id}:{session_id}", 20, 60),
        (f"webchat:rate:ip:{tenant_id}:{client_ip}", 60, 60),
        (f"webchat:rate:tenant:{tenant_id}", 1000, 86400),
    )
    try:
        redis_client = get_redis()
        for key, limit, window in limits:
            count = await increment_with_expiry(redis_client, key, window)
            if count > limit:
                raise HTTPException(
                    status_code=429,
                    detail="Web chat rate limit exceeded. Please try again later.",
                    headers={"Retry-After": str(window)},
                )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Web chat rate limiter unavailable: %s", exc)
        if settings.is_production:
            raise HTTPException(
                status_code=503,
                detail="Web chat is temporarily unavailable.",
            )


_WIDGET_FRAME_HTML = """<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>GenieAI Web Chat</title>
</head>
<body>
  <script src="/static/widget.js" defer></script>
</body>
</html>"""


@router.get("/web/widget", response_class=HTMLResponse, include_in_schema=False)
async def web_widget_frame() -> HTMLResponse:
    """Serve an isolated frame so third-party embeds need no broad CORS."""
    return HTMLResponse(
        _WIDGET_FRAME_HTML,
        headers={
            "Content-Security-Policy": (
                "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; "
                "connect-src 'self'; frame-ancestors *"
            ),
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.post("/web", response_model=WebChatResponse, status_code=200)
async def web_webhook(req: WebChatRequest, request: Request) -> WebChatResponse:
    """Verify the widget token, derive its tenant, and return chat bubbles."""
    from app.core.db import db_load_profile, db_tenant_exists

    claims = decode_webchat_token(req.token)
    tenant_id = claims["sub"]
    if not await db_tenant_exists(tenant_id):
        logger.warning("Web chat rejected: token references an unknown tenant.")
        raise HTTPException(status_code=404, detail="Unknown tenant")
    profile = await db_load_profile(tenant_id) or {}
    webchat_settings = profile.get("webchat_settings") or {}
    if not webchat_settings.get("enabled", True):
        raise HTTPException(status_code=403, detail="Web chat is disabled")
    if claims.get("ver") != webchat_settings.get("token_version", 1):
        raise HTTPException(status_code=401, detail="Web chat token has been revoked")
    from app.core.client_ip import get_client_ip
    client_ip = get_client_ip(request)
    await _enforce_widget_rate_limits(tenant_id, req.session_id, client_ip)
    try:
        result = await generate_ai_bubbles(
            tenant_id=tenant_id,
            session_id=req.session_id,
            user_message=req.message,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in web_webhook: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat message.")

    return WebChatResponse(
        bubbles=result["bubbles"],
        requires_human=result["requires_human"],
        diagnostics=WebChatDiagnostics(
            mode=result["mode"],
            citations=result["citations"],
            skipped=result["skipped"],
        ),
    )
