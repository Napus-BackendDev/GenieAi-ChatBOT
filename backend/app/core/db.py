import os
import json
import logging
import threading
from app.core.mongodb import get_mongo_db
from app.core.config import settings

logger = logging.getLogger(__name__)

# File locks for JSON operations
_users_lock = threading.Lock()
_tenant_lock = threading.Lock()
_bookings_lock = threading.Lock()
_documents_lock = threading.Lock()

# JSON file paths
def _get_users_file_path() -> str:
    try:
        from app.routers.auth import USERS_FILE_PATH as router_users_path
        return router_users_path
    except Exception:
        return "data/users.json"

DOCUMENTS_FILE_PATH = "data/documents.json"

# Helper for local JSON files
def _ensure_dir_for_file(filepath: str) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

def _clean_mongo_doc(doc: dict) -> dict:
    cleaned = dict(doc)
    cleaned.pop("_id", None)
    return cleaned

def _mongo_db_or_none():
    return get_mongo_db()

# ==========================================
# 1. Users Module (Collection: users)
# ==========================================

async def db_load_users() -> list[dict]:
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # ponytail: Mongo is the primary store when configured; JSON below remains the fallback.
            cursor = db.users.find({})
            return [_clean_mongo_doc(u) for u in await cursor.to_list(length=10000)]
        except Exception as e:
            logger.error(f"Error loading users from MongoDB: {e}")

    # ponytail: JSON fallback keeps local/dev installs working without MongoDB.
    file_path = _get_users_file_path()
    with _users_lock:
        _ensure_dir_for_file(file_path)
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading users.json: {e}")
            return []

