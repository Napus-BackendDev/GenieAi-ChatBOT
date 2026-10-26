import json
import logging
import hashlib
import math
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.ai_budget import AIBudgetExceeded, estimate_tokens, reserve, reconcile

logger = logging.getLogger(__name__)

# Keep construction import-safe for local/mock staging where no credential is
# intentionally provided. Calls still branch on AI_PROVIDER and production
# startup rejects a missing real key. The base URL is fixed to the official
# OpenAI endpoint; environment-level custom endpoints cannot redirect billing
# or credentials in production.
openai_client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY or "local-placeholder-not-a-key",
    base_url="https://api.openai.com/v1",
)


from app.core.db import db_load_profile

async def load_tenant_ai_settings(tenant_id: str) -> dict:
    """
    Read a tenant's saved ai_settings (model_name, temperature, cag_token_threshold)
    from DB or JSON. Returns {} if the file or key is
    missing so callers fall back to their own defaults.
    """
    try:
        profile = await db_load_profile(tenant_id)
        ai_settings = profile.get("ai_settings")
        return ai_settings if isinstance(ai_settings, dict) else {}
    except Exception as e:
        logger.warning("Failed to load ai_settings for tenant %s: %s", tenant_id, type(e).__name__)
        return {}


def _mock_embedding(text: str) -> list[float]:
    """Deterministic local vector for CI/local staging; never used in production."""
    values = []
    seed = text.encode("utf-8")
    for index in range(32):
        digest = hashlib.sha256(seed + index.to_bytes(2, "big")).digest()
        values.append((int.from_bytes(digest[:4], "big") / 2**31) - 1.0)
    norm = math.sqrt(sum(value * value for value in values)) or 1.0
    return [value / norm for value in values]


async def extract_page_text_with_vision(
    image_base64: str,
    tenant_id: str,
    instruction: str,
) -> str:
    """Call Vision only through the provider and budget guardrail."""
    if settings.AI_PROVIDER == "disabled":
        raise RuntimeError("AI_PROVIDER_DISABLED")
    if settings.AI_PROVIDER == "mock":
        return ""

    reservation = await reserve(
        tenant_id,
        estimate_tokens(instruction, settings.AI_MAX_OCR_OUTPUT_TOKENS_PER_PAGE) + 1_500,
    )
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": instruction},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_base64}"}},
                ],
            }],
            temperature=0.0,
            max_tokens=settings.AI_MAX_OCR_OUTPUT_TOKENS_PER_PAGE,
            timeout=30,
        )
        usage = getattr(response, "usage", None)
        await reconcile(reservation, getattr(usage, "total_tokens", 0) if usage else 0)
        return (response.choices[0].message.content or "").strip()
    except Exception:
        await reconcile(reservation, 0)
        raise


async def complete_text(
    prompt: str,
    tenant_id: str,
    model: str = "gpt-4o-mini",
    max_tokens: int | None = None,
    timeout: float = 30,
    json_mode: bool = False,
) -> str:
    """Budgeted text completion for extraction and other non-chat workflows."""
    if settings.AI_PROVIDER == "disabled":
        raise RuntimeError("AI_PROVIDER_DISABLED")
    if settings.AI_PROVIDER == "mock":
        return "{}"
    allowed_models = {value.strip() for value in settings.AI_ALLOWED_MODELS.split(",") if value.strip()}
    selected_model = model if model in allowed_models else "gpt-4o-mini"
    # Callers that ask for more than the chat cap (profile extraction) get the larger extraction cap.
    ceiling = settings.AI_MAX_EXTRACTION_OUTPUT_TOKENS if max_tokens else settings.AI_MAX_OUTPUT_TOKENS
    output_cap = min(max(1, int(max_tokens or settings.AI_MAX_OUTPUT_TOKENS)), ceiling)
    reservation = await reserve(tenant_id, estimate_tokens(prompt, output_cap))
    try:
        response = await openai_client.chat.completions.create(
            model=selected_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=output_cap,
            timeout=timeout,
            **({"response_format": {"type": "json_object"}} if json_mode else {}),
        )
        usage = getattr(response, "usage", None)
        await reconcile(reservation, getattr(usage, "total_tokens", 0) if usage else 0)
        return (response.choices[0].message.content or "").strip()
    except Exception:
        await reconcile(reservation, 0)
        raise

