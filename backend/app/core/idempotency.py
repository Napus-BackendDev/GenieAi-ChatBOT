import hashlib
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import HTTPException

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)
_PENDING_TTL_SECONDS = 300
_COMPLETED_TTL_SECONDS = 86400


def _event_key(channel: str, tenant_id: str, event_id: str) -> str:
    digest = hashlib.sha256(event_id.encode("utf-8")).hexdigest()
    return f"webhook:dedupe:{channel}:{tenant_id}:{digest}"


async def claim_webhook_event(channel: str, tenant_id: str, event_id: str | None) -> bool:
    """Return True only for the first delivery of a platform webhook event."""
    if not event_id:
        return True

    key = _event_key(channel, tenant_id, event_id)
    try:
        return bool(
            await get_redis().set(
                key,
                "pending",
                ex=_PENDING_TTL_SECONDS,
                nx=True,
            )
        )
    except Exception as exc:
        logger.error("Webhook idempotency unavailable: %s", exc)
        if settings.is_production:
            raise HTTPException(
                status_code=503,
                detail="Webhook processing is temporarily unavailable.",
            ) from exc
        return True


async def run_claimed_webhook_event(
    channel: str,
    tenant_id: str,
    event_id: str | None,
    handler: Callable[..., Awaitable[Any]],
    *args: Any,
) -> None:
    """Mark a claimed event complete only after its handler succeeds."""
    if not event_id:
        await handler(*args)
        return

    key = _event_key(channel, tenant_id, event_id)
    redis_client = get_redis()
    try:
        await handler(*args)
    except Exception:
        try:
            await redis_client.delete(key)
        except Exception as release_exc:
            logger.error("Failed to release webhook claim: %s", release_exc)
        raise

    await redis_client.set(key, "completed", ex=_COMPLETED_TTL_SECONDS)
