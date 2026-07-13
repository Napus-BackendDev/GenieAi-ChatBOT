import os
import json
import logging
import threading
from app.core.mongodb import get_mongo_db, is_mongo_connected
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

# ==========================================
# 1. Users Module (Collection: users)
# ==========================================

async def db_load_users() -> list[dict]:
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            cursor = db.users.find({})
            users = await cursor.to_list(length=10000)
            for u in users:
                if "_id" in u:
                    del u["_id"]
            return users
        except Exception as e:
            logger.error(f"Error loading users from MongoDB: {e}")

    # Fallback to local JSON
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
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            # Perform bulk upsert or insert
            for user in users:
                await db.users.replace_one({"tenant_id": user["tenant_id"]}, user, upsert=True)
            return
        except Exception as e:
            logger.error(f"Error saving users to MongoDB: {e}")

    # Fallback to local JSON
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
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            profile = await db.tenant_profiles.find_one({"tenant_id": tenant_id})
            if profile:
                if "_id" in profile:
                    del profile["_id"]
                return profile
        except Exception as e:
            logger.error(f"Error loading profile {tenant_id} from MongoDB: {e}")

    # Fallback to local JSON
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
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            await db.tenant_profiles.replace_one({"tenant_id": tenant_id}, profile_data, upsert=True)
            return
        except Exception as e:
            logger.error(f"Error saving profile {tenant_id} to MongoDB: {e}")

    # Fallback to local JSON
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
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            cursor = db.bookings.find({})
            bookings = await cursor.to_list(length=10000)
            for b in bookings:
                if "_id" in b:
                    del b["_id"]
            return bookings
        except Exception as e:
            logger.error(f"Error loading bookings from MongoDB: {e}")

    # Fallback to local JSON
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
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            # Clear and replace or do replacement loop
            # To keep clean synchronization, clear and insert all, or upsert by booking_id
            for b in bookings:
                if "booking_id" in b:
                    await db.bookings.replace_one({"booking_id": b["booking_id"]}, b, upsert=True)
            # Remove any bookings in MongoDB that are no longer in the list (e.g. deleted/cancelled)
            current_ids = [b["booking_id"] for b in bookings if "booking_id" in b]
            await db.bookings.delete_many({"booking_id": {"$nin": current_ids}})
            return
        except Exception as e:
            logger.error(f"Error saving bookings to MongoDB: {e}")

    # Fallback to local JSON
    file_path = settings.BOOKINGS_JSON_PATH
    with _bookings_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(bookings, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving bookings JSON: {e}")

# ==========================================
# 4. Documents Metadata Module (Collection: documents)
# ==========================================

async def db_load_documents() -> list[dict]:
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            cursor = db.documents.find({})
            docs = await cursor.to_list(length=10000)
            for d in docs:
                if "_id" in d:
                    del d["_id"]
            return docs
        except Exception as e:
            logger.error(f"Error loading documents from MongoDB: {e}")

    # Fallback to local JSON
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
    if is_mongo_connected():
        try:
            db = get_mongo_db()
            for d in docs:
                if "id" in d:
                    await db.documents.replace_one({"id": d["id"]}, d, upsert=True)
            # Remove any docs in MongoDB that are no longer in the list (e.g. deleted)
            current_ids = [d["id"] for d in docs if "id" in d]
            await db.documents.delete_many({"id": {"$nin": current_ids}})
            return
        except Exception as e:
            logger.error(f"Error saving documents to MongoDB: {e}")

    # Fallback to local JSON
    file_path = settings.DOCUMENTS_JSON_PATH
    with _documents_lock:
        _ensure_dir_for_file(file_path)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(docs, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving documents JSON: {e}")