async def get_embedding(text: str, tenant_id: str = "system") -> list[float]:
    """
    Generate embedding vector for a given text chunk using text-embedding-3-small.
    """
    if estimate_tokens(text) > settings.AI_MAX_EMBEDDING_INPUT_TOKENS:
        raise ValueError("AI_INPUT_TOO_LARGE")
    if settings.AI_PROVIDER == "disabled":
        raise RuntimeError("AI_PROVIDER_DISABLED")
    if settings.AI_PROVIDER == "mock":
        return _mock_embedding(text)

    reservation = None
    try:
        reservation = await reserve(tenant_id, estimate_tokens(text, output_cap=100))
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        usage = getattr(response, "usage", None)
        await reconcile(reservation, getattr(usage, "total_tokens", 0) if usage else 0)
        return response.data[0].embedding
    except AIBudgetExceeded:
        raise
    except Exception as e:
        if reservation:
            await reconcile(reservation, 0)
        logger.error("Failed to generate embedding from provider: %s", type(e).__name__)
        raise e

# Define tools for booking automation
BOOKING_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_staff_on_duty",
            "description": (
                "Returns which staff members / doctors are actually on duty (working) on a given "
                "day or date, computed from their real schedules. You MUST call this to answer any "
                "question about who works / is available on a specific day, which doctor is in on a "
                "day, or before assigning a staff member to a booking. Never guess a staff schedule "
                "yourself — the schedules have week-of-month rules you cannot compute reliably."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "day": {
                        "type": "string",
                        "description": "A Thai weekday name (e.g. 'เสาร์', 'อาทิตย์') when the customer asks about a day in general, OR a specific date in ISO format (YYYY-MM-DD) when a concrete date is meant."
                    },
                    "specialty": {
                        "type": "string",
                        "description": "Optional keyword to filter by service/specialty or role (e.g. 'จัดฟัน', 'เด็ก', 'รากฟัน'). Omit to list all on-duty staff."
                    }
                },
                "required": ["day"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_booking_availability",
            "description": (
                "Checks if a date and time slot is available. Omit staff_name to auto-select one "
                "on-duty provider who has no booking conflict. When the customer says any doctor, "
                "anyone, or ใครก็ได้, omit staff_name and call this once; never test providers one by one."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_datetime": {
                        "type": "string",
                        "description": "The desired booking date and time in ISO 8601 format (e.g., '2026-06-05T14:00:00')."
                    },
                    "staff_name": {
                        "type": "string",
                        "description": "Optional provider name. Omit when the customer accepts any doctor/provider so the system auto-selects an on-duty, conflict-free provider."
                    },
                    "service_topic": {
                        "type": "string",
                        "description": "Optional service name, used to apply the service duration"
                    }
                },
                "required": ["booking_datetime"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": (
                "Creates a confirmed appointment. Omit staff_name to auto-select and persist one "
                "on-duty provider with no conflict. For any doctor / anyone / ใครก็ได้, omit "
                "staff_name instead of trying providers one by one."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {
                        "type": "string",
                        "description": "Name of the customer booking the slot."
                    },
                    "phone_number": {
                        "type": "string",
                        "description": "Contact phone number of the customer."
                    },
                    "email": {
                        "type": "string",
                        "description": "Contact email address of the customer."
                    },
                    "service_topic": {
                        "type": "string",
                        "description": "The service, product topic, or reason for booking (e.g., 'Consultation', 'Haircut', 'Inquiry')."
                    },
                    "booking_datetime": {
                        "type": "string",
                        "description": "The confirmed booking date and time in ISO 8601 format (e.g., '2026-06-05T14:00:00')."
                    },
                    "staff_name": {
                        "type": "string",
                        "description": "Optional provider name. Omit when the customer accepts any doctor/provider; the system will auto-select and persist an on-duty, conflict-free provider."
                    },
                    "availability_token": {
                        "type": "string",
                        "description": "Optional and ignored: the system verifies availability itself before creating the booking."
                    }
                },
                "required": ["customer_name", "phone_number", "email", "service_topic", "booking_datetime"]
            }
        }
    }
]