async def db_save_users(users: list[dict]) -> None:
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # ponytail: Store the same list shape in Mongo; no extra user model layer.
            for user in users:
                if "tenant_id" in user:
                    await db.users.replace_one({"tenant_id": user["tenant_id"]}, user, upsert=True)
            return
        except Exception as e:
            logger.error(f"Error saving users to MongoDB: {e}")

    # ponytail: JSON fallback is still authoritative when Mongo is absent or errors.
    file_path = _get_users_file_path()
    with _users_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(users, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving users.json: {e}")

# ==========================================
# 2. Tenant Profiles Module (Collection: tenant_profiles)
# ==========================================

def _get_profile_path(tenant_id: str) -> str:
    try:
        from app.routers.tenant import _get_profile_path as router_get_path
        # Use router_get_path if it differs from this one or if it was monkeypatched
        return router_get_path(tenant_id)
    except Exception:
        return f"data/tenant_profile_{tenant_id}.json"

async def db_load_profile(tenant_id: str) -> dict:
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # ponytail: Mongo profile lookup mirrors the tenant_profile_{tenant_id}.json file.
            profile = await db.tenant_profiles.find_one({"tenant_id": tenant_id})
            if profile:
                return _clean_mongo_doc(profile)
        except Exception as e:
            logger.error(f"Error loading profile {tenant_id} from MongoDB: {e}")

    # ponytail: Missing Mongo or missing Mongo profile falls back to the existing JSON file.
    file_path = _get_profile_path(tenant_id)
    with _tenant_lock:
        if not os.path.exists(file_path):
            return {}
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading profile JSON for {tenant_id}: {e}")
            return {}

async def db_save_profile(tenant_id: str, profile_data: dict) -> None:
    # Ensure tenant_id is in the profile document for MongoDB structure
    profile_data["tenant_id"] = tenant_id
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # ponytail: Upsert the existing profile dict directly; validation stays in routers/services.
            await db.tenant_profiles.replace_one({"tenant_id": tenant_id}, profile_data, upsert=True)
            return
        except Exception as e:
            logger.error(f"Error saving profile {tenant_id} to MongoDB: {e}")

    # ponytail: JSON fallback preserves the current tenant profile file contract.
    file_path = _get_profile_path(tenant_id)
    with _tenant_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(profile_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving profile JSON for {tenant_id}: {e}")

# ==========================================
# 3. Bookings Module (Collection: bookings)
# ==========================================

async def db_load_bookings() -> list[dict]:
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # ponytail: Mongo returns the same list-of-dicts shape as bookings.json.
            cursor = db.bookings.find({})
            return [_clean_mongo_doc(b) for b in await cursor.to_list(length=10000)]
        except Exception as e:
            logger.error(f"Error loading bookings from MongoDB: {e}")

    # ponytail: JSON fallback keeps booking creation/listing working without MongoDB.
    file_path = settings.BOOKINGS_JSON_PATH
    with _bookings_lock:
        _ensure_dir_for_file(file_path)
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading bookings JSON: {e}")
            return []

async def db_save_bookings(bookings: list[dict]) -> None:
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # Upsert-only. We deliberately do NOT reconcile-delete ($nin) here:
            # if `bookings` came from the JSON fallback after a transient Mongo read
            # error, a $nin delete would wipe every other tenant's bookings. Explicit
            # removals go through db_delete_booking().
            for b in bookings:
                if "booking_id" in b:
                    await db.bookings.replace_one({"booking_id": b["booking_id"]}, b, upsert=True)
            return
        except Exception as e:
            logger.error(f"Error saving bookings to MongoDB: {e}")

    # ponytail: On Mongo failure, write through to the legacy JSON file instead of crashing.
    file_path = settings.BOOKINGS_JSON_PATH
    with _bookings_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(bookings, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving bookings JSON: {e}")


async def db_delete_booking(booking_id: str) -> bool:
    """Delete exactly one booking by id. Targeted delete so a stale/partial list
    can never wipe unrelated bookings (replaces the old $nin reconcile)."""
    db = _mongo_db_or_none()
    if db is not None:
        try:
            res = await db.bookings.delete_one({"booking_id": booking_id})
            return res.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting booking from MongoDB: {e}")

    file_path = settings.BOOKINGS_JSON_PATH
    with _bookings_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                bookings = json.load(f)
        except Exception:
            bookings = []
        remaining = [b for b in bookings if b.get("booking_id") != booking_id]
        if len(remaining) == len(bookings):
            return False
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(remaining, f, ensure_ascii=False, indent=2)
        return True

# ==========================================
# 4. Documents Metadata Module (Collection: documents)
# ==========================================

async def db_load_documents() -> list[dict]:
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # ponytail: Mongo document metadata keeps the data/documents.json schema.
            cursor = db.documents.find({})
            return [_clean_mongo_doc(d) for d in await cursor.to_list(length=10000)]
        except Exception as e:
            logger.error(f"Error loading documents from MongoDB: {e}")

    # ponytail: JSON fallback keeps document metadata available without MongoDB.
    file_path = settings.DOCUMENTS_JSON_PATH
    with _documents_lock:
        _ensure_dir_for_file(file_path)
        if not os.path.exists(file_path):
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading documents JSON: {e}")
            return []

async def db_save_documents(docs: list[dict]) -> None:
    db = _mongo_db_or_none()
    if db is not None:
        try:
            # Upsert-only (same reasoning as db_save_bookings — no $nin reconcile-delete
            # that could wipe other tenants' docs from a stale fallback list). Explicit
            # removals go through db_delete_document().
            for d in docs:
                if "document_id" in d:
                    await db.documents.replace_one({"document_id": d["document_id"]}, d, upsert=True)
            return
        except Exception as e:
            logger.error(f"Error saving documents to MongoDB: {e}")

    # ponytail: On Mongo failure, keep writing the legacy documents JSON file.
    file_path = settings.DOCUMENTS_JSON_PATH
    with _documents_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(docs, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving documents JSON: {e}")


async def db_delete_document(document_id: str) -> bool:
    """Delete exactly one document metadata record by id (targeted, no reconcile)."""
    db = _mongo_db_or_none()
    if db is not None:
        try:
            res = await db.documents.delete_one({"document_id": document_id})
            return res.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting document from MongoDB: {e}")

    file_path = settings.DOCUMENTS_JSON_PATH
    with _documents_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                docs = json.load(f)
        except Exception:
            docs = []
        remaining = [d for d in docs if d.get("document_id") != document_id]
        if len(remaining) == len(docs):
            return False
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(remaining, f, ensure_ascii=False, indent=2)
        return True
