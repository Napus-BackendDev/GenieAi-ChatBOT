"""Mongo-backed webhook inbox/outbox worker.

Redis remains a cache/rate-limit optimization. In production, provider events
are acknowledged only after this durable inbox accepts them.
"""

import asyncio
import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

from app.core.mongodb import get_mongo_db

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def stable_event_id(channel: str, tenant_id: str, provider_event_id: str | None, payload: dict) -> str:
    if provider_event_id:
        return provider_event_id
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return f"generated-{hashlib.sha256(f'{channel}:{tenant_id}:{raw}'.encode()).hexdigest()}"


def _minimize_payload(channel: str, payload: dict) -> dict:
    """Persist only fields required by the worker; avoid retaining provider noise/PII."""
    if channel == "line":
        event = payload.get("event") or {}
        return {
            "event": {
                "type": event.get("type"),
                "webhookEventId": event.get("webhookEventId"),
                "replyToken": event.get("replyToken"),
                "source": {"userId": (event.get("source") or {}).get("userId")},
                "message": {
                    "type": (event.get("message") or {}).get("type"),
                    "text": (event.get("message") or {}).get("text"),
                },
            },
            "base_url": payload.get("base_url", ""),
        }
    if channel == "facebook":
        return {"sender_id": payload.get("sender_id"), "text": payload.get("text")}
    return {}


async def enqueue_webhook_event(
    channel: str,
    tenant_id: str,
    provider_event_id: str | None,
    payload: dict,
) -> bool:
    db = get_mongo_db()
    if db is None:
        return False
    event_id = stable_event_id(channel, tenant_id, provider_event_id, payload)
    document = {
        "channel": channel,
        "tenant_id": tenant_id,
        "provider_event_id": event_id,
        "payload": _minimize_payload(channel, payload),
        "status": "received",
        "attempts": 0,
        "received_at": _now(),
        "next_attempt_at": _now(),
    }
    try:
        await db.webhook_events.insert_one(document)
        return True
    except Exception as exc:
        existing = await db.webhook_events.find_one({
            "channel": channel,
            "tenant_id": tenant_id,
            "provider_event_id": event_id,
        })
        if existing:
            return True
        logger.error("Could not enqueue webhook event: %s", type(exc).__name__)
        raise


async def _claim_event(lease_seconds: int = 60) -> dict | None:
    db = get_mongo_db()
    if db is None:
        return None
    from pymongo import ReturnDocument

    now = _now()
    event = await db.webhook_events.find_one_and_update(
        {
            "$or": [
                {"status": {"$in": ["received", "retry"]}, "$or": [
                    {"next_attempt_at": {"$exists": False}},
                    {"next_attempt_at": {"$lte": now}},
                ]},
                {"status": "processing", "lease_until": {"$lte": now}},
            ],
        },
        {"$set": {"status": "processing", "lease_until": now + timedelta(seconds=lease_seconds), "updated_at": now}, "$inc": {"attempts": 1}},
        sort=[("received_at", 1)],
        return_document=ReturnDocument.AFTER,
    )
    if event:
        event.pop("_id", None)
    return event


async def _dispatch(event: dict) -> None:
    payload = event.get("payload") or {}
    channel = event.get("channel")
    if channel == "line":
        from app.routers.webhooks import handle_line_event
        await handle_line_event(
            payload["event"],
            payload.get("base_url", ""),
            event["tenant_id"],
        )
    elif channel == "facebook":
        from app.routers.webhooks_facebook import handle_facebook_event
        await handle_facebook_event(
            payload["sender_id"],
            payload["text"],
            event["tenant_id"],
        )
    else:
        raise ValueError("unsupported webhook channel")


async def _process_event(event: dict) -> None:
    db = get_mongo_db()
    if db is None:
        return
    event_id = event["provider_event_id"]
    try:
        await _dispatch(event)
        await db.webhook_events.update_one(
            {"channel": event["channel"], "tenant_id": event["tenant_id"], "provider_event_id": event_id},
            {"$set": {"status": "completed", "completed_at": _now(), "lease_until": None}},
        )
    except Exception as exc:
        attempts = int(event.get("attempts") or 0)
        max_attempts = 8
        if attempts >= max_attempts:
            status = "dead_letter"
            next_attempt = None
        else:
            status = "retry"
            next_attempt = _now() + timedelta(seconds=min(3600, 2 ** min(attempts, 10)))
        await db.webhook_events.update_one(
            {"channel": event["channel"], "tenant_id": event["tenant_id"], "provider_event_id": event_id},
            {"$set": {"status": status, "next_attempt_at": next_attempt, "last_error_code": type(exc).__name__, "lease_until": None}},
        )
        logger.error("Webhook event failed: %s", event_id)


async def run_webhook_worker(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            event = await _claim_event()
            if event:
                await _process_event(event)
                continue
        except Exception:
            logger.exception("Webhook worker iteration failed")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1.5)
        except asyncio.TimeoutError:
            pass
