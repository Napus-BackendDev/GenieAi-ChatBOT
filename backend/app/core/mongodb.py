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
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB (check MONGODB_URI / password): {e}")
        _mongo_client = None
        _mongo_db = None


def get_mongo_db():
    """Return the Motor database handle, or None if MongoDB isn't configured/connected."""
    return _mongo_db


def is_mongo_connected() -> bool:
    return _mongo_db is not None


async def close_mongo() -> None:
    global _mongo_client, _mongo_db
    if _mongo_client is not None:
        _mongo_client.close()
        logger.info("Closed MongoDB connection.")
    _mongo_client = None
    _mongo_db = None
