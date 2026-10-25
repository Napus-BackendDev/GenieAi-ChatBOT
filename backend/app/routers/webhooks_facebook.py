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
from app.core.config import settings

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
        # entry.id is the Page ID that received the message — the routing key.
        page_id = str(entry.get("id") or "")
        for messaging in entry.get("messaging", []) or []:
            message = messaging.get("message") or {}
            # Skip echoes of our own outgoing messages.
            if message.get("is_echo"):
                continue
            text = message.get("text")
            sender_id = (messaging.get("sender") or {}).get("id")
            if sender_id and isinstance(text, str) and text.strip():
                parsed = {
                    "sender_id": sender_id,
                    "text": text.strip(),
                    "page_id": page_id,
                }
                if message.get("mid"):
                    parsed["message_id"] = message["mid"]
                events.append(parsed)
    return events


async def send_fb_message(recipient_id: str, text: str, page_access_token: str) -> None:
    """Send a message and raise on delivery failure so the durable inbox retries."""
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
                logger.error("Facebook Send API failed: %s", resp.status_code)
                raise RuntimeError("FACEBOOK_SEND_FAILED")
        except httpx.HTTPError as e:
            logger.error("Error calling Facebook Send API: %s", type(e).__name__)
            raise RuntimeError("FACEBOOK_SEND_REQUEST_FAILED") from e


async def handle_facebook_event(sender_id: str, text: str, tenant_id: str) -> None:
    """Background task: run the AI pipeline and push each bubble to Messenger."""
    try:
        # Prefer the tenant's own Page access token (multi-tenant); fall back to the
        # global env token for single-page/legacy setups.
        page_access_token = ""
        try:
            from app.core.db import db_load_profile
            profile = await db_load_profile(tenant_id)
            page_access_token = (profile or {}).get("facebook_page_access_token") or ""
            if (profile or {}).get("facebook_verified") is not True:
                logger.warning("Facebook channel is not verified; outbound processing disabled")
                return
        except Exception as exc:
            if settings.is_production:
                raise RuntimeError("FACEBOOK_PROFILE_UNAVAILABLE") from exc
            logger.warning("Facebook tenant profile unavailable locally: %s", type(exc).__name__)
        if not page_access_token and not settings.is_production:
            page_access_token = os.getenv("FB_PAGE_ACCESS_TOKEN") or ""
        if not page_access_token:
            raise RuntimeError("FACEBOOK_CHANNEL_NOT_VERIFIED")

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
        logger.error("Unhandled error in handle_facebook_event: %s", type(e).__name__)
        raise


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

    # Multi-tenant routing: resolve the owning tenant from the Page ID (entry.id).
    # Fall back to the active tenant only when NO page mapping exists at all
    # (single-page/legacy setups) so we never silently misroute a configured page.
    from app.core.db import db_resolve_tenant_by_fb_page_id
    from app.core.mongodb import is_mongo_connected
    if settings.is_production and not is_mongo_connected():
        raise HTTPException(status_code=503, detail="Webhook queue is temporarily unavailable")

    for event in parse_messaging_events(payload):
        page_id = event.get("page_id")
        tenant_id = await db_resolve_tenant_by_fb_page_id(page_id)
        if not tenant_id:
            logger.warning("Facebook page %s is not mapped; event quarantined.", page_id)
            continue
        from app.core.db import db_get_user_by_tenant
        tenant_user = await db_get_user_by_tenant(tenant_id)
        if tenant_user and tenant_user.get("status", "active") != "active":
            logger.warning("Ignoring Facebook webhook for inactive tenant %s (%s)", tenant_id, tenant_user.get("status"))
            continue
        if is_mongo_connected():
            from app.services.webhook_queue import enqueue_webhook_event
            await enqueue_webhook_event(
                "facebook",
                tenant_id,
                event.get("message_id"),
                {"sender_id": event["sender_id"], "text": event["text"]},
            )
            continue
        if settings.is_production:
            raise HTTPException(status_code=503, detail="Webhook queue is temporarily unavailable")
        from app.core.idempotency import claim_webhook_event, run_claimed_webhook_event
        event_id = event.get("message_id")
        if not await claim_webhook_event(
            "facebook", tenant_id, event_id
        ):
            continue
        background_tasks.add_task(
            run_claimed_webhook_event,
            "facebook",
            tenant_id,
            event_id,
            handle_facebook_event,
            event["sender_id"],
            event["text"],
            tenant_id,
        )

    # Always 200 quickly so Meta doesn't retry.
    return {"status": "ok"}
