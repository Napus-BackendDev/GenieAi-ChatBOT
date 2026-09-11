"""Durable tenant deletion workflow.

The request path only locks the tenant and persists a job. Purge work is
idempotent, retryable, and never reports completion after a derived-store
failure. MongoDB is the durable queue in production; local JSON is supported
for isolated development only.
"""

import asyncio
import logging
import os
import shutil
import uuid
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.core.db import (
    db_delete_tenant_data,
    db_claim_deletion_job,
    db_get_tenant_remaining_counts,
    db_lock_and_create_deletion_job,
    db_update_deletion_job,
)

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def queue_tenant_deletion(tenant_id: str, idempotency_key: str) -> dict:
    """Lock access before enqueueing an idempotent purge job."""
    job = {
        "deletion_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "idempotency_key": idempotency_key,
        "status": "queued",
        "current_step": "locked",
        "attempts": 0,
        "created_at": _now(),
        "next_attempt_at": _now(),
    }
    saved = await db_lock_and_create_deletion_job(job)
    return saved


async def _clear_redis_tenant_state(tenant_id: str) -> None:
    from app.core.redis import get_redis

    client = get_redis()
    patterns = (
        f"tenant_cag_profile:{tenant_id}",
        f"chat_history:{tenant_id}:*",
        f"unread:{tenant_id}:*",
        f"human_intervention:{tenant_id}:*",
        f"webchat:rate:{tenant_id}:*",
        f"ai:budget:tenant:{tenant_id}:*",
        f"ai:requests:tenant:{tenant_id}:*",
        f"auth:revoked:{tenant_id}:*",
    )
    for pattern in patterns:
        if pattern.endswith("*"):
            async for key in client.scan_iter(match=pattern):
                await client.delete(key)
        else:
            await client.delete(pattern)


async def _clear_chroma_tenant_state(tenant_id: str) -> None:
    """Delete legacy embedded vectors until Mongo vector migration completes."""
    try:
        from app.services.rag import get_chroma_client, CHROMA_COLLECTION_NAME, _use_mongo_vectors

        if _use_mongo_vectors():
            return

        collection = get_chroma_client().get_or_create_collection(name=CHROMA_COLLECTION_NAME)
        collection.delete(where={"tenant_id": tenant_id})
    except Exception as exc:
        # Missing legacy collection is safe; all other failures must retry.
        if "does not exist" not in str(exc).lower() and "not found" not in str(exc).lower():
            raise RuntimeError("vector store purge failed") from exc


async def _clear_media_tenant_state(tenant_id: str) -> None:
    from app.services.media_storage import delete_tenant_media
    await delete_tenant_media(tenant_id)


async def _verify_tenant_purge(tenant_id: str) -> None:
    remaining = await db_get_tenant_remaining_counts(tenant_id)
    nonzero = {name: count for name, count in remaining.items() if count}
    if nonzero:
        raise RuntimeError("tenant purge verification failed")

    media_dir = os.path.join(settings.STATIC_IMAGES_PATH, tenant_id)
    if os.path.exists(media_dir):
        raise RuntimeError("tenant media purge verification failed")

    from app.core.redis import get_redis
    client = get_redis()
    stale_keys = []
    for pattern in (
        f"tenant_cag_profile:{tenant_id}",
        f"chat_history:{tenant_id}:*",
        f"unread:{tenant_id}:*",
        f"human_intervention:{tenant_id}:*",
        f"webchat:rate:{tenant_id}:*",
        f"ai:budget:tenant:{tenant_id}:*",
        f"ai:requests:tenant:{tenant_id}:*",
        f"auth:revoked:{tenant_id}:*",
    ):
        if pattern.endswith("*"):
            async for key in client.scan_iter(match=pattern):
                stale_keys.append(key)
        elif await client.exists(pattern):
            stale_keys.append(pattern)
    if stale_keys:
        raise RuntimeError("tenant Redis purge verification failed")


async def process_deletion_job(job: dict) -> None:
    job_id = job["deletion_id"]
    tenant_id = job["tenant_id"]
    try:
        await db_update_deletion_job(job_id, status="processing", current_step="database")
        await db_delete_tenant_data(tenant_id)

        await db_update_deletion_job(job_id, current_step="vectors")
        await _clear_chroma_tenant_state(tenant_id)

        await db_update_deletion_job(job_id, current_step="media")
        await _clear_media_tenant_state(tenant_id)

        await db_update_deletion_job(job_id, current_step="redis")
        try:
            await _clear_redis_tenant_state(tenant_id)
        except Exception:
            if settings.is_production:
                raise

        await db_update_deletion_job(job_id, current_step="verification")
        await _verify_tenant_purge(tenant_id)

        await db_update_deletion_job(
            job_id,
            status="completed",
            current_step="verified",
            completed_at=_now(),
            lease_until=None,
        )
        logger.info("Tenant deletion completed: %s", job_id)
    except Exception as exc:
        attempts = int(job.get("attempts") or 0)
        delay = min(3600, 2 ** min(attempts, 10))
        await db_update_deletion_job(
            job_id,
            status="retry",
            current_step="retry",
            last_error_code=type(exc).__name__,
            next_attempt_at=_now() + timedelta(seconds=delay),
            lease_until=None,
        )
        logger.error("Tenant deletion job failed and will retry: %s", job_id)


async def run_deletion_worker(stop_event: asyncio.Event) -> None:
    """Claim one Mongo job at a time; leases make multiple instances safe."""
    while not stop_event.is_set():
        try:
            job = await db_claim_deletion_job()
            if job:
                await process_deletion_job(job)
                continue
        except Exception:
            logger.exception("Deletion worker iteration failed")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=2.0)
        except asyncio.TimeoutError:
            pass
