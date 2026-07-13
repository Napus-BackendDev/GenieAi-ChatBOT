import os
import json
import logging
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from app.core.security import get_current_tenant
from app.services.redis_service import get_chat_history, add_chat_message
from app.services.rag import retrieve_hybrid_context
from app.services.openai_service import chat_completion_with_tools

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])

# Marker the AI appends when it decides to hand off to a human agent.
HANDOFF_MARKER = "[[HANDOFF]]"

class ChatRequest(BaseModel):
    user_message: str
    session_id: str = "sandbox_session"
    tenant_id: str = "default"

@router.post("")
async def sandbox_chat(req: ChatRequest, current_tenant: str = Depends(get_current_tenant)):
    """
    Direct chat endpoint for the Admin Dashboard Chat Sandbox.
    Mimics LINE webhook logic but returns raw structured data for UI rendering.
    tenant_id is taken from the verified token, never the request body.
    """
    user_message = req.user_message.strip()
    # Strip the handoff marker from inbound customer text so a customer cannot
    # inject "[[HANDOFF]]" to force a self-handoff / silently pause their own AI.
    user_message = user_message.replace(HANDOFF_MARKER, "")
    session_id = req.session_id.strip()
    tenant_id = current_tenant
    
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
        
    try:
        # 1. Retrieve RAG/CAG hybrid context & associated page images
        rag_result = await retrieve_hybrid_context(user_message, tenant_id=tenant_id)
        doc_context = rag_result.get("context", "")
        images = rag_result.get("images", [])
        citations = rag_result.get("citations", [])
        mode = rag_result.get("mode", "rag")
        
        # Load tenant profile via the shared, tenant-agnostic builder
        from app.services.prompt import load_tenant_profile_context, build_system_prompt, build_rag_context_message
        profile_context = load_tenant_profile_context(tenant_id)
        
        # Merge contexts (prioritizing structured profile if it exists)
        full_context = ""
        if profile_context:
            full_context += profile_context + "\n====================\nข้อมูลเพิ่มเติมจากเอกสารความรู้:\n"
        full_context += doc_context
        
        # 2. Get chat history from Redis
        history = await get_chat_history(session_id=session_id, tenant_id=tenant_id)
        
        # 3. Add current user message to Redis history
        await add_chat_message(session_id=session_id, role="user", content=user_message, tenant_id=tenant_id)
        
        # 4. Build system prompt from the shared, tenant-agnostic builder
        system_prompt = build_system_prompt(mode, full_context)
        rag_context_message = None if mode == "cag" else build_rag_context_message(full_context)
            
        # Inject current time as instructions at the end of history to prevent cache invalidation
        current_time_str = datetime.now().strftime("%A, %d %B %Y %H:%M")
        time_instruction_msg = {
            "role": "system",
            "content": f"[SYSTEM INFO] ข้อมูลปัจจุบัน (Current Time): วันนี้คือวัน {current_time_str}. ให้ใช้ข้อมูลนี้ประกอบการระบุวันเวลาสำหรับนัดหมาย เช่น 'วันพรุ่งนี้' หรือ 'วันศุกร์นี้'."
        }
        
        # Construct final message thread
        final_messages = history.copy()
        final_messages.append(time_instruction_msg)
        if rag_context_message:
            final_messages.append(rag_context_message)
        final_messages.append({"role": "user", "content": user_message})
        
        # 5. Call OpenAI
        ai_response = await chat_completion_with_tools(
            messages=final_messages,
            system_prompt=system_prompt,
            tenant_id=tenant_id
        )
        
        # Detect AI-initiated handoff marker and strip it before saving/returning
        requires_human = HANDOFF_MARKER in ai_response
        if requires_human:
            ai_response = ai_response.replace(HANDOFF_MARKER, "").strip()

        # 6. Save AI reply to Redis history
        await add_chat_message(session_id=session_id, role="assistant", content=ai_response, tenant_id=tenant_id)

        if requires_human:
            try:
                from app.core.redis import get_redis
                redis_client = get_redis()
                await redis_client.set(f"human_intervention:{tenant_id}:{session_id}", "1")
            except Exception as re:
                logger.warning(f"Failed to flag session in Redis: {re}")
                
        # Check if response is about promotions → attach promotion images if any
        promo_keywords = ["โปรโมชัน", "โปรโมท", "โปร", "promotion", "ส่วนลด", "ลดราคา", "โปรพิเศษ"]
        is_promo_topic = any(kw in user_message.lower() for kw in promo_keywords) or \
                         any(kw in ai_response.lower() for kw in promo_keywords)
        
        if is_promo_topic:
            try:
                from app.routers.webhooks import load_tenant_promotions
                promotions = load_tenant_promotions(tenant_id)
                for p in promotions:
                    p_img = p.get("image_url")
                    if p_img and p_img not in images:
                        images.append(p_img)
            except Exception as pe:
                logger.warning(f"Failed to append promotion images to sandbox chat response: {pe}")

        return {
            "ai_response": ai_response,
            "citations": citations,
            "images": images,
            "mode": mode,
            "requires_human": requires_human
        }
        
    except Exception as e:
        logger.error(f"Error in sandbox_chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chat completion.")

class ReplyRequest(BaseModel):
    session_id: str
    message: str
    tenant_id: str = "default"

