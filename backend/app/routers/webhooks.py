import os
import re
import json
import hmac
import hashlib
import base64
import logging
import asyncio
import random
import httpx
from datetime import datetime
from fastapi import APIRouter, Request, Header, HTTPException, BackgroundTasks, Depends
from app.core.config import settings
from app.core.security import require_tenant
from app.services.redis_service import get_chat_history, add_chat_message
from app.services.rag import query_knowledge_base, retrieve_hybrid_context
from app.services.openai_service import chat_completion_with_tools

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"
# Official "typing..." animation shown in the user's 1-on-1 chat while the bot
# is composing — this is what makes replies feel human (like AIS's LINE OA).
LINE_LOADING_URL = "https://api.line.me/v2/bot/chat/loading/start"

# Marker the AI appends to its reply when it decides to hand the conversation
# off to a human agent. Detected server-side, then stripped before sending.
HANDOFF_MARKER = "[[HANDOFF]]"

def contains_emoji(text: str) -> bool:
    """
    Checks if a string contains any emoji character from common unicode blocks.
    """
    for char in text:
        codepoint = ord(char)
        if (0x1F300 <= codepoint <= 0x1F5FF) or \
           (0x1F600 <= codepoint <= 0x1F64F) or \
           (0x1F680 <= codepoint <= 0x1F6FF) or \
           (0x1F900 <= codepoint <= 0x1F9FF) or \
           (0x1FA70 <= codepoint <= 0x1FAFF) or \
           (0x2700 <= codepoint <= 0x27BF) or \
           (0x2600 <= codepoint <= 0x26FF):
            return True
    return False

def _strip_markdown(text: str) -> str:
    """
    Strips markdown syntax so LINE displays clean plain text.
    """
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    text = re.sub(r'_(.+?)_', r'\1', text)
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`(.+?)`', r'\1', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*[-*]\s+', '• ', text, flags=re.MULTILINE)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def split_to_line_bubbles(text: str, max_bubbles: int = 5) -> list[str]:
    """
    Splits AI response into multiple LINE chat bubbles.
    The AI uses '---' as a separator between logical message parts.
    Falls back to splitting on double-newlines if no separator found.
    LINE API allows max 5 messages per request.
    """
    text = _strip_markdown(text)

    if '---' in text:
        parts = [p.strip() for p in text.split('---') if p.strip()]
    elif '\n\n' in text:
        parts = [p.strip() for p in text.split('\n\n') if p.strip()]
    else:
        return [text]

    if len(parts) <= max_bubbles:
        return parts

    # If too many parts, merge the overflow into the last allowed bubble
    merged = parts[:max_bubbles - 1]
    merged.append('\n\n'.join(parts[max_bubbles - 1:]))
    return merged

def build_promo_flex_carousel(promotions: list, base_url: str) -> dict:
    """
    Builds a LINE Flex Message carousel from promotions that have image_url.
    Each promotion becomes a clean, image-only bubble in the carousel.
    """
    bubbles = []
    for promo in promotions:
        img_url = promo.get("image_url")
        if not img_url:
            continue
        full_img_url = f"{base_url.rstrip('/')}{img_url}"

        bubble = {
            "type": "bubble",
            "size": "mega",
            "body": {
                "type": "box",
                "layout": "vertical",
                "paddingAll": "0px",
                "contents": [
                    {
                        "type": "image",
                        "url": full_img_url,
                        "size": "full",
                        "aspectRatio": "1:1",
                        "aspectMode": "cover",
                        "action": {
                            "type": "message",
                            "label": "สนใจโปรนี้",
                            "text": f"สนใจ {promo['name']}"
                        }
                    }
                ]
            }
        }
        bubbles.append(bubble)

    if not bubbles:
        return None

    return {
        "type": "flex",
        "altText": "โปรโมชันพิเศษจากร้าน",
        "contents": {
            "type": "carousel",
            "contents": bubbles[:10]  # LINE carousel max 10 bubbles
        }
    }


