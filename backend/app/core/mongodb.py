"""
MongoDB (Atlas) connection helper using Motor (async).

The connection is OPTIONAL: if settings.MONGODB_URI is empty the app keeps using
its existing JSON-file storage and every helper here is a graceful no-op. This lets
us wire MongoDB in ahead of the full data migration without breaking anything.
"""
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

_mongo_client = None
_mongo_db = None


async def init_mongo() -> None:
    """
    Connect to MongoDB if MONGODB_URI is configured. Verifies the connection with a
    ping. On any failure we log and fall back to None (JSON storage keeps working).
    """
    global _mongo_client, _mongo_db

    if not settings.MONGODB_URI:
        logger.info("MONGODB_URI not set — skipping MongoDB (still using local JSON storage).")
        return

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
    except ImportError:
        logger.error("motor is not installed. Run 'pip install motor' to enable MongoDB.")
        return

    try:
        _mongo_client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
        # Force a round-trip so a bad URI/password fails fast at startup
        await _mongo_client.admin.command("ping")
        _mongo_db = _mongo_client[settings.MONGODB_DB_NAME]
        logger.info(f"Connected to MongoDB database '{settings.MONGODB_DB_NAME}'.")
        await _ensure_indexes(_mongo_db)
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB (check MONGODB_URI / password): {e}")
        _mongo_client = None
        _mongo_db = None


async def _ensure_indexes(db) -> None:
    """Ensure MongoDB indexes used for tenant isolation and common queries.
    create_index is idempotent, so this is safe to run on every startup. Best-effort —
    an index error must never take down the app (JSON fallback would still work)."""
    try:
        await db.users.create_index("tenant_id", unique=True, name="uniq_tenant_id")
        await db.users.create_index(
            "email_normalized",
            unique=True,
            name="uniq_email_normalized",
            partialFilterExpression={"email_normalized": {"$gt": ""}},
        )
        await db.users.create_index(
            "google_sub",
            unique=True,
            name="uniq_google_sub",
            partialFilterExpression={"google_sub": {"$gt": ""}},
        )
        await db.tenant_profiles.create_index("tenant_id", unique=True, name="uniq_tenant_id")
        # Durable chat inbox: one doc per (tenant, session); list sorted by recency.
        await db.conversations.create_index(
            [("tenant_id", 1), ("session_id", 1)], unique=True, name="uniq_tenant_session"
        )
        await db.conversations.create_index(
            [("tenant_id", 1), ("updated_at", -1)], name="tenant_recent"
        )
        # Fast reverse lookup for Facebook webhook routing (page_id -> tenant).
        await db.tenant_profiles.create_index(
            "facebook_page_id",
            unique=True,
            name="uniq_fb_page_id",
            partialFilterExpression={"facebook_page_id": {"$gt": ""}},
        )
        # Fast reverse lookup for LINE webhook routing (bot_user_id -> tenant).
        await db.tenant_profiles.create_index(
            "line_bot_user_id",
            unique=True,
            name="uniq_line_bot_user_id",
            partialFilterExpression={"line_bot_user_id": {"$gt": ""}},
        )
        await db.documents.create_index("tenant_id", name="idx_tenant_id")
        await db.documents.create_index(
            [("tenant_id", 1), ("content_hash", 1)],
            unique=True,
            name="uniq_tenant_content",
            partialFilterExpression={"content_hash": {"$exists": True}},
        )
        await db.bookings.create_index("tenant_id", name="idx_tenant_id")
        await db.bookings.create_index("booking_datetime", name="idx_booking_datetime")
        await db.bookings.create_index(
            [("tenant_id", 1), ("idempotency_key", 1)],
            unique=True,
            name="uniq_booking_idempotency",
            partialFilterExpression={"idempotency_key": {"$exists": True}},
        )
        await db.tenant_deletion_jobs.create_index(
            [("tenant_id", 1), ("idempotency_key", 1)],
            unique=True,
            name="uniq_tenant_deletion_idempotency",
        )
        await db.tenant_deletion_jobs.create_index(
            [("status", 1), ("next_attempt_at", 1), ("created_at", 1)],
            name="deletion_worker_queue",
        )
        await db.tenant_deletion_jobs.create_index(
            "completed_at",
            expireAfterSeconds=30 * 24 * 60 * 60,
            name="deletion_receipt_ttl",
            partialFilterExpression={"status": "completed"},
        )
        await db.webhook_events.create_index(
            [("channel", 1), ("tenant_id", 1), ("provider_event_id", 1)],
            unique=True,
            name="uniq_webhook_event",
        )
        await db.webhook_events.create_index(
            [("status", 1), ("next_attempt_at", 1), ("received_at", 1)],
            name="webhook_worker_queue",
        )
        await db.conversation_messages.create_index(
            [("tenant_id", 1), ("session_id", 1), ("created_at", 1)],
            name="conversation_message_timeline",
        )
        await db.conversation_messages.create_index(
            "expires_at", expireAfterSeconds=0, name="conversation_message_retention"
        )
        await db.knowledge_chunks.create_index(
            [("tenant_id", 1), ("document_id", 1), ("chunk_index", 1)],
            unique=True,
            name="uniq_knowledge_chunk",
        )
        await db.booking_slot_locks.create_index(
            [("tenant_id", 1), ("staff_name", 1), ("slot_start_utc", 1)],
            unique=True,
            name="uniq_booking_slot",
        )
        await db["media.files"].create_index(
            "metadata.tenant_id", name="media_tenant_lookup"
        )
        await db["media.files"].create_index(
            [("metadata.tenant_id", 1), ("metadata.document_id", 1)],
            name="media_document_lookup",
        )
    except Exception as e:
        logger.warning(f"Could not ensure indexes: {e}")
        if settings.is_production:
            raise


def get_mongo_db():
    """Return the Motor database handle, or None if MongoDB isn't configured/connected."""
    return _mongo_db


def is_mongo_connected() -> bool:
    return _mongo_db is not None


async def ping_mongo() -> bool:
    if _mongo_client is None:
        return False
    try:
        await _mongo_client.admin.command("ping")
        return True
    except Exception:
        return False


async def close_mongo() -> None:
    global _mongo_client, _mongo_db
    if _mongo_client is not None:
        _mongo_client.close()
        logger.info("Closed MongoDB connection.")
    _mongo_client = None
    _mongo_db = None
