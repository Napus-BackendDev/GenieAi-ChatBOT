import logging
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client: aioredis.Redis | None = None

async def init_redis() -> aioredis.Redis:
    """
    Initialize the asynchronous Redis connection pool.
    """
    global redis_client
    try:
        logger.info("Initializing connection to remote Redis...")
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_timeout=5.0,
            socket_keepalive=True
        )
        # Test connection
        await redis_client.ping()
        logger.info("Successfully connected to Redis.")
        return redis_client
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        raise e

async def close_redis() -> None:
    """
    Close the Redis connection pool.
    """
    global redis_client
    if redis_client:
        logger.info("Closing Redis connection pool...")
        await redis_client.close()
        logger.info("Redis connection pool closed.")

def get_redis() -> aioredis.Redis:
    """
    Get the global Redis client instance.
    """
    if redis_client is None:
        raise RuntimeWarning("Redis client is not initialized. Call init_redis() first.")
    return redis_client
