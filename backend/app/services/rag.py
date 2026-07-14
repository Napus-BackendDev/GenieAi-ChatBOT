import os
import json
import hashlib
import logging
import threading
import chromadb
from app.core.config import settings
from app.services.openai_service import get_embedding

logger = logging.getLogger(__name__)
doc_file_lock = threading.Lock()

# Global ChromaDB client
chroma_client = None

def get_chroma_client():
    """
    Get or initialize the persistent ChromaDB client.
    """
    global chroma_client
    if chroma_client is None:
        os.makedirs(settings.CHROMA_DB_PATH, exist_ok=True)
        logger.info(f"Initializing persistent ChromaDB client at {settings.CHROMA_DB_PATH}")
        chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
    return chroma_client

def get_knowledge_collection():
    """
    Get or create the default ChromaDB collection for business knowledge.
    """
    client = get_chroma_client()
    # We use cosine similarity for matching, which matches the cosine distance in ChromaDB (distance = 1 - similarity)
    return client.get_or_create_collection(
        name="business_knowledge",
        metadata={"hnsw:space": "cosine"}
    )

from app.core.db import db_load_documents, db_save_documents, db_delete_document, db_load_profile

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """
    Splits text into overlapping chunks of defined character length.
    """
    chunks = []
    if not text:
        return chunks
    
    start = 0
    text_len = len(text)
    while start < text_len:
        end = start + chunk_size
        chunks.append(text[start:end])
        # Move start window forward
        start += (chunk_size - overlap)
        
    return chunks

