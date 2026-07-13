"""Web-chat webhook for GenieAI.

A simple same-origin JSON endpoint used by the dashboard's embeddable web widget:
    POST /api/webhooks/web   { tenant_id, session_id, message }
      -> { bubbles: [...], mode, citations, requires_human }

Ponytail: this deliberately reuses the SAME AI pipeline as the LINE webhook
(`generate_ai_bubbles` below) rather than re-implementing it. It differs from the
authenticated `/api/chat` sandbox (chat.py) in two ways that justify a separate
route: (1) it is an unauthenticated same-origin channel endpoint (like the LINE
webhook, no Bearer token), and (2) it returns pre-split `bubbles` for a chat
widget instead of a single `ai_response` string. `generate_ai_bubbles` is the
single source of the pipeline and is imported by webhooks_facebook.py too.
"""
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
    message: str = Field(..., min_length=1)
    session_id: str = Field(default="web_session", min_length=1)
    # ponytail: single-tenant for now — mirrors the LINE webhook. When multi-tenant
    # web widgets ship, derive tenant_id from a signed widget key / origin mapping
    # instead of trusting the request body.
    tenant_id: str = "default"


@router.post("/web")
async def web_webhook(req: WebChatRequest) -> dict:
    """Same-origin web-chat endpoint. Returns pre-split chat bubbles.

    No signature (same-origin from the dashboard widget). Nothing sensitive is
    derived from the body beyond the message, session id, and tenant id.
    """
    try:
        result = await generate_ai_bubbles(
            tenant_id=req.tenant_id,
            session_id=req.session_id,
            user_message=req.message,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in web_webhook: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat message.")

    return {
        "bubbles": result["bubbles"],
        "requires_human": result["requires_human"],
        "diagnostics": {
            "mode": result["mode"],
            "citations": result["citations"],
            "skipped": result["skipped"],
        },
    }
