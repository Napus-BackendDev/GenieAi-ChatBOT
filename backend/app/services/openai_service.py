import json
import logging
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize Async OpenAI Client
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


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
        logger.warning(f"Failed to load ai_settings for tenant {tenant_id}: {e}")
        return {}

async def get_embedding(text: str) -> list[float]:
    """
    Generate embedding vector for a given text chunk using text-embedding-3-small.
    """
    try:
        response = await openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Failed to generate embedding from OpenAI: {e}")
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
    from app.services.booking_service import (
        check_booking_availability,
        create_booking,
        get_staff_on_duty,
    )

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    # Apply the tenant's saved AI settings (falls back to defaults if unset).
    ai_settings = await load_tenant_ai_settings(tenant_id)
    model_name = ai_settings.get("model_name") or "gpt-4o-mini"
    try:
        temperature = float(ai_settings.get("temperature"))
    except (TypeError, ValueError):
        temperature = 0.3

    try:
        # Runaway guard; legitimate booking flows may require several tool steps.
        max_iterations = 10

        for iteration in range(max_iterations):
            response = await openai_client.chat.completions.create(
                model=model_name,
                messages=full_messages,
                tools=BOOKING_TOOLS,
                tool_choice="auto",
                temperature=temperature,
                timeout=30
            )
            
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
                function_args = json.loads(tool_call.function.arguments)
                
                logger.info(f"Tool Name: {function_name}")
                logger.info(f"AI requested execution of tool '{function_name}' with args {function_args}")
                
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
                        staff_name=function_args.get("staff_name")
                    )
                elif function_name == "create_booking":
                    result = await create_booking(
                        customer_name=function_args.get("customer_name"),
                        phone_number=function_args.get("phone_number"),
                        email=function_args.get("email"),
                        service_topic=function_args.get("service_topic"),
                        booking_datetime=function_args.get("booking_datetime"),
                        tenant_id=tenant_id,
                        staff_name=function_args.get("staff_name")
                    )
                else:
                    result = {"status": "error", "message": f"Unknown tool: {function_name}"}
                
                logger.info(f"Tool Execution Result: {result}")
                
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

    except Exception as e:
        import traceback
        logger.error(f"Error in chat_completion_with_tools: {e}\n{traceback.format_exc()}")
        return "ขออภัยด้วยค่ะ ระบบขัดข้องชั่วคราว ไม่สามารถประมวลผลข้อความได้ในขณะนี้"
