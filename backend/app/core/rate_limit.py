async def increment_with_expiry(redis_client, key: str, window_seconds: int) -> int:
    """Atomically initialize a fixed-window counter with a TTL and increment it."""
    pipeline = redis_client.pipeline(transaction=True)
    pipeline.set(key, "0", ex=window_seconds, nx=True)
    pipeline.incr(key)
    _, count = await pipeline.execute()
    return int(count)