def load_tenant_promotions(tenant_id: str) -> list:
    """Load promotions from tenant profile JSON."""
    profile_path = f"data/tenant_profile_{tenant_id}.json"
    if not os.path.exists(profile_path):
        return []
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            p = json.load(f)
            return p.get("promotions", [])
    except Exception:
        return []


def verify_line_signature(body: bytes, signature: str, channel_secret: str = None) -> bool:
    """
    Verifies that the webhook request is authentic and sent by LINE.
    """
    if not signature:
        return False
    secret = channel_secret if channel_secret is not None else settings.LINE_CHANNEL_SECRET
    hash_val = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).digest()
    expected_signature = base64.b64encode(hash_val).decode("utf-8")
    return hmac.compare_digest(signature, expected_signature)

async def push_to_line(user_id: str, messages: list[dict], access_token: str = None) -> None:
    """
    Sends a push message to a LINE user (no reply token needed, works anytime).
    """
    token = access_token if access_token is not None else settings.LINE_CHANNEL_ACCESS_TOKEN
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    payload = {
        "to": user_id,
        "messages": messages
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(LINE_PUSH_URL, json=payload, headers=headers)
            if response.status_code != 200:
                logger.error(f"Failed to push to LINE. Status: {response.status_code}, Body: {response.text}")
            else:
                logger.info(f"Successfully pushed message to LINE user {user_id}.")
        except Exception as e:
            logger.error(f"Error calling LINE Push API: {e}")

async def reply_to_line(reply_token: str, messages: list[dict], access_token: str = None, fallback_user_id: str = None) -> None:
    """
    Tries reply first (free). If it fails (token expired), falls back to push (costs quota).
    """
    token = access_token if access_token is not None else settings.LINE_CHANNEL_ACCESS_TOKEN
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    payload = {
        "replyToken": reply_token,
        "messages": messages
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(LINE_REPLY_URL, json=payload, headers=headers)
            if response.status_code == 200:
                logger.info("Successfully sent reply to LINE.")
                return
            logger.warning(f"Reply failed (status {response.status_code}). Trying push message...")
        except Exception as e:
            logger.warning(f"Reply error: {e}. Trying push message...")

    if fallback_user_id:
        await push_to_line(fallback_user_id, messages, access_token=token)


async def show_line_loading(user_id: str, seconds: float = 5, access_token: str = None) -> None:
    """Show LINE's official 'typing…' animation in the user's 1-on-1 chat (best-effort).

    This is what makes replies feel like a human is typing (AIS-style). `seconds`
    is clamped to LINE's 5–60 range and rounded to the nearest multiple of 5; the
    animation auto-clears as soon as the next message arrives. Never raises — a
    failed indicator must never block the actual reply.
    """
    token = access_token if access_token is not None else settings.LINE_CHANNEL_ACCESS_TOKEN
    loading_seconds = max(5, min(60, int(round(float(seconds) / 5.0)) * 5))
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    payload = {"chatId": user_id, "loadingSeconds": loading_seconds}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(LINE_LOADING_URL, json=payload, headers=headers)
            if resp.status_code not in (200, 202):
                logger.warning(f"LINE loading animation failed: {resp.status_code} {resp.text[:120]}")
        except Exception as e:
            logger.warning(f"LINE loading animation error: {e}")


# Per-tenant reply pacing. "slow" mimics AIS's LINE OA — deliberately unhurried,
# with the typing animation showing the whole time so it feels like a real person.
_HUMANIZE_PROFILES = {
    "slow":   {"read": (2.0, 3.5), "per_char": 0.09, "type_base": (1.0, 2.0), "type_min": 2.5, "type_cap": 7.0},
    "normal": {"read": (1.0, 2.0), "per_char": 0.05, "type_base": (0.5, 1.0), "type_min": 1.5, "type_cap": 4.5},
}
DEFAULT_HUMANIZE_MODE = "slow"


def _load_humanize_mode(tenant_id: str) -> str:
    """Reply pacing for a tenant: 'slow' (AIS-like, default) | 'normal' | 'off'."""
    profile_path = f"data/tenant_profile_{tenant_id}.json"
    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                mode = (json.load(f).get("ai_settings") or {}).get("humanize_mode")
            if mode in ("slow", "normal", "off"):
                return mode
        except Exception as e:
            logger.warning(f"Could not read humanize_mode for {tenant_id}: {e}")
    return DEFAULT_HUMANIZE_MODE


def _typing_seconds(text: str, params: dict) -> float:
    """Seconds a human would 'type' this bubble — grows with length, jittered, capped."""
    t = random.uniform(*params["type_base"]) + len(text or "") * params["per_char"]
    return max(params["type_min"], min(params["type_cap"], t))


def get_tenant_line_credentials(tenant_id: str) -> tuple[str, str]:
    """
    Retrieves the LINE credentials (access_token, channel_secret) for a specific tenant.
    Falls back to settings.LINE_CHANNEL_ACCESS_TOKEN and settings.LINE_CHANNEL_SECRET.
    """
    profile_path = f"data/tenant_profile_{tenant_id}.json"
    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                profile = json.load(f)
                token = profile.get("line_channel_access_token")
                secret = profile.get("line_channel_secret")
                if token and secret:
                    return token, secret
        except Exception as e:
            logger.error(f"Error loading tenant credentials for {tenant_id}: {e}")
    
    # Fallback to default config env values
    return settings.LINE_CHANNEL_ACCESS_TOKEN, settings.LINE_CHANNEL_SECRET

def get_strict_tenant_line_credentials(tenant_id: str) -> tuple[str, str]:
    """
    Resolves LINE credentials STRICTLY per-tenant for the multi-tenant webhook route.

    Unlike get_tenant_line_credentials (which falls back to the global env secret
    for the legacy single-tenant `/line` route), this returns (None, None) when the
    tenant has no profile or no configured per-tenant secret/token. Falling back to
    the GLOBAL secret here would let a signature forged with the global secret be
    accepted for a victim tenant, so the caller must reject such requests instead.
    """
    profile_path = f"data/tenant_profile_{tenant_id}.json"
    if not os.path.exists(profile_path):
        return None, None
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            profile = json.load(f)
    except Exception as e:
        logger.error(f"Error loading tenant credentials for {tenant_id}: {e}")
        return None, None

    token = profile.get("line_channel_access_token")
    secret = profile.get("line_channel_secret")
    if token and secret:
        return token, secret
    return None, None

async def handle_line_event(event: dict, base_url: str, tenant_id: str = "default") -> None:
    """
    Wrapper that runs the core handler inside a top-level error boundary so that
    exceptions in the background task get logged instead of silently swallowed.
    """
    try:
        await _handle_line_event_inner(event, base_url, tenant_id)
    except Exception as e:
        import traceback
        logger.error(f"Unhandled error in handle_line_event for tenant {tenant_id}: {e}\n{traceback.format_exc()}")


async def _handle_line_event_inner(event: dict, base_url: str, tenant_id: str = "default") -> None:
    """
    Core handler for processing a LINE text event.
    """
    # Retrieve LINE access token for this tenant
    access_token, _ = get_tenant_line_credentials(tenant_id)

    event_type = event.get("type")
    if event_type != "message":
        return
        
    message_type = event.get("message", {}).get("type")
    if message_type != "text":
        return
        
    reply_token = event.get("replyToken")
    user_id = event.get("source", {}).get("userId")
    user_message = event.get("message", {}).get("text", "").strip()
    # Strip the handoff marker from inbound customer text so a customer cannot
    # inject "[[HANDOFF]]" to force a self-handoff / silently pause their own AI.
    user_message = user_message.replace(HANDOFF_MARKER, "")

    if not reply_token or not user_id or not user_message:
        return
        
    logger.info(f"Processing message '{user_message}' from user {user_id}")

    # Check for active human intervention.
    # NOTE: A customer sending an emoji no longer triggers handoff. Human mode is
    # entered only when the AI itself escalates (HANDOFF_MARKER) or an admin pauses
    # the AI from the Dashboard.
    from app.core.redis import get_redis
    redis_client = get_redis()

    is_human_active = await redis_client.exists(f"human_intervention:{tenant_id}:{user_id}")
    if is_human_active:
        logger.info(f"Session {user_id} is in human intervention mode. Bypassing AI response.")
        # Just record the user message to history so the admin can see it in live chat
        await add_chat_message(session_id=user_id, role="user", content=user_message, tenant_id=tenant_id)
        return
    
    # 1. Retrieve RAG/CAG hybrid context & associated page images
    rag_result = await retrieve_hybrid_context(user_message, tenant_id=tenant_id)
    doc_context = rag_result.get("context", "")
    images = rag_result.get("images", [])
    mode = rag_result.get("mode", "rag")
    
    # Load verified structured tenant profile (shared, tenant-agnostic builder)
    from app.services.prompt import load_tenant_profile_context, build_system_prompt, build_rag_context_message
    profile_context = await load_tenant_profile_context(tenant_id)
            
    full_context = ""
    if profile_context:
        full_context += profile_context + "\n====================\nข้อมูลเพิ่มเติมจากเอกสารความรู้:\n"
    full_context += doc_context
    
    # 2. Get chat history from Redis
    history = await get_chat_history(session_id=user_id, tenant_id=tenant_id)
    
    # 3. Add current user message to Redis history
    await add_chat_message(session_id=user_id, role="user", content=user_message, tenant_id=tenant_id)
    
    # 4. Build system prompt from the shared, tenant-agnostic builder
    system_prompt = build_system_prompt(mode, full_context)
    rag_context_message = None if mode == "cag" else build_rag_context_message(full_context)
        
    # Inject current time as instructions at the end of history to prevent invalidating the main prompt cache prefix
    current_time_str = datetime.now().strftime("%A, %d %B %Y %H:%M") # omit seconds to avoid hourly cache miss
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
    
    # 5. Call OpenAI with history and context
    ai_response = await chat_completion_with_tools(
        messages=final_messages,
        system_prompt=system_prompt,
        tenant_id=tenant_id
    )
    
    # Detect AI-initiated handoff marker and strip it before saving/sending
    ai_requested_handoff = HANDOFF_MARKER in ai_response
    if ai_requested_handoff:
        ai_response = ai_response.replace(HANDOFF_MARKER, "").strip()

    # 6. Save AI reply to Redis history
    await add_chat_message(session_id=user_id, role="assistant", content=ai_response, tenant_id=tenant_id)

    # If the AI escalated, flag for human intervention (sticky until an admin
    # resumes the AI from the Dashboard)
    if ai_requested_handoff:
        try:
            await redis_client.set(f"human_intervention:{tenant_id}:{user_id}", "1")
            logger.info(f"Flagged session {user_id} for human intervention (AI handoff marker).")
        except Exception as re:
            logger.warning(f"Failed to flag session in Redis: {re}")
    
    # 7. Check if response is about promotions → send Flex carousel with images
    promo_keywords = ["โปรโมชัน", "โปรโมท", "โปร", "promotion", "ส่วนลด", "ลดราคา", "โปรพิเศษ"]
    is_promo_topic = any(kw in user_message.lower() for kw in promo_keywords) or \
                     any(kw in ai_response for kw in promo_keywords)

    flex_message = None
    if is_promo_topic:
        promotions = load_tenant_promotions(tenant_id)
        promos_with_images = [p for p in promotions if p.get("image_url")]
        if promos_with_images:
            flex_message = build_promo_flex_carousel(promos_with_images, base_url)
            logger.info(f"Built Flex carousel with {len(promos_with_images)} promo cards.")

    # 8. Split AI response into multiple chat bubbles for natural conversation feel
    # Reserve 1 slot for flex message if we have one
    max_text_bubbles = 4 if flex_message else 5
    image_slots = min(len(images), 2)
    max_text_bubbles = max_text_bubbles - image_slots
    max_text_bubbles = max(max_text_bubbles, 1)  # At least 1 text bubble
    bubbles = split_to_line_bubbles(ai_response, max_bubbles=max_text_bubbles)

    logger.info(f"Sending {len(bubbles)} text bubble(s) to LINE with human-like delay.")

    # Prepare image messages from RAG results
    image_messages = []
    for img_path in images[:2]:
        full_img_url = f"{base_url.rstrip('/')}{img_path}"
        logger.info(f"Attaching image to LINE reply: {full_img_url}")
        image_messages.append({
            "type": "image",
            "originalContentUrl": full_img_url,
            "previewImageUrl": full_img_url
        })

    # 9. Send bubbles with human-like pacing + LINE's "typing…" animation (AIS-style).
    #    Pacing is per-tenant: 'slow' (default, AIS-like) | 'normal' | 'off'.
    humanize = _load_humanize_mode(tenant_id)
    params = _HUMANIZE_PROFILES.get(humanize)  # None when mode == 'off'

    # First bubble uses the free reply token. In humanize mode, show the typing
    # animation and pause (reading + typing time) first so even the first reply
    # feels like a person just read the message and started typing.
    first_message = [{"type": "text", "text": bubbles[0]}]
    if len(bubbles) == 1 and not flex_message:
        # Only one bubble and no flex, attach RAG images together
        first_message.extend(image_messages)
    if params:
        total = random.uniform(*params["read"]) + _typing_seconds(bubbles[0], params)
        await show_line_loading(user_id, seconds=total, access_token=access_token)
        logger.info(f"[humanize={humanize}] reading+typing {total:.1f}s before first bubble")
        await asyncio.sleep(total)
    await reply_to_line(reply_token, first_message, access_token=access_token, fallback_user_id=user_id)

    # Remaining bubbles: show 'typing…', pause proportional to length, then push.
    for i, bubble in enumerate(bubbles[1:], start=2):
        if params:
            type_t = _typing_seconds(bubble, params)
            await show_line_loading(user_id, seconds=type_t, access_token=access_token)
            logger.info(f"[humanize={humanize}] typing {type_t:.1f}s before bubble {i}/{len(bubbles)}")
            await asyncio.sleep(type_t)
        else:
            # 'off': tiny gap so bubbles don't all land in the same instant.
            await asyncio.sleep(0.6)

        push_messages = [{"type": "text", "text": bubble}]
        # Attach RAG images with the last text bubble (if no flex coming after)
        if i == len(bubbles) and image_messages and not flex_message:
            push_messages.extend(image_messages)
        await push_to_line(user_id, push_messages, access_token=access_token)

    # 10. Send Flex Message carousel (promotions with images) as the final message
    if flex_message:
        if params:
            await show_line_loading(user_id, seconds=3, access_token=access_token)
        delay = random.uniform(2.0, 3.0) if params else 0.6
        logger.info(f"Waiting {delay:.1f}s before sending promo Flex carousel...")
        await asyncio.sleep(delay)
        push_messages = [flex_message]
        # Attach any RAG images alongside the flex
        if image_messages:
            push_messages.extend(image_messages)
        await push_to_line(user_id, push_messages, access_token=access_token)

def get_active_tenant_id() -> str:
    """
    Dynamically retrieves the tenant_id of the registered user from users.json,
    falling back to 'default' if empty or not found.
    """
    users_path = "data/users.json"
    if os.path.exists(users_path):
        try:
            with open(users_path, "r", encoding="utf-8") as f:
                users = json.load(f)
                if users and len(users) > 0:
                    return users[0].get("tenant_id", "default")
        except Exception as e:
            logger.error(f"Error reading users.json in webhook: {e}")
    return "default"

@router.post("/line")
async def line_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_line_signature: str = Header(None)
):
    """
    Fallback endpoint for incoming LINE webhook events (routes to active tenant).
    """
    active_tenant_id = get_active_tenant_id()
    _, secret = get_tenant_line_credentials(active_tenant_id)
    
    body = await request.body()
    body_str = body.decode("utf-8")
    
    # Verify request signature using tenant-specific secret
    if not verify_line_signature(body, x_line_signature, channel_secret=secret):
        logger.warning(f"Received invalid X-Line-Signature for active tenant {active_tenant_id}. Rejecting request.")
        raise HTTPException(status_code=403, detail="Invalid signature")
        
    try:
        payload = json.loads(body_str)
    except Exception as e:
        logger.error(f"JSON Parsing FAILED: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON body")
        
    events = payload.get("events", [])
    base_url = str(request.base_url)
    
    logger.info(f"Routing LINE webhook events to active tenant: {active_tenant_id}")
    for event in events:
        background_tasks.add_task(handle_line_event, event, base_url, active_tenant_id)
        
    return {"status": "ok"}

@router.post("/line/{tenant_id}")
async def line_webhook_tenant(
    tenant_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    x_line_signature: str = Header(None)
):
    """
    Multi-tenant endpoint routing LINE webhook events directly to the specified tenant_id.
    """
    # Resolve credentials STRICTLY per-tenant. No fallback to the global secret here:
    # accepting a global-secret signature for an arbitrary tenant_id would let anyone
    # spoof a victim tenant's webhook. Reject tenants that aren't configured.
    _, secret = get_strict_tenant_line_credentials(tenant_id)
    if not secret:
        logger.warning(f"Rejecting webhook for tenant {tenant_id}: no per-tenant LINE channel configured.")
        raise HTTPException(status_code=404, detail="LINE channel not configured for this tenant")

    body = await request.body()
    body_str = body.decode("utf-8")

    # Verify request signature using tenant-specific secret
    if not verify_line_signature(body, x_line_signature, channel_secret=secret):
        logger.warning(f"Received invalid X-Line-Signature for tenant {tenant_id}. Rejecting request.")
        raise HTTPException(status_code=403, detail="Invalid signature")
        
    try:
        payload = json.loads(body_str)
    except Exception as e:
        logger.error(f"JSON Parsing FAILED: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON body")
        
    events = payload.get("events", [])
    base_url = str(request.base_url)
    
    logger.info(f"Routing LINE webhook events to tenant: {tenant_id}")
    for event in events:
        background_tasks.add_task(handle_line_event, event, base_url, tenant_id)
        
    return {"status": "ok"}

@router.get("/line/url/{tenant_id}")
async def get_webhook_url(request: Request, tenant_id: str = Depends(require_tenant)):
    """
    Returns the public webhook URL for the tenant.
    First checks if ngrok is running locally to fetch its public tunnel URL.
    Otherwise, falls back to the current request's base URL.

    Auth-gated: require_tenant resolves the path tenant_id from a verified Bearer
    token and 403s on mismatch, so only the owning tenant can probe its own URL
    (and the local ngrok admin API is no longer reachable anonymously).
    """
    # Try querying local ngrok API
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://127.0.0.1:4040/api/tunnels", timeout=0.5)
            if response.status_code == 200:
                data = response.json()
                tunnels = data.get("tunnels", [])
                for tunnel in tunnels:
                    if tunnel.get("proto") == "https":
                        public_url = tunnel.get("public_url")
                        return {"webhook_url": f"{public_url}/api/webhooks/line/{tenant_id}"}
        except Exception:
            # Ngrok not running locally or api unreachable
            pass

    # Fallback to the current request's base URL
    base_url = str(request.base_url).rstrip("/")
    return {"webhook_url": f"{base_url}/api/webhooks/line/{tenant_id}"}
