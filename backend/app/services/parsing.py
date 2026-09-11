import os
import uuid
import asyncio
import fitz  # PyMuPDF
import logging
import base64
from app.core.config import settings
from app.services.openai_service import extract_page_text_with_vision
from app.core.mongodb import get_mongo_db
from app.services.media_storage import store_media

logger = logging.getLogger(__name__)

# Bound concurrent Vision OCR calls to stay within OpenAI rate limits.
_OCR_CONCURRENCY = 5

async def parse_pdf(file_path: str, tenant_id: str = "default") -> dict:
    """
    Parses a PDF, TXT, or MD file. For PDFs, renders each page as an image
    and uses GPT-4o-mini Vision to extract high-accuracy text and tables (Visual OCR).
    Stores extracted images in GridFS in production and only uses the local
    tenant-scoped filesystem fallback when Mongo is unavailable.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    filename = os.path.basename(file_path)
    document_id = str(uuid.uuid4())
    parsed_pages = []

    # Handle TXT and MD files
    if filename.lower().endswith((".txt", ".md")):
        logger.info(f"Starting parsing of text file: {file_path} for tenant: {tenant_id}")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                text = f.read()
            parsed_pages.append({
                "page_number": 1,
                "text": text,
                "images": []
            })
            logger.info(f"Completed parsing of text file {file_path}.")
            return {
                "document_id": document_id,
                "document_name": filename,
                "pages": parsed_pages
            }
        except Exception as e:
            logger.error(f"Failed to read text file: {e}")
            raise e

    # Handle PDF files
    logger.info(f"Starting parsing of PDF with GPT-4o-mini Vision OCR: {file_path} for tenant: {tenant_id}")
    doc = fitz.open(file_path)
    
    # Production media is stored in GridFS. Filesystem paths remain only for
    # local mode without Mongo, so a Render disk is not the source of truth.
    use_gridfs = settings.MEDIA_STORAGE == "gridfs" and get_mongo_db() is not None
    images_dir = os.path.join(settings.STATIC_IMAGES_PATH, tenant_id, document_id)
    if not use_gridfs:
        os.makedirs(images_dir, exist_ok=True)
    
    total_pages = len(doc)
    if total_pages > settings.MAX_PDF_PAGES:
        doc.close()
        raise ValueError(f"PDF exceeds the {settings.MAX_PDF_PAGES}-page limit")
    page_semaphore = asyncio.Semaphore(_OCR_CONCURRENCY)

    async def _process_page(page_idx: int) -> dict:
        async with page_semaphore:
            return await _process_page_bounded(page_idx)

    async def _process_page_bounded(page_idx: int) -> dict:
        page_number = page_idx + 1
        page = doc[page_idx]
        scale = 150 / 72
        rendered_area = int(page.rect.width * scale) * int(page.rect.height * scale)
        if rendered_area > settings.MAX_PDF_PAGE_AREA:
            raise ValueError(f"PDF page {page_number} is too large to render safely")
        logger.info(f"Processing PDF page {page_number}/{total_pages}")

        # 1. Visual OCR using GPT-4o-mini Vision
        text = ""
        try:
            # Render page to PNG image bytes (150 DPI is good for text legibility)
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")

            # Encode to base64
            base64_image = base64.b64encode(img_bytes).decode("utf-8")

            # Call Vision only through the budgeted provider wrapper. Mock/local
            # mode returns empty text and uses PyMuPDF fallback below.
            logger.info(f"Calling GPT-4o-mini Vision OCR for page {page_number}")
            text = await extract_page_text_with_vision(
                base64_image,
                tenant_id,
                (
                    "Extract all text, structures, and tables from this document page image.\n"
                    "Return the exact text and tables formatted as markdown. Do not add any conversational text "
                    "or wrap the response in markdown code block markers. Respond in the native language "
                    "of the document (typically Thai or English)."
                ),
            )
            if not text:
                text = page.get_text()

            # Clean up markdown code blocks if the model wrapped it anyway
            if text.startswith("```"):
                lines = text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                text = "\n".join(lines).strip()

            logger.info(f"Successfully performed GPT-4o-mini Vision OCR for page {page_number}")

        except Exception as e:
            logger.error(f"Failed GPT-4o-mini Vision OCR for page {page_number}: {e}. Falling back to PyMuPDF text extraction.")
            # Fallback to PyMuPDF rule-based text extraction
            text = page.get_text()

        # 2. Extract embedded images
        image_urls = []
        image_list = page.get_images(full=True)

        for img_idx, img in enumerate(image_list):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]  # e.g., png, jpeg

                # Format name: page_X_img_Y.ext
                image_filename = f"page_{page_number}_img_{img_idx + 1}.{image_ext}"
                if use_gridfs:
                    stored = await store_media(
                        image_bytes,
                        tenant_id=tenant_id,
                        filename=image_filename,
                        content_type=f"image/{'jpeg' if image_ext in {'jpg', 'jpeg'} else image_ext}",
                        category=document_id,
                        document_id=document_id,
                    )
                    image_url = stored["url"]
                else:
                    image_filepath = os.path.join(images_dir, image_filename)
                    with open(image_filepath, "wb") as img_file:
                        img_file.write(image_bytes)
                    image_url = f"/static/images/{tenant_id}/{document_id}/{image_filename}"
                image_urls.append(image_url)

            except Exception as e:
                logger.warning(f"Failed to extract image xref {xref} on page {page_number}: {e}")
                if settings.is_production:
                    raise
                continue

        return {
            "page_number": page_number,
            "text": text,
            "images": image_urls
        }

    # gather preserves input order, so parsed_pages stays deterministic (page 1..N).
    try:
        parsed_pages = await asyncio.gather(*(_process_page(i) for i in range(total_pages)))
    finally:
        doc.close()
    logger.info(f"Completed parsing of PDF {file_path}. Extracted {len(parsed_pages)} pages.")
    
    return {
        "document_id": document_id,
        "document_name": filename,
        "pages": parsed_pages
    }
