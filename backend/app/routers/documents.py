import os
import shutil
import tempfile
import logging
import uuid
import asyncio
import inspect
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.services.parsing import parse_pdf
from app.services.rag import index_document, delete_document
from app.routers.tenant import tenant_file_lock, _get_profile_path, _validate_tenant_id
from app.core.security import get_current_tenant, require_tenant
from app.core.db import db_load_documents, db_load_profile, db_save_profile

logger = logging.getLogger(__name__)
import json
router = APIRouter(prefix="/api/documents", tags=["documents"])

# Upload jobs live in Redis under this prefix so the UI can poll without blocking on OCR.
UPLOAD_JOB_PREFIX = "upload_job:"
UPLOAD_JOB_TTL = 3600  # seconds

# Hold strong references to in-flight background upload tasks. asyncio only keeps
# WEAK references to tasks, so without this a long-running OCR job can be garbage
# collected mid-run (leaving the job stuck on "processing" forever).
_upload_tasks: set = set()


async def _load_documents_meta() -> list[dict]:
    # ponytail: Use the shared Mongo/JSON adapter here instead of reaching into rag.py.
    return await db_load_documents()


def _job_key(tenant_id: str, job_id: str) -> str:
    """Redis key for an upload job, namespaced by tenant so one tenant can never
    poll (and read the raw document text of) another tenant's job."""
    return f"{UPLOAD_JOB_PREFIX}{tenant_id}:{job_id}"


async def _write_job_status(tenant_id: str, job_id: str, payload: dict) -> None:
    """Persist a job record to Redis (best-effort; failures are logged, not raised)."""
    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        await redis_client.set(
            _job_key(tenant_id, job_id),
            json.dumps(payload, ensure_ascii=False),
            ex=UPLOAD_JOB_TTL,
        )
    except Exception as e:
        logger.error(f"Failed to write upload job status {job_id}: {e}")


async def _process_upload_job(job_id: str, tmp_path: str, filename: str, tenant_id: str) -> None:
    """
    Background worker: parse -> index -> progressive rules extraction,
    writing intermediate results to Redis to allow non-blocking UI populating.
    """
    try:
        # 1. Parse text and extract images
        parsed_doc = await parse_pdf(tmp_path, tenant_id=tenant_id)
        parsed_doc["document_name"] = filename  # Use actual filename

        # 2. Get full raw text
        full_raw_text = "\n\n".join([page.get("text", "") for page in parsed_doc.get("pages", [])])

        # Write parsing done status
        await _write_job_status(tenant_id, job_id, {
            "status": "processing",
            "progress": "parsing_done",
            "document_name": filename,
            "extracted_json": {}
        })

        # 3. Finish indexing before reporting the upload as done. Otherwise the UI
        # can start a chat while Chroma and document metadata are still empty.
        await index_document(parsed_doc, tenant_id=tenant_id)

        # Emit that parsing is done and we are beginning analysis
        await _write_job_status(tenant_id, job_id, {
            "status": "processing",
            "progress": "basic_done",
            "document_name": filename,
            "extracted_json": {}
        })

        # 4. Extract all profile rules (company details, services, staff, rules, promotions, FAQ) in 1 single call
        # to prevent 429 rate limit errors (from multiple sequential GPT-4o-mini calls).
        extracted_json = await extract_all_profile_from_text(full_raw_text)

        # Emit services_done progress with a small delay for smooth frontend UI animations
        await asyncio.sleep(0.5)
        await _write_job_status(tenant_id, job_id, {
            "status": "processing",
            "progress": "services_done",
            "document_name": filename,
            "extracted_json": extracted_json.copy()
        })

        # Emit staff_done progress with a small delay for smooth frontend UI animations
        await asyncio.sleep(0.5)
        await _write_job_status(tenant_id, job_id, {
            "status": "processing",
            "progress": "staff_done",
            "document_name": filename,
            "extracted_json": extracted_json.copy()
        })

        # Clear Redis cache for the tenant CAG/RAG profile
        from app.core.redis import get_redis
        try:
            redis_client = get_redis()
            await redis_client.delete(f"tenant_cag_profile:{tenant_id}")
        except Exception:
            pass

        await asyncio.sleep(0.5)
        await _write_job_status(tenant_id, job_id, {
            "status": "done",
            "progress": "all_done",
            "document_id": parsed_doc["document_id"],
            "document_name": filename,
            "raw_text": full_raw_text,
            "extracted_json": extracted_json,
        })
    except Exception as e:
        logger.error(f"Error processing upload job {job_id} for {filename}: {e}")
        await _write_job_status(tenant_id, job_id, {
            "status": "error",
            "detail": "ไม่สามารถประมวลผลและจัดทำดัชนีเอกสารได้ กรุณาลองใหม่อีกครั้ง",
        })
    finally:
        # Clean up temp file regardless of outcome
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception as e:
                logger.error(f"Failed to remove temp file {tmp_path} for job {job_id}: {e}")

