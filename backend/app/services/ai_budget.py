"""Atomic AI usage guardrails shared by chat, embeddings, and OCR callers."""

from datetime import datetime, timezone
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIBudgetExceeded(RuntimeError):
    """Provider call refused before any billable request was sent."""


def estimate_tokens(value: str, output_cap: int = 0) -> int:
    # Conservative estimate; provider usage is reconciled after the response.
    return max(1, len(value or "") // 4 + max(0, output_cap))


def _day_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


async def reserve(tenant_id: str, estimated_tokens: int) -> tuple[str, str, int]:
    """Reserve global, tenant token budget and tenant request budget atomically."""
    if settings.AI_PROVIDER == "disabled":
        raise AIBudgetExceeded("AI provider disabled")
    amount = max(1, min(int(estimated_tokens), settings.AI_GLOBAL_DAILY_TOKEN_CAP))
    from app.core.redis import get_redis

    day = _day_key()
    global_key = f"ai:budget:global:{day}"
    tenant_key = f"ai:budget:tenant:{tenant_id}:{day}"
    request_key = f"ai:requests:tenant:{tenant_id}:{day}"
    script = """
    local gt = tonumber(redis.call('GET', KEYS[1]) or '0')
    local tt = tonumber(redis.call('GET', KEYS[2]) or '0')
    local rc = tonumber(redis.call('GET', KEYS[3]) or '0')
    if gt + tonumber(ARGV[1]) > tonumber(ARGV[2]) then return 0 end
    if tt + tonumber(ARGV[1]) > tonumber(ARGV[3]) then return 0 end
    if rc + 1 > tonumber(ARGV[4]) then return 0 end
    redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
    redis.call('INCRBY', KEYS[2], tonumber(ARGV[1]))
    redis.call('INCRBY', KEYS[3], 1)
    redis.call('EXPIRE', KEYS[1], 172800)
    redis.call('EXPIRE', KEYS[2], 172800)
    redis.call('EXPIRE', KEYS[3], 172800)
    return 1
    """
    try:
        client = get_redis()
        accepted = await client.eval(
            script,
            3,
            global_key,
            tenant_key,
            request_key,
            amount,
            settings.AI_GLOBAL_DAILY_TOKEN_CAP,
            settings.AI_TENANT_DAILY_TOKEN_CAP,
            settings.AI_TENANT_DAILY_REQUEST_CAP,
        )
    except Exception as exc:
        if settings.is_production:
            raise AIBudgetExceeded("AI budget meter unavailable") from exc
        logger.warning("AI budget meter unavailable in local mode: %s", type(exc).__name__)
        return (global_key, tenant_key, amount)
    if int(accepted or 0) != 1:
        raise AIBudgetExceeded("AI budget exceeded")
    return (global_key, tenant_key, amount)


async def reconcile(reservation: tuple[str, str, int], actual_tokens: int) -> None:
    global_key, tenant_key, reserved = reservation
    refund = max(0, int(reserved) - max(0, int(actual_tokens)))
    if not refund:
        return
    try:
        from app.core.redis import get_redis
        client = get_redis()
        await client.decrby(global_key, refund)
        await client.decrby(tenant_key, refund)
    except Exception as exc:
        # Over-reservation is safer than exceeding a hard cap; alerting can
        # surface the discrepancy without making another provider call.
        logger.warning("AI budget reconciliation failed: %s", type(exc).__name__)