async def get_line_user_profile(user_id: str, tenant_id: str) -> dict:
    from app.core.redis import get_redis
    from app.routers.webhooks import get_tenant_line_credentials
    import json
    import httpx
    
    redis_client = get_redis()
    cache_key = f"line_profile:{tenant_id}:{user_id}"
    
    # Try reading cache
    cached = await redis_client.get(cache_key)
    if cached:
        try:
            return json.loads(cached.decode("utf-8") if isinstance(cached, bytes) else cached)
        except Exception:
            pass
            
    # If not cached, fetch from LINE API
    access_token, _ = get_tenant_line_credentials(tenant_id)
    url = f"https://api.line.me/v2/bot/profile/{user_id}"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, headers=headers, timeout=2.0)
            if res.status_code == 200:
                profile_data = res.json()
                # Cache for 7 days (604800 seconds)
                await redis_client.setex(cache_key, 604800, json.dumps(profile_data))
                return profile_data
        except Exception as e:
            logger.error(f"Error fetching LINE profile for {user_id}: {e}")
            
    # Fallback default
    return {
        "displayName": f"LINE User ({user_id[:8]})",
        "pictureUrl": f"https://api.dicebear.com/7.x/bottts/svg?seed={user_id}"
    }

@router.get("/sessions")
async def get_chat_sessions(tenant_id: str = Depends(get_current_tenant)):
    """
    Get all active chat sessions for the AUTHENTICATED tenant.
    """
    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        # Scan keys
        keys = await redis_client.keys(f"chat_history:{tenant_id}:*")
        
        real_chats = []
        for key in keys:
            key_str = key.decode("utf-8") if isinstance(key, bytes) else key
            parts = key_str.split(":")
            if len(parts) >= 3:
                s_id = parts[2]
                # Skip sandbox session to avoid showing sandbox tests in the LINE list
                if "sandbox" in s_id:
                    continue
                history = await get_chat_history(session_id=s_id, tenant_id=tenant_id)
                if history:
                    # Resolve real profile name and avatar from LINE API
                    profile = await get_line_user_profile(s_id, tenant_id)
                    display_name = profile.get("displayName") or f"LINE User ({s_id[:8]})"
                    if not display_name.endswith(" (LINE)"):
                        display_name = f"{display_name} (LINE)"
                    # Check if session requires human intervention
                    requires_human = await redis_client.exists(f"human_intervention:{tenant_id}:{s_id}")
                    
                    # Get last message details
                    last_msg = history[-1] if history else {"role": "assistant", "content": ""}
                    real_chats.append({
                        "id": s_id,
                        "name": display_name,
                        "avatar": profile.get("pictureUrl") or f"https://api.dicebear.com/7.x/bottts/svg?seed={s_id}",
                        "lastMessage": last_msg["content"],
                        "time": "Active now",
                        "unread": False,
                        "history": history,
                        "requires_human": bool(requires_human)
                    })
        return real_chats
    except Exception as e:
        logger.error(f"Error listing chat sessions: {e}")
        return []

@router.post("/reply")
async def reply_to_session(req: ReplyRequest, current_tenant: str = Depends(get_current_tenant)):
    from app.routers.webhooks import push_to_line
    from app.core.redis import get_redis
    session_id = req.session_id.strip()
    message = req.message.strip()
    tenant_id = current_tenant
    
    if not message:
        raise HTTPException(status_code=400, detail="Reply message cannot be empty")
        
    try:
        # Append message to Redis history
        await add_chat_message(session_id=session_id, role="assistant", content=message, tenant_id=tenant_id)

        # NOTE: sending a reply does NOT resume the AI. The AI stays paused (human
        # mode) until the admin explicitly resumes it via POST /api/chat/resume.

        # If it's a real LINE user (session_id doesn't start with mock_), push to LINE messaging API
        if not session_id.startswith("mock_"):
            line_message = [{"type": "text", "text": message}]
            await push_to_line(user_id=session_id, messages=line_message)
            
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error in reply_to_session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send reply: {str(e)}")


class AIModeRequest(BaseModel):
    session_id: str
    tenant_id: str = "default"


@router.post("/pause")
async def pause_ai(req: AIModeRequest, current_tenant: str = Depends(get_current_tenant)):
    """
    Admin manually pauses the AI for a session (enters human mode).
    The AI stays paused until /resume is called.
    """
    from app.core.redis import get_redis
    session_id = req.session_id.strip()
    tenant_id = current_tenant
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    try:
        redis_client = get_redis()
        await redis_client.set(f"human_intervention:{tenant_id}:{session_id}", "1")
        logger.info(f"Admin paused AI for session {session_id} (tenant {tenant_id}).")
        return {"status": "success", "requires_human": True}
    except Exception as e:
        logger.error(f"Error pausing AI for {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to pause AI.")


@router.post("/resume")
async def resume_ai(req: AIModeRequest, current_tenant: str = Depends(get_current_tenant)):
    """
    Admin resumes the AI for a session (exits human mode). The AI continues
    from the existing conversation context stored in Redis.
    """
    from app.core.redis import get_redis
    session_id = req.session_id.strip()
    tenant_id = current_tenant
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    try:
        redis_client = get_redis()
        await redis_client.delete(f"human_intervention:{tenant_id}:{session_id}")
        logger.info(f"Admin resumed AI for session {session_id} (tenant {tenant_id}).")
        return {"status": "success", "requires_human": False}
    except Exception as e:
        logger.error(f"Error resuming AI for {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to resume AI.")
