import sys
import os
import asyncio

# Adjust Python path to allow running from the root of the backend folder
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set logging config before imports
import logging
logging.basicConfig(level=logging.ERROR)

from app.services.rag import query_knowledge_base, retrieve_hybrid_context
from app.services.redis_service import get_chat_history, add_chat_message, clear_chat_history
from app.services.openai_service import chat_completion_with_tools
from datetime import datetime

async def simulate_chat_step(user_message: str, session_id: str = "auto_test_user"):
    tenant_id = "default"
    print(f"\n[USER]: {user_message}")
    
    # 1. Query RAG/CAG context
    rag_result = await retrieve_hybrid_context(user_message, tenant_id=tenant_id)
    context = rag_result.get("context", "")
    images = rag_result.get("images", [])
    mode = rag_result.get("mode", "rag")
    
    # 2. Get chat history from Redis
    history = await get_chat_history(session_id=session_id, tenant_id=tenant_id)
    
    # 3. Add current user message to Redis history
    await add_chat_message(session_id=session_id, role="user", content=user_message, tenant_id=tenant_id)
    
    # 4. Formulate System Prompt
    system_prompt = (
        "คุณคือ AI Business Assistant เลขาส่วนตัวอัจฉริยะของร้านค้า/ธุรกิจแห่งนี้ "
        "หน้าที่ของคุณคือการตอบคำถามลูกค้าอย่างสุภาพ อบอุ่น และช่วยเหลือการจองนัดหมาย "
        "กรุณาทำตามแนวทางและข้อบังคับต่อไปนี้อย่างเคร่งครัด:\n"
        "1. หากหัวข้อที่ลูกค้าถามไม่เกี่ยวกับเนื้อหาที่ระบุ ให้ใช้ความรู้ภายนอกตอบอย่างสุภาพว่าไม่มีระบุในคู่มือ แต่พร้อมช่วยเหลือข้อมูลเบื้องต้น.\n"
        "2. กฎเหล็กของการนัดหมาย:\n"
        "   - เมื่อลูกค้าสนใจนัดหมาย คุณต้องเรียกใช้ฟังก์ชัน 'check_booking_availability' ก่อนเสมอเพื่อตรวจสอบความว่าง ห้ามยืนยันหรือคาดเดาความว่างเอง.\n"
        "   - การทำนัดหมายจำเป็นต้องใช้ข้อมูล 4 อย่าง: ชื่อผู้ติดต่อ, เบอร์โทรศัพท์, อีเมล, และประเภทบริการ/หัวข้อนัดหมาย. "
        "หากข้อมูลยังไม่ครบถ้วน ให้สอบถามลูกค้าทีละคำถามอย่างเป็นมิตร.\n"
        "   - เมื่อได้ข้อมูลครบทั้ง 4 อย่างแล้ว และตรวจสอบแล้วว่าเวลาดังกล่าวว่าง คุณต้องเรียกใช้ฟังก์ชัน 'create_booking' ทันที เพื่อลงทะเบียนนัดหมายเข้าระบบจริง. "
        "ห้ามสมมติ เขียน หรือแจ้งลูกค้าว่าลงนัดสำเร็จแล้วในข้อความแชตโดยที่ไม่ได้เรียกใช้ฟังก์ชัน 'create_booking' จริงเด็ดขาด.\n"
        "3. ตอบกลับเป็นภาษาไทยที่กระชับ สุภาพ และอ่านง่าย."
    )
    
    if mode == "cag":
        system_prompt += (
            "\n\nใช้เนื้อหาจากเอกสารความรู้ธุรกิจต่อไปนี้ในการตอบคำถามเป็นหลัก:\n"
            "====================\n"
            f"{context}\n"
            "====================\n"
        )
        rag_context_message = None
    else:
        rag_context_message = {
            "role": "system",
            "content": (
                "ใช้เนื้อหาจากเอกสารความรู้ธุรกิจต่อไปนี้ในการตอบคำถามเป็นหลัก:\n"
                "====================\n"
                f"{context}\n"
                "====================\n"
            )
        }
        
    time_instruction_msg = {
        "role": "system",
        "content": "[SYSTEM INFO] ข้อมูลปัจจุบัน (Current Time): วันนี้คือวันจันทร์ที่ 1 มิถุนายน 2026 เวลา 10:00 น. ให้ใช้ข้อมูลนี้ประกอบการระบุวันเวลาสำหรับนัดหมาย เช่น 'วันศุกร์นี้'."
    }
    
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
    
    # 6. Save AI reply to Redis history
    await add_chat_message(session_id=session_id, role="assistant", content=ai_response, tenant_id=tenant_id)
    
    print(f"[AI]: {ai_response}")
    if images:
        print(f"[IMAGES ATTACHED]: {images}")

async def main():
    from app.core.redis import init_redis, close_redis
    
    print("[INFO] Connecting to Redis...")
    await init_redis()
    
    session_id = "auto_test_user"
    
    # Clear previous history to ensure fresh test context
    await clear_chat_history(session_id=session_id)
    
    try:
        print("\n=== START SIMULATED AUTOMATIC CHAT FLOW ===")
        
        # Step 1: General Info Inquiry (RAG test)
        await simulate_chat_step("ร้านตั้งอยู่ที่ไหน และเวลาทำการช่วงกี่โมงครับ?", session_id)
        await asyncio.sleep(1)
        
        # Step 2: Service Pricing and Booking Intent (RAG + Booking initialization)
        await simulate_chat_step("ราคาตัดผมเท่าไหร่ และอยากทำนัดสระไดร์ วันศุกร์นี้ (5 มิถุนายน) ตอนบ่าย 2 โมงครับ", session_id)
        await asyncio.sleep(1)
        
        # Step 3: Provide remaining booking info to trigger registration
        await simulate_chat_step("ชื่อสมศักดิ์ เบอร์โทร 089-123-4567 อีเมล somsak@example.com ครับ", session_id)
        
        print("\n=== END SIMULATED AUTOMATIC CHAT FLOW ===")
        
        # Output booking database content to verify
        print("\n[DATABASE CHECK] File data/bookings.json:")
        if os.path.exists("data/bookings.json"):
            with open("data/bookings.json", "r", encoding="utf-8") as f:
                print(f.read())
        else:
            print("[ERROR] File data/bookings.json not found.")
            
    finally:
        await close_redis()

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    asyncio.run(main())