async def index_document(parsed_doc: dict, tenant_id: str = "default") -> None:
    """
    Takes parsed PDF content, chunks the text, generates embeddings,
    saves vectors to ChromaDB, and updates data/documents.json with metadata.
    """
    doc_id = parsed_doc["document_id"]
    doc_name = parsed_doc["document_name"]
    pages = parsed_doc["pages"]
    content_hash = hashlib.sha256(
        "\n".join(page.get("text", "").strip() for page in pages).encode("utf-8")
    ).hexdigest()
    
    collection = get_knowledge_collection()
    existing = collection.get(where={"tenant_id": tenant_id})
    old_doc_ids = {
        meta.get("document_id")
        for meta in (existing.get("metadatas") or [])
        if meta.get("document_id") != doc_id
        and (meta.get("document_name") == doc_name or meta.get("content_hash") == content_hash)
    }
    
    ids = []
    embeddings = []
    documents = []
    metadatas = []
    
    # Store page-to-image mapping in a dictionary for saving to metadata
    pages_meta = []
    
    for page in pages:
        page_num = page["page_number"]
        page_text = page["text"].strip()
        page_images = page["images"]
        
        pages_meta.append({
            "page_number": page_num,
            "images": page_images
        })
        
        if not page_text:
            continue
            
        # Split page text into chunks
        chunks = chunk_text(page_text)
        
        for idx, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_p{page_num}_c{idx}"
            
            # Generate embedding vector
            vector = await get_embedding(chunk)
            
            ids.append(chunk_id)
            embeddings.append(vector)
            documents.append(chunk)
            metadatas.append({
                "tenant_id": tenant_id,
                "document_id": doc_id,
                "document_name": doc_name,
                "content_hash": content_hash,
                "page_number": page_num
            })
            
    # Add chunks in batch to ChromaDB
    if ids:
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )
        logger.info(f"Successfully indexed {len(ids)} chunks from '{doc_name}' into ChromaDB.")
        for old_doc_id in old_doc_ids:
            collection.delete(where={"$and": [
                {"tenant_id": tenant_id},
                {"document_id": old_doc_id},
            ]})
        
    # Save metadata
    docs_meta = await db_load_documents()
    docs_meta = [
        doc for doc in docs_meta
        if not (
            doc.get("tenant_id") == tenant_id
            and doc.get("document_id") in old_doc_ids
        )
    ]
    docs_meta.append({
        "document_id": doc_id,
        "document_name": doc_name,
        "tenant_id": tenant_id,
        "content_hash": content_hash,
        "pages": pages_meta,
        "uploaded_at": chromadb.utils.embedding_functions.EmbeddingFunction.__class__.__name__
    })
    import datetime
    docs_meta[-1]["uploaded_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    await db_save_documents(docs_meta)

async def get_images_for_page(document_id: str, page_number: int, tenant_id: str) -> list[str]:
    """
    Resolves image URLs associated with a document's page number.
    """
    docs_meta = await db_load_documents()
    for doc in docs_meta:
        if doc.get("document_id") == document_id and doc.get("tenant_id") == tenant_id:
            for page in doc.get("pages", []):
                if page.get("page_number") == page_number:
                    return page.get("images", [])
    return []

async def query_knowledge_base(query_text: str, tenant_id: str = "default", n_results: int = 5) -> dict:
    """
    Queries ChromaDB for similar knowledge, filtering by tenant_id.
    Resolves any matching images from pages.
    """
    collection = get_knowledge_collection()
    
    # 1. Embed query
    query_vector = await get_embedding(query_text)
    
    # 2. Query vector DB with tenant filtering
    results = collection.query(
        query_embeddings=[query_vector],
        n_results=n_results,
        where={"tenant_id": tenant_id}
    )
    
    context_chunks = []
    matched_images = []
    citations = []
    
    if results and results["documents"] and results["documents"][0]:
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        
        for idx in range(len(docs)):
            chunk_text = docs[idx]
            meta = metas[idx]
            
            page_num = meta.get("page_number")
            doc_id = meta.get("document_id")
            doc_name = meta.get("document_name")
            
            # Record citation
            citation = {
                "document_name": doc_name,
                "page_number": page_num,
                "text_snippet": chunk_text[:120] + "..." if len(chunk_text) > 120 else chunk_text
            }
            if citation not in citations:
                citations.append(citation)
                
            context_chunks.append(f"[Source: {doc_name}, Page {page_num}]: {chunk_text}")
            
            # Resolve image URLs from pages
            page_images = await get_images_for_page(doc_id, page_num, tenant_id)
            for img_url in page_images:
                if img_url not in matched_images:
                    matched_images.append(img_url)
                    
    context = "\n\n".join(context_chunks)
    
    return {
        "context": context,
        "images": matched_images,
        "citations": citations
    }

CAG_TOKEN_THRESHOLD = 15000  # Approx 10k-12k words


async def _load_tenant_cag_threshold(tenant_id: str) -> int:
    """
    Read the tenant's saved ai_settings.cag_token_threshold from DB or JSON.
    """
    try:
        profile = await db_load_profile(tenant_id)
        ai_settings = profile.get("ai_settings") or {}
        return int(ai_settings.get("cag_token_threshold", CAG_TOKEN_THRESHOLD))
    except Exception as e:
        logger.warning(f"Failed to load cag_token_threshold for tenant {tenant_id}: {e}")
        return CAG_TOKEN_THRESHOLD


async def get_tenant_knowledge_profile(tenant_id: str) -> dict:
    """
    Fetches the tenant's consolidated document corpus size and content.
    Caches the results in Upstash Redis to prevent heavy disk reads on every webhook.
    """
    # Use the tenant's configured CAG threshold (defaults to CAG_TOKEN_THRESHOLD).
    # Recomputed against the cached corpus below so a settings change takes effect
    # without waiting for the corpus cache to expire.
    cag_threshold = await _load_tenant_cag_threshold(tenant_id)

    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        cache_key = f"tenant_cag_profile:{tenant_id}"

        # Try to fetch from Redis
        cached_profile = await redis_client.get(cache_key)
        if cached_profile:
            profile = json.loads(cached_profile)
            # Re-derive mode from the current threshold (cached corpus may predate a settings change).
            profile["mode"] = "cag" if profile.get("token_count", 0) < cag_threshold else "rag"
            return profile
    except Exception as e:
        logger.warning(f"Failed to access Redis for CAG profile: {e}")
        redis_client = None

    consolidated_text_parts = []
    collection = get_knowledge_collection()
    # Chroma is the corpus source of truth. Metadata may temporarily be missing
    # after a failed legacy upload or a Mongo/JSON fallback transition.
    try:
        results = collection.get(where={"tenant_id": tenant_id})
        if results and results["documents"]:
            consolidated_text_parts = results["documents"]
    except Exception as e:
        logger.error(f"Failed to fetch document chunks from ChromaDB for tenant {tenant_id}: {e}")

    consolidated_text = "\n\n".join(consolidated_text_parts)
    # Estimate token count (chars / 4)
    approx_tokens = len(consolidated_text) // 4
    
    profile = {
        "mode": "cag" if approx_tokens < cag_threshold else "rag",
        "consolidated_text": consolidated_text,
        "token_count": approx_tokens
    }
    
    if redis_client:
        try:
            await redis_client.set(cache_key, json.dumps(profile), ex=600)  # Cache for 10 minutes
        except Exception as e:
            logger.warning(f"Failed to cache CAG profile in Redis: {e}")
            
    return profile

async def retrieve_hybrid_context(query_text: str, tenant_id: str = "default") -> dict:
    """
    Dynamically routes to CAG or RAG based on the tenant's profile.
    """
    try:
        profile = await get_tenant_knowledge_profile(tenant_id)
        if profile["mode"] == "cag" and profile["consolidated_text"]:
            logger.info(f"Tenant '{tenant_id}' is in CAG mode (size: {profile['token_count']} tokens)")
            return {
                "mode": "cag",
                "context": profile["consolidated_text"],
                "images": [],
                "citations": [{"document_name": "Full Corpus (CAG)", "page_number": 1, "text_snippet": "Entire knowledge base loaded in context."}]
            }
    except Exception as e:
        logger.error(f"Error in hybrid routing: {e}. Falling back to standard RAG.")

    logger.info(f"Tenant '{tenant_id}' is in RAG mode. Querying ChromaDB.")
    rag_result = await query_knowledge_base(query_text, tenant_id=tenant_id, n_results=5)
    rag_result["mode"] = "rag"
    return rag_result

async def delete_document(document_id: str, tenant_id: str = "default") -> bool:
    """
    Deletes a document from the system, in ownership-safe order:
    1. Verify the document belongs to this tenant (removing its metadata).
    2. Remove that document's chunks from ChromaDB (scoped to the tenant).
    3. Clears the tenant profile cache in Redis.
    4. Removes extracted image files from static folder.

    Ownership is checked FIRST so a caller passing another tenant's
    document_id cannot delete that tenant's ChromaDB chunks.
    """
    # 1. Verify ownership via documents metadata, then delete that one record.
    docs_meta = await db_load_documents()
    found = any(
        doc.get("document_id") == document_id and doc.get("tenant_id") == tenant_id
        for doc in docs_meta
    )
    if not found:
        logger.warning(f"Document metadata for '{document_id}' not found under tenant '{tenant_id}'")
        return False

    # Targeted delete by id (no full-list rewrite that could clobber other tenants' docs).
    await db_delete_document(document_id)

    # 2. Delete from ChromaDB, scoped to this tenant (Chroma requires $and for
    # multi-key filters; a flat two-key dict is not valid filter syntax).
    try:
        collection = get_knowledge_collection()
        collection.delete(where={"$and": [{"document_id": document_id}, {"tenant_id": tenant_id}]})
        logger.info(f"Deleted ChromaDB chunks for document '{document_id}' (tenant '{tenant_id}')")
    except Exception as e:
        logger.error(f"Failed to delete ChromaDB chunks for document '{document_id}': {e}")

    # 3. Clear Redis Cache
    from app.core.redis import get_redis
    try:
        redis_client = get_redis()
        cache_key = f"tenant_cag_profile:{tenant_id}"
        await redis_client.delete(cache_key)
        logger.info(f"Cleared Redis CAG profile cache for tenant '{tenant_id}'")
    except Exception as e:
        logger.warning(f"Failed to clear Redis CAG profile cache: {e}")

    # 4. Delete extracted images
    import shutil
    images_dir = os.path.join(settings.STATIC_IMAGES_PATH, tenant_id, document_id)
    if os.path.exists(images_dir):
        try:
            shutil.rmtree(images_dir)
            logger.info(f"Deleted extracted images folder: {images_dir}")
        except Exception as e:
            logger.error(f"Failed to delete images folder {images_dir}: {e}")
            
    return True