async def extract_all_profile_from_text(text: str) -> dict:
    """
    Uses a single OpenAI call to extract all structured profile details,
    greatly reducing token consumption and preventing TPM rate limits (429).
    """
    from app.services.openai_service import openai_client
    
    prompt = (
        "คุณคือ AI ผู้เชี่ยวชาญการจัดโครงสร้างข้อมูลธุรกิจ (Structured Data Extractor)\n"
        "หน้าที่ของคุณคือการอ่านข้อความคู่มือธุรกิจที่ให้มา และดึงข้อมูลของธุรกิจออกเป็นโครงสร้าง JSON ตามรูปแบบนี้เท่านั้น:\n"
        "{\n"
        '  "company_name": "ชื่อบริษัท/ร้านค้า (ถ้ามี)",\n'
        '  "business_hours": "เวลาเปิด-ปิดทำการ เช่น เปิดทุกวัน 09:00 - 20:00 น.",\n'
        '  "contact_number": "เบอร์ติดต่อร้าน (ถ้ามี)",\n'
        '  "services": [\n'
        '    {"name": "ชื่อบริการ/สินค้า", "price": 300, "duration": 30}\n'
        '  ],\n'
        '  "staff": [\n'
        '    {"name": "ชื่อพนักงาน/แพทย์", "role": "ตำแหน่ง เช่น ทันตแพทย์จัดฟัน", "specialties": ["ความเชี่ยวชาญย่อย"], "experience": "ประสบการณ์ เช่น 5 ปี", "schedule": "ตารางเวลาทำงาน เช่น อังคาร–พุธ 09:00–15:00"}\n'
        '  ],\n'
        '  "promotions": [\n'
        '    {"name": "ชื่อโปรโมชัน", "description": "รายละเอียด", "discount": "ส่วนลด", "valid_until": "วันหมดอายุ YYYY-MM-DD หรือเว้นว่างหากไม่ระบุ", "conditions": "เงื่อนไข"}\n'
        '  ],\n'
        '  "faq": [\n'
        '    {"question": "คำถาม", "answer": "คำตอบสำหรับลูกค้า"}\n'
        '  ],\n'
        '  "custom_rules": [\n'
        '    {"category": "หมวดหมู่กฎ/นโยบาย เช่น การประกัน/การเคลม", "rule": "รายละเอียดกฎเกณฑ์"}\n'
        '  ]\n'
        "}\n\n"
        "กฎเกณฑ์การดึงข้อมูล:\n"
        "1. ห้ามแต่งข้อมูลหรือสมมติขึ้นมาเองเด็ดขาด หากไม่มีระบุให้กำหนดเป็นค่าว่าง (\"\") หรืออาร์เรย์ว่าง ([])\n"
        "2. สำหรับ price ใน services สามารถเป็นตัวเลข หรือข้อความการประมาณราคา เช่น 'เริ่มต้น 600', 'ประมาณ 1000-2000' (ระบุเป็น string เสมอ)\n"
        "3. สำหรับ duration ใน services ให้กำหนดเป็น 30 เสมอหากไม่ระบุในคู่มือ\n"
        "4. สำหรับ schedule ของพนักงาน ให้ดึงชื่อวันภาษาไทยตามที่ระบุในคู่มือ ห้ามเดาข้อมูล\n"
        "5. ห้ามเดาวันหมดอายุของโปรโมชัน หากไม่ระบุให้เว้นว่างเป็น \"\" เสมอ\n"
        "6. ตอบเฉพาะข้อความดิบที่เป็น JSON เท่านั้น ไม่มีคำนำหน้า หรือคำอธิบายเพิ่มเติมใดๆ.\n\n"
        f"ข้อความ:\n{text}"
    )

    max_retries = 3
    delay = 2.0
    for attempt in range(max_retries):
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0
            )
            raw_content = response.choices[0].message.content.strip()
            if raw_content.startswith("```"):
                raw_content = raw_content.replace("```json", "").replace("```", "").strip()
            return json.loads(raw_content)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate_limit" in err_str.lower() or "limit reached" in err_str.lower():
                if attempt < max_retries - 1:
                    logger.warning(f"Rate limit hit in extract_all_profile_from_text (attempt {attempt + 1}/{max_retries}). Waiting {delay}s and retrying... Error: {e}")
                    await asyncio.sleep(delay)
                    delay *= 1.5
                    continue
            logger.error(f"Failed to extract all profile parts (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return {}
    return {}

async def extract_business_rules_from_text(text: str) -> dict:
    """
    Uses OpenAI to extract structured services, prices, hours, and business details from raw text,
    including promotions, staff, and FAQs.
    """
    from app.services.openai_service import openai_client
    
    prompt = (
        "คุณคือ AI ผู้เชี่ยวชาญการจัดโครงสร้างข้อมูลธุรกิจ (Structured Data Extractor)\n"
        "หน้าที่ของคุณคือการอ่านข้อความที่ให้มา และดึงข้อมูลของธุรกิจออกเป็นโครงสร้าง JSON "
        "โดยห้ามแต่งข้อมูลขึ้นมาเอง และตอบกลับด้วย JSON เปล่าที่ไม่มีฟิลด์ย่อยหากไม่มีข้อมูลนั้นระบุในคู่มือ.\n\n"
        "รูปแบบ JSON ที่ต้องการ:\n"
        "{\n"
        '  "company_name": "ชื่อบริษัท/ร้านค้า (ถ้ามี)",\n'
        '  "business_hours": "เวลาเปิด-ปิดทำการ เช่น เปิดทุกวัน 09:00 - 20:00 น.",\n'
        '  "contact_number": "เบอร์ติดต่อร้าน (ถ้ามี)",\n'
        '  "services": [\n'
        '    {"name": "ชื่อบริการ/สินค้า", "price": 300, "duration": 30}\n'
        '  ],\n'
        '  "promotions": [\n'
        '    {"name": "ชื่อโปรโมชัน", "description": "รายละเอียด", "discount": "ส่วนลด", "valid_until": "วันหมดอายุ YYYY-MM-DD", "conditions": "เงื่อนไข"}\n'
        '  ],\n'
        '  "staff": [\n'
        '    {"name": "ชื่อพนักงาน/แพทย์", "role": "ตำแหน่ง", "specialties": ["ความเชี่ยวชาญย่อย"], "experience": "ประสบการณ์", "schedule": "ตารางเวลาทำงาน เช่น อังคาร–พุธ 09:00–15:00"}\n'
        '  ],\n'
        '  "faq": [\n'
        '    {"question": "คำถามพบบ่อย", "answer": "คำตอบสำหรับลูกค้า"}\n'
        '  ],\n'
        '  "custom_rules": [\n'
        '    {"category": "หมวดหมู่กฎ/นโยบาย เช่น ประกันสุขภาพ, กฎการ Escalate/ข้อยกเว้น AI", "rule": "รายละเอียดกฎเกณฑ์เกณฑ์ที่สำคัญในคูมือ"}\n'
        '  ]\n'
        "}\n\n"
        "หมายเหตุ:\n"
        "- price สามารถเป็นตัวเลข หรือข้อความการประมาณราคาได้ เช่น 'เริ่มต้น 600', 'ประมาณ 1000-2000', หรือ '600' (ระบุเป็น string เท่านั้น)\n"
        "- duration ให้กำหนดเป็น 30 เสมอเนื่องจากระบบไม่ได้ระบุเวลาแยกชิ้นบริการ\n"
        "- การจัดการโปรโมชัน/แคมเปญย่อย (Sub-promotions/Tiers): หากคู่มือระบุแคมเปญหลักหนึ่งแคมเปญ (เช่น \"ฟอกสีฟัน Super Saving 2024\") แต่ภายในแคมเปญนั้นมีตัวเลือกย่อย หรือโปรโมชันย่อยหลายรายการ (เช่น ฟอกสีฟันที่บ้าน, Home Whitening, In-office, Combo) ห้ามรวมเป็นรายการเดียว ให้แยกแคมเปญย่อย/ตัวเลือกย่อยเหล่านั้นออกมาเป็นรายการโปรโมชันเดี่ยวๆ แยกกันในลิสต์ promotions (เช่น แยกเป็น 4 รายการ สำหรับ 4 ตัวเลือกย่อย) โดยกำหนดดังนี้:\n"
        "  * name: ให้ตั้งเป็น 'ชื่อแคมเปญหลัก (ชื่อตัวเลือกย่อย)' เช่น 'ฟอกสีฟัน Super Saving 2024 (ฟอกสีฟันที่บ้าน)'\n"
        "  * description: รายละเอียดเงื่อนไขและลักษณะของตัวเลือกย่อยนั้นๆ\n"
        "  * discount: ส่วนลดหรือราคาเฉพาะของตัวเลือกย่อยนั้น เช่น '3,500 บาท' หรือระบุตามราคาของบริการย่อยนั้น\n"
        "  * conditions: ระบุความสัมพันธ์กับแคมเปญหลักและเงื่อนไขเฉพาะของตัวเลือกย่อย เช่น 'แคมเปญหลัก ฟอกสีฟัน Super Saving 2024'\n"
        "  * valid_until: ใส่วันหมดอายุเฉพาะเมื่อคู่มือระบุวันไว้ชัดเจนเท่านั้น (รูปแบบ YYYY-MM-DD) หากคู่มือไม่ได้ระบุวันหมดอายุ ให้เว้นว่างเป็น \"\" ห้ามเดาหรือกำหนดวันหมดอายุขึ้นมาเองเด็ดขาด\n"
        "- ให้พิจารณาเนื้อหาข้อความทั้งหมด และดึงกฎเกณฑ์ นโยบายการบริการ ข้อห้าม หรือข้อยกเว้นต่างๆ (เช่น นโยบายเคลมประกัน สัญญาการบริการ ข้อยกเว้นที่บอตห้ามตอบเอง) เข้ามาอยู่ใน custom_rules ทั้งหมด โดยแยกตามหมวดหมู่ที่เป็นประโยชน์ต่อการตอบคำถาม\n"
        "- staff.role และ staff.specialties: ถ้าคู่มือจัดกลุ่มพนักงาน/แพทย์ตามสาขา (เช่น หัวข้อ 'กลุ่ม: Pediatric Dentistry — ทันตกรรมเด็ก' หรือ 'Orthodontics — จัดฟัน') ให้นำชื่อสาขานั้นมาใส่เป็น role และ/หรือ specialties ของทุกคนในกลุ่มนั้น เพื่อให้ระบุได้ว่าใครเชี่ยวชาญด้านใด (เช่น role='ทันตแพทย์เด็ก', specialties=['ทันตกรรมเด็ก']).\n"
        "- ห้ามสร้างหรือเดาข้อมูลที่ไม่มีระบุในคู่มือเด็ดขาด โดยเฉพาะวันที่/วันหมดอายุ ราคา หรือชื่อบุคคล หากไม่มีข้อมูลชัดเจนให้เว้นว่างไว้ ('').\n"
        "- ห้ามตอบข้อความพูดคุยอื่นใด ให้ตอบเฉพาะข้อมูล JSON เท่านั้น และห้ามจัดรูปแบบ markdown block ด้วย ```json หรืออะไรก็ตาม ให้ตอบแค่ข้อความดิบที่เป็น JSON เท่านั้น.\n\n"
        f"ข้อความที่ต้องการวิเคราะห์:\n\"\"\"\n{text}\n\"\"\""
    )
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0
        )
        raw_content = response.choices[0].message.content.strip()
        if raw_content.startswith("```"):
            raw_content = raw_content.replace("```json", "").replace("```", "").strip()
        return json.loads(raw_content)
    except Exception as e:
        logger.error(f"Failed to extract business rules using OpenAI: {e}")
        return {
            "company_name": "",
            "business_hours": "",
            "services": [],
            "contact_number": "",
            "promotions": [],
            "staff": [],
            "faq": [],
            "custom_rules": []
        }

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Accepts a PDF, TXT, or MD file, saves it, and kicks off parsing/indexing/extraction
    in the background. Returns immediately with a job_id the UI can poll for progress.
    tenant_id is derived from the verified token, never from a client parameter.
    """
    filename_lower = file.filename.lower()
    allowed_extensions = (".pdf", ".txt", ".md")

    if not filename_lower.endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail="Only PDF, TXT, and MD files are supported in Phase 1.")

    logger.info(f"Received upload request for file: {file.filename} for tenant {tenant_id}")

    # Get file suffix for temp file creation
    _, ext = os.path.splitext(filename_lower)

    # Save the uploaded file to a temporary file (blocking OCR happens later in the background)
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        try:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        except Exception as e:
            logger.error(f"Failed to write uploaded file to temp path: {e}")
            raise HTTPException(status_code=500, detail="Could not process file upload.")

    job_id = str(uuid.uuid4())

    # Record the initial processing state before spawning the worker so a fast poll sees it.
    await _write_job_status(tenant_id, job_id, {"status": "processing"})

    # Spawn heavy work without awaiting it; the request returns instantly.
    # Keep a strong reference so the task isn't GC'd before it finishes.
    task = asyncio.create_task(_process_upload_job(job_id, tmp_path, file.filename, tenant_id))
    _upload_tasks.add(task)
    task.add_done_callback(_upload_tasks.discard)

    return {"job_id": job_id, "status": "processing"}


@router.get("/upload/status/{job_id}")
async def upload_status(job_id: str, tenant_id: str = Depends(get_current_tenant)):
    """
    Returns the current state of a background upload job:
    {status: 'processing'|'done'|'error', raw_text?, extracted_json?, document_id?, detail?}.
    Requires auth; the job is looked up under the caller's tenant, so one tenant
    can never read another tenant's uploaded document text/extracted data.
    """
    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        raw = await redis_client.get(_job_key(tenant_id, job_id))
    except Exception as e:
        logger.error(f"Failed to read upload job status {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve upload status.")

    if not raw:
        return {"status": "error", "detail": "not found"}

    try:
        return json.loads(raw)
    except Exception as e:
        logger.error(f"Corrupt upload job record {job_id}: {e}")
        return {"status": "error", "detail": "not found"}

@router.get("")
async def list_documents(tenant_id: str = Depends(get_current_tenant)):
    """
    Lists indexed documents and their metadata for the AUTHENTICATED tenant.
    Filtering by tenant_id prevents cross-tenant leakage and wrong counts.
    """
    try:
        res = _load_documents_meta()
        docs = await res if inspect.isawaitable(res) else res
        # Strip detailed page contents for listing, filtered to this tenant only
        cleaned_docs = []
        for doc in docs:
            if doc.get("tenant_id") != tenant_id:
                continue
            cleaned_docs.append({
                "document_id": doc.get("document_id"),
                "document_name": doc.get("document_name"),
                "uploaded_at": doc.get("uploaded_at"),
                "page_count": len(doc.get("pages", []))
            })
        return cleaned_docs
    except Exception as e:
        logger.error(f"Failed to load document metadata: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve documents list.")

@router.delete("/{document_id}")
async def remove_document(document_id: str, tenant_id: str = Depends(get_current_tenant)):
    """
    Deletes an uploaded document and all associated data, scoped to the
    AUTHENTICATED tenant.
    """
    try:
        success = await delete_document(document_id, tenant_id=tenant_id)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found.")
        return {"status": "success", "message": f"Successfully deleted document: {document_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete document {document_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not process document deletion.")

@router.post("/reextract-schedules/{tenant_id}")
async def reextract_schedules(tenant_id: str = Depends(require_tenant)):
    """
    Re-extracts staff schedules from ChromaDB document text and merges them back
    into the tenant profile. The path tenant_id must match the token's tenant
    (require_tenant -> 403 on mismatch).
    """
    _validate_tenant_id(tenant_id)

    from app.services.rag import get_tenant_knowledge_profile
    profile = await get_tenant_knowledge_profile(tenant_id)
    text = profile.get("consolidated_text", "")
    if not text:
        raise HTTPException(status_code=400, detail="No document text found in database for this tenant.")

    extracted = await extract_business_rules_from_text(text)
    staff_extracted = extracted.get("staff", [])

    # Guard the whole read-modify-write with tenant_file_lock so we never race
    # tenant.save_profile while updating the shared profile.
    updated_count = 0
    from app.routers import tenant as tenant_router
    original_profile_path = tenant_router._get_profile_path
    path_overridden = _get_profile_path is not original_profile_path
    if path_overridden:
        tenant_router._get_profile_path = _get_profile_path
    try:
        with tenant_file_lock:
            profile_data = await db_load_profile(tenant_id)
            if not profile_data:
                raise HTTPException(status_code=404, detail="Tenant profile JSON not found.")

            current_staff = profile_data.get("staff", [])

            for current_s in current_staff:
                name = current_s.get("name", "").strip()
                match = None
                for ext_s in staff_extracted:
                    if ext_s.get("name", "").strip().lower() == name.lower():
                        match = ext_s
                        break

                if match:
                    schedule = match.get("schedule", "").strip()
                    if schedule:
                        current_s["schedule"] = schedule
                        updated_count += 1

            if updated_count > 0:
                await db_save_profile(tenant_id, profile_data)
    finally:
        if path_overridden:
            tenant_router._get_profile_path = original_profile_path

    # Invalidate the Redis CAG cache the same way tenant.save_profile does,
    # so the updated schedules take effect without waiting for the cache TTL.
    if updated_count > 0:
        from app.core.redis import get_redis
        try:
            redis_client = get_redis()
            cache_key = f"tenant_cag_profile:{tenant_id}"
            await redis_client.delete(cache_key)
            logger.info(f"Invalidated Redis CAG profile cache for tenant '{tenant_id}' after schedule re-extract.")
        except Exception as cache_err:
            logger.warning(f"Failed to clear Redis CAG profile cache: {cache_err}")

    return {"status": "success", "updated_count": updated_count}