async def chat_completion_with_tools(
    messages: list[dict],
    system_prompt: str,
    tenant_id: str = "default"
) -> str:
    """
    Executes a chat completion request with system prompt and history.
    Iteratively resolves sequential tool calls (e.g., check availability -> create booking).
    """
    if settings.AI_PROVIDER == "disabled":
        return "[[HANDOFF]]ขณะนี้ระบบ AI ถูกปิดใช้งานชั่วคราว กรุณารอเจ้าหน้าที่ตอบกลับค่ะ"
    if settings.AI_PROVIDER == "mock":
        return "ระบบทดสอบพร้อมใช้งานค่ะ กรุณาระบุคำถามหรือข้อมูลที่ต้องการให้ช่วยเหลือได้เลยค่ะ"

    from app.services.booking_service import (
        check_booking_availability,
        create_booking,
        get_staff_on_duty,
    )

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    # Apply the tenant's saved AI settings (falls back to defaults if unset).
    ai_settings = await load_tenant_ai_settings(tenant_id)
    allowed_models = {value.strip() for value in settings.AI_ALLOWED_MODELS.split(",") if value.strip()}
    model_name = ai_settings.get("model_name") or "gpt-4o-mini"
    if model_name not in allowed_models:
        logger.warning("Tenant requested non-allowlisted model; using default")
        model_name = "gpt-4o-mini"
    try:
        temperature = float(ai_settings.get("temperature"))
    except (TypeError, ValueError):
        temperature = 0.3
    temperature = max(0.0, min(2.0, temperature))

    try:
        # Runaway guard; legitimate booking flows may require several tool steps.
        max_iterations = settings.AI_MAX_TOOL_ITERATIONS

        for iteration in range(max_iterations):
            prompt_size = sum(
                len(str(message.get("content") or ""))
                for message in full_messages
                if isinstance(message, dict)
            )
            reservation = await reserve(
                tenant_id,
                estimate_tokens("x" * prompt_size, settings.AI_MAX_OUTPUT_TOKENS),
            )
            try:
                response = await openai_client.chat.completions.create(
                    model=model_name,
                    messages=full_messages,
                    tools=BOOKING_TOOLS,
                    tool_choice="auto",
                    temperature=temperature,
                    max_tokens=settings.AI_MAX_OUTPUT_TOKENS,
                    timeout=30
                )
                usage = getattr(response, "usage", None)
                await reconcile(reservation, getattr(usage, "total_tokens", 0) if usage else 0)
            except Exception:
                await reconcile(reservation, 0)
                raise
            
            response_message = response.choices[0].message
            tool_calls = response_message.tool_calls
            
            # If no more tool calls, return the final assistant response text
            if not tool_calls:
                if iteration > 0:
                    logger.info(f"OpenAI finished processing after {iteration} tool loop(s).")
                else:
                    logger.info("OpenAI did NOT trigger any tool calls.")
                return response_message.content
                
            logger.info(f"OpenAI triggered {len(tool_calls)} tool call(s) (Iteration {iteration + 1})!")
            # Add assistant message containing the tool calls to the thread
            full_messages.append(response_message)
            
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                try:
                    function_args = json.loads(tool_call.function.arguments)
                except (TypeError, json.JSONDecodeError):
                    result = {"status": "error", "reason": "invalid_tool_arguments"}
                    full_messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": json.dumps(result),
                    })
                    continue
                if not isinstance(function_args, dict) or len(json.dumps(function_args)) > 5000:
                    result = {"status": "error", "reason": "invalid_tool_arguments"}
                    full_messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": json.dumps(result),
                    })
                    continue
                
                if not _validate_tool_arguments(function_name, function_args):
                    result = {"status": "error", "reason": "invalid_tool_arguments"}
                    full_messages.append({
                        "tool_call_id": tool_call.id,
                        "role": "tool",
                        "name": function_name,
                        "content": json.dumps(result),
                    })
                    continue

                logger.info(f"Tool Name: {function_name}")
                logger.info("AI requested execution of tool '%s'", function_name)
                
                # Execute the matched tool
                if function_name == "get_staff_on_duty":
                    result = await get_staff_on_duty(
                        day=function_args.get("day"),
                        tenant_id=tenant_id,
                        specialty=function_args.get("specialty")
                    )
                elif function_name == "check_booking_availability":
                    result = await check_booking_availability(
                        booking_datetime=function_args.get("booking_datetime"),
                        tenant_id=tenant_id,
                        staff_name=function_args.get("staff_name"),
                        service_topic=function_args.get("service_topic"),
                    )
                elif function_name == "create_booking":
                    # The capability token is minted HERE for the exact slot/staff/service the model is
                    # booking. Asking the model to copy a 43-char token (and repeat the date, doctor and
                    # service byte-for-byte) made production bookings fail whenever it paraphrased one.
                    avail = await check_booking_availability(
                        booking_datetime=function_args.get("booking_datetime"),
                        tenant_id=tenant_id,
                        staff_name=function_args.get("staff_name"),
                        service_topic=function_args.get("service_topic"),
                    )
                    if not avail.get("available"):
                        result = {"status": "error", "reason": avail.get("reason"), "message": avail.get("message")}
                    else:
                        result = await create_booking(
                            customer_name=function_args.get("customer_name"),
                            phone_number=function_args.get("phone_number"),
                            email=function_args.get("email"),
                            service_topic=function_args.get("service_topic"),
                            booking_datetime=function_args.get("booking_datetime"),
                            tenant_id=tenant_id,
                            staff_name=function_args.get("staff_name"),
                            availability_token=avail.get("availability_token"),
                        )
                else:
                    result = {"status": "error", "message": f"Unknown tool: {function_name}"}
                
                logger.info(
                    "Tool execution completed: %s (status=%s, reason=%s)",
                    function_name,
                    (result or {}).get("status", (result or {}).get("available")) if isinstance(result, dict) else None,
                    (result or {}).get("reason") if isinstance(result, dict) else None,
                )
                
                # Append tool result to messages
                full_messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": json.dumps(result)
                })
        
        # If loop exceeds maximum iterations
        logger.warning(f"Exceeded max tool iterations ({max_iterations}) for tenant {tenant_id}")
        return "ขออภัยด้วยค่ะ ยังไม่สามารถดำเนินการจองให้เสร็จได้ กรุณาระบุชื่อคุณหมอที่ต้องการ หรือแจ้งเวลาอื่นที่สะดวกนะคะ"

    except AIBudgetExceeded:
        logger.warning("AI request refused by hard budget cap")
        return "[[HANDOFF]]ขณะนี้ระบบ AI ใช้งานครบโควตาชั่วคราว กรุณารอเจ้าหน้าที่ตอบกลับค่ะ"
    except Exception as e:
        import traceback
        logger.error("Error in chat_completion_with_tools: %s", type(e).__name__)
        return "ขออภัยด้วยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถประมวลผลข้อความได้ในขณะนี้"


_TOOL_ARGUMENTS = {
    "get_staff_on_duty": {"required": {"day"}, "optional": {"specialty"}},
    "check_booking_availability": {"required": {"booking_datetime"}, "optional": {"staff_name", "service_topic"}},
    "create_booking": {
        "required": {"customer_name", "phone_number", "email", "service_topic", "booking_datetime"},
        "optional": {"staff_name", "availability_token"},
    },
}


def _validate_tool_arguments(function_name: str, arguments: dict) -> bool:
    """Strict server-side schema boundary; model output is untrusted input."""
    schema = _TOOL_ARGUMENTS.get(function_name)
    if not schema or not isinstance(arguments, dict):
        return False
    if set(arguments) - schema["required"] - schema["optional"]:
        return False
    if not schema["required"].issubset(arguments):
        return False
    for key, value in arguments.items():
        if not isinstance(value, str) or not value.strip():
            return False
        limit = 320 if key in {"customer_name", "phone_number", "email", "staff_name"} else 500
        if len(value) > limit:
            return False
    return True
