"""Facebook Messenger webhook for GenieAI.

Endpoints:
    GET  /api/webhooks/facebook  -> Meta webhook verification handshake
    POST /api/webhooks/facebook  -> incoming messaging events (X-Hub-Signature-256 verified)

Mirrors the LINE webhook flow but for Messenger: verify signature, parse
messaging events, run the SHARED AI pipeline (`generate_ai_bubbles`, defined in
webhooks_web.py — do NOT duplicate it), and send each reply bubble as a separate
message via the Graph Send API. Events are processed in BackgroundTasks so the
webhook returns 200 quickly (Meta retries on slow/failed responses).

Env vars (read via os.getenv — kept out of code):
    FB_VERIFY_TOKEN        token echoed back during the GET verification handshake
    FB_APP_SECRET          app secret used for X-Hub-Signature-256 HMAC verification
    FB_PAGE_ACCESS_TOKEN   page token used to call the Graph Send API
    FB_GRAPH_API_VERSION   optional, defaults to "v21.0"
"""
import os
import hmac
import json
import hashlib
import logging

import httpx
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks
from fastapi.responses import PlainTextResponse

# Reuse the single-source AI pipeline (Ponytail — no re-implementation).
from app.routers.webhooks_web import generate_ai_bubbles
# Reuse the single-tenant resolver used by the LINE webhook.
from app.routers.webhooks import get_active_tenant_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

FB_GRAPH_API_VERSION = os.getenv("FB_GRAPH_API_VERSION", "v21.0")


def _fb_graph_send_url() -> str:
    return f"https://graph.facebook.com/{FB_GRAPH_API_VERSION}/me/messages"


def verify_fb_signature(body: bytes, signature_header: str, app_secret: str) -> bool:
    """Verify the X-Hub-Signature-256 header against the raw request body.

    Header format is "sha256=<hexdigest>". Returns False on any missing/malformed
    input so the caller can reject with 403. Uses a constant-time comparison.
    """
    if not signature_header or not app_secret:
        return False
    prefix, _, sent_digest = signature_header.partition("=")
    if prefix != "sha256" or not sent_digest:
        return False
    expected = hmac.new(app_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sent_digest, expected)


def parse_messaging_events(payload: dict) -> list[dict]:
    """Extract text-message events from a Messenger webhook payload.

    Returns a list of {"sender_id": str, "text": str}. Non-text events (delivery
    receipts, reads, echoes, attachments-only) are skipped.
    """
    events: list[dict] = []
    if not isinstance(payload, dict) or payload.get("object") != "page":
        return events
    for entry in payload.get("entry", []) or []:
        for messaging in entry.get("messaging", []) or []:
            message = messaging.get("message") or {}
            # Skip echoes of our own outgoing messages.
            if message.get("is_echo"):
                continue
            text = message.get("text")
            sender_id = (messaging.get("sender") or {}).get("id")
            if sender_id and isinstance(text, str) and text.strip():
                events.append({"sender_id": sender_id, "text": text.strip()})
    return events


async def send_fb_message(recipient_id: str, text: str, page_access_token: str) -> None:
    """Send a single text message via the Graph Send API (best-effort, never raises)."""
    params = {"access_token": page_access_token}
    payload = {
        "recipient": {"id": recipient_id},
        "messaging_type": "RESPONSE",
        "message": {"text": text},
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(_fb_graph_send_url(), params=params, json=payload, timeout=10.0)
            if resp.status_code != 200:
                logger.error(f"Facebook Send API failed: {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Error calling Facebook Send API: {e}")


async def handle_facebook_event(sender_id: str, text: str, tenant_id: str) -> None:
    """Background task: run the AI pipeline and push each bubble to Messenger."""
    try:
        page_access_token = os.getenv("FB_PAGE_ACCESS_TOKEN")
        if not page_access_token:
            logger.error("FB_PAGE_ACCESS_TOKEN not configured; cannot send Facebook reply.")
            return

        result = await generate_ai_bubbles(
            tenant_id=tenant_id,
            session_id=sender_id,
            user_message=text,
        )
        if result.get("skipped"):
            logger.info(f"Facebook session {sender_id} paused for human intervention; skipping AI reply.")
            return

        for bubble in result.get("bubbles", []):
            if bubble:
                await send_fb_message(sender_id, bubble, page_access_token)
    except Exception as e:
        import traceback
        logger.error(f"Unhandled error in handle_facebook_event ({tenant_id}/{sender_id}): {e}\n{traceback.format_exc()}")


@router.get("/facebook")
async def facebook_verify(request: Request):
    """Meta webhook verification handshake (GET).

    Echoes hub.challenge back only when hub.mode == 'subscribe' and hub.verify_token
    matches FB_VERIFY_TOKEN. Returns 403 otherwise.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    verify_token = os.getenv("FB_VERIFY_TOKEN")
    if not verify_token:
        logger.error("FB_VERIFY_TOKEN not configured; rejecting verification handshake.")
        raise HTTPException(status_code=403, detail="Verification not configured")

    if mode == "subscribe" and token and hmac.compare_digest(token, verify_token):
        return PlainTextResponse(content=challenge or "")

    logger.warning("Facebook webhook verification failed (bad mode or verify token).")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/facebook")
async def facebook_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str = Header(None),
):
    """Incoming Messenger events. Signature-verified, processed in the background."""
    app_secret = os.getenv("FB_APP_SECRET")
    if not app_secret:
        logger.error("FB_APP_SECRET not configured; rejecting Facebook webhook.")
        raise HTTPException(status_code=403, detail="Facebook webhook not configured")

    body = await request.body()

    # Never skip signature verification.
    if not verify_fb_signature(body, x_hub_signature_256, app_secret):
        logger.warning("Received invalid X-Hub-Signature-256 for Facebook webhook. Rejecting.")
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception as e:
        logger.error(f"Facebook webhook JSON parsing failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # ponytail: single-tenant for now, same as the LINE webhook. Per-channel tenant
    # mapping (FB Page ID -> tenant_id) goes here when multi-tenant routing ships.
    tenant_id = get_active_tenant_id()

    for event in parse_messaging_events(payload):
        background_tasks.add_task(
            handle_facebook_event, event["sender_id"], event["text"], tenant_id
        )

    # Always 200 quickly so Meta doesn't retry.
    return {"status": "ok"}
