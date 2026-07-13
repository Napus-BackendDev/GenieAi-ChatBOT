import json
import logging
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Keep only the last 10 messages (5 user turns and 5 assistant turns) to maintain concise LLM context
MAX_HISTORY_LENGTH = 10
# Expire chat history after 2 hours of inactivity
SESSION_TTL = 7200

async def get_chat_history(session_id: str, tenant_id: str = "default") -> list[dict]:
    """
    Retrieves the chat history for a session from Redis.
    """
    redis_client = get_redis()
    key = f"chat_history:{tenant_id}:{session_id}"
    
    try:
        data = await redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.error(f"Error reading chat history from Redis: {e}")
        
    return []

async def add_chat_message(session_id: str, role: str, content: str, tenant_id: str = "default") -> None:
    """
    Appends a new message to the session's chat history and resets the expiration TTL.
    """
    redis_client = get_redis()
    key = f"chat_history:{tenant_id}:{session_id}"
    
    try:
        # 1. Fetch current history
        history = await get_chat_history(session_id, tenant_id)
        
        # 2. Append new message
        history.append({
            "role": role,
            "content": content
        })
        
        # 3. Limit size
        if len(history) > MAX_HISTORY_LENGTH:
            history = history[-MAX_HISTORY_LENGTH:]
            
        # 4. Save and set expiry
        await redis_client.set(key, json.dumps(history), ex=SESSION_TTL)
        
    except Exception as e:
        logger.error(f"Error updating chat history in Redis: {e}")

async def clear_chat_history(session_id: str, tenant_id: str = "default") -> None:
    """
    Clears the chat history for a session.
    """
    redis_client = get_redis()
    key = f"chat_history:{tenant_id}:{session_id}"
    try:
        await redis_client.delete(key)
    except Exception as e:
        logger.error(f"Error clearing chat history in Redis: {e}")
