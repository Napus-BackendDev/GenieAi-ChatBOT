import os
import json
import logging
import threading
from datetime import datetime
from app.core.mongodb import get_mongo_db
from app.core.config import settings

logger = logging.getLogger(__name__)

# File locks for JSON operations
_users_lock = threading.Lock()
_tenant_lock = threading.Lock()
_bookings_lock = threading.Lock()
_documents_lock = threading.Lock()
_conversations_lock = threading.Lock()

# JSON file paths
def _get_users_file_path() -> str:
    try:
        from app.routers.auth import USERS_FILE_PATH as router_users_path
        return router_users_path
    except Exception:
        return "data/users.json"

# Helper for local JSON files
def _ensure_dir_for_file(filepath: str) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

def _clean_mongo_doc(doc: dict) -> dict:
    cleaned = dict(doc)
    cleaned.pop("_id", None)
    return cleaned

def _mongo_db_or_none():
    return get_mongo_db()


def _require_local_fallback(operation: str) -> None:
    if not settings.ALLOW_LOCAL_DATA_FALLBACK:
        raise RuntimeError(f"MongoDB unavailable during {operation}; local fallback is disabled")

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

    _require_local_fallback("load users")
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

    _require_local_fallback("save users")
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
            if not settings.ALLOW_LOCAL_DATA_FALLBACK:
                return {}
        except Exception as e:
            logger.error(f"Error loading profile {tenant_id} from MongoDB: {e}")

    _require_local_fallback("load tenant profile")
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
            if not settings.ALLOW_LOCAL_DATA_FALLBACK:
                raise

    _require_local_fallback("save tenant profile")
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

    _require_local_fallback("load bookings")
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

    _require_local_fallback("save bookings")
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

    _require_local_fallback("delete booking")
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

    _require_local_fallback("load documents")
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

    _require_local_fallback("save documents")
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
            logger.error(f"Error deleting document {document_id} from MongoDB: {e}")
            return False

    _require_local_fallback("delete document")
    file_path = settings.DOCUMENTS_JSON_PATH
    with _documents_lock:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                docs = json.load(f)
            remaining = [d for d in docs if d.get("document_id") != document_id]
            if len(remaining) == len(docs):
                return False
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(remaining, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Error deleting document from documents.json: {e}")
            return False


async def db_delete_tenant_data(tenant_id: str) -> None:
    """
    Deletes all data associated with tenant_id from MongoDB and JSON fallback stores.
    """
    db = _mongo_db_or_none()
    if db is not None:
        try:
            await db.users.delete_many({"tenant_id": tenant_id})
            await db.tenant_profiles.delete_many({"tenant_id": tenant_id})
            await db.documents.delete_many({"tenant_id": tenant_id})
            await db.bookings.delete_many({"tenant_id": tenant_id})
            logger.info(f"Successfully deleted all MongoDB collections for tenant {tenant_id}")
        except Exception as e:
            logger.error(f"Error deleting tenant {tenant_id} from MongoDB: {e}")
            if not settings.ALLOW_LOCAL_DATA_FALLBACK:
                raise

    if not settings.ALLOW_LOCAL_DATA_FALLBACK:
        return
    # JSON fallback deletions
    # 1. Users
    file_path = _get_users_file_path()
    with _users_lock:
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    users = json.load(f)
                users = [u for u in users if u.get("tenant_id") != tenant_id]
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(users, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error(f"Error deleting tenant {tenant_id} from users.json: {e}")

    # 2. Tenant Profile
    profile_path = _get_profile_path(tenant_id)
    with _tenant_lock:
        if os.path.exists(profile_path):
            try:
                os.remove(profile_path)
                logger.info(f"Deleted profile file: {profile_path}")
            except Exception as e:
                logger.error(f"Error removing profile file {profile_path}: {e}")

    # 3. Bookings
    bookings_path = settings.BOOKINGS_JSON_PATH
    with _bookings_lock:
        if os.path.exists(bookings_path):
            try:
                with open(bookings_path, "r", encoding="utf-8") as f:
                    bookings = json.load(f)
                bookings = [b for b in bookings if b.get("tenant_id") != tenant_id]
                with open(bookings_path, "w", encoding="utf-8") as f:
                    json.dump(bookings, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error(f"Error deleting tenant bookings from bookings.json: {e}")

    # 4. Documents Metadata
    docs_path = settings.DOCUMENTS_JSON_PATH
    with _documents_lock:
        if os.path.exists(docs_path):
            try:
                with open(docs_path, "r", encoding="utf-8") as f:
                    docs = json.load(f)
                docs = [d for d in docs if d.get("tenant_id") != tenant_id]
                with open(docs_path, "w", encoding="utf-8") as f:
                    json.dump(docs, f, ensure_ascii=False, indent=2)
            except Exception as e:
                logger.error(f"Error deleting tenant documents metadata from documents.json: {e}")


# ==========================================
# 5. Conversations Module (Collection: conversations)
# Durable chat inbox — Redis holds the AI's short-term context (2h TTL, last N
# messages); this stores the FULL conversation permanently so the dashboard inbox
# never loses messages. One document per (tenant_id, session_id).
# ==========================================

def _conversations_file_path() -> str:
    return getattr(settings, "CONVERSATIONS_JSON_PATH", "data/conversations.json")


def _load_conversations_json() -> list:
    file_path = _conversations_file_path()
    _ensure_dir_for_file(file_path)
    if not os.path.exists(file_path):
        return []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading conversations JSON: {e}")
        return []


def _save_conversations_json(convos: list) -> None:
    file_path = _conversations_file_path()
    _ensure_dir_for_file(file_path)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(convos, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving conversations JSON: {e}")


async def db_append_message(tenant_id: str, session_id: str, role: str, content: str, channel: str = None) -> None:
    """Append one message to the durable conversation. Best-effort: never raise
    (a persistence hiccup must not break the live chat / webhook reply)."""
    now = datetime.utcnow().isoformat() + "Z"
    msg = {"role": role, "content": content, "ts": now}
    db = _mongo_db_or_none()
    if db is not None:
        try:
            set_on_insert = {"created_at": now}
            if channel:
                set_on_insert["channel"] = channel
            await db.conversations.update_one(
                {"tenant_id": tenant_id, "session_id": session_id},
                {
                    "$push": {"messages": msg},
                    "$set": {"last_message": content, "last_role": role, "updated_at": now},
                    "$inc": {"message_count": 1},
                    "$setOnInsert": set_on_insert,
                },
                upsert=True,
            )
            return
        except Exception as e:
            logger.error(f"Error appending message to MongoDB conversations: {e}")

    _require_local_fallback("append conversation")
    # ponytail: JSON fallback keeps the durable inbox working without MongoDB.
    with _conversations_lock:
        convos = _load_conversations_json()
        conv = next((c for c in convos if c.get("tenant_id") == tenant_id and c.get("session_id") == session_id), None)
        if conv is None:
            conv = {"tenant_id": tenant_id, "session_id": session_id, "messages": [],
                    "message_count": 0, "created_at": now, "channel": channel}
            convos.append(conv)
        conv.setdefault("messages", []).append(msg)
        conv["message_count"] = len(conv["messages"])
        conv["last_message"] = content
        conv["last_role"] = role
        conv["updated_at"] = now
        _save_conversations_json(convos)


async def db_list_conversations(tenant_id: str) -> list[dict]:
    """All conversations for a tenant, newest activity first (for the inbox list)."""
    db = _mongo_db_or_none()
    if db is not None:
        try:
            cursor = db.conversations.find({"tenant_id": tenant_id}).sort("updated_at", -1)
            return [_clean_mongo_doc(c) for c in await cursor.to_list(length=1000)]
        except Exception as e:
            logger.error(f"Error listing conversations from MongoDB: {e}")

    _require_local_fallback("list conversations")
    with _conversations_lock:
        convos = [c for c in _load_conversations_json() if c.get("tenant_id") == tenant_id]
    convos.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    return convos


async def db_get_conversation(tenant_id: str, session_id: str) -> dict | None:
    """Full message history for one session."""
    db = _mongo_db_or_none()
    if db is not None:
        try:
            doc = await db.conversations.find_one({"tenant_id": tenant_id, "session_id": session_id})
            return _clean_mongo_doc(doc) if doc else None
        except Exception as e:
            logger.error(f"Error loading conversation from MongoDB: {e}")

    _require_local_fallback("get conversation")
    with _conversations_lock:
        return next((c for c in _load_conversations_json()
                     if c.get("tenant_id") == tenant_id and c.get("session_id") == session_id), None)


async def db_clear_conversation(tenant_id: str, session_id: str) -> bool:
    """Delete one durable conversation (targeted)."""
    db = _mongo_db_or_none()
    if db is not None:
        try:
            res = await db.conversations.delete_one({"tenant_id": tenant_id, "session_id": session_id})
            return res.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting conversation from MongoDB: {e}")

    _require_local_fallback("clear conversation")
    with _conversations_lock:
        convos = _load_conversations_json()
        remaining = [c for c in convos if not (c.get("tenant_id") == tenant_id and c.get("session_id") == session_id)]
        if len(remaining) == len(convos):
            return False
        _save_conversations_json(remaining)
        return True


# ==========================================
# 6. Tenant Routing helpers (multi-tenant channel resolution)
# Replace get_active_tenant_id() (first-user) — resolve the OWNING tenant per channel
# so a customer's messages always land in the right inbox.
# ==========================================

async def db_resolve_tenant_by_fb_page_id(page_id: str) -> str | None:
    """Which tenant owns this Facebook Page ID? None if unmapped."""
    if not page_id:
        return None
    db = _mongo_db_or_none()
    if db is not None:
        try:
            doc = await db.tenant_profiles.find_one(
                {"facebook_page_id": page_id}, {"tenant_id": 1}
            )
            return doc.get("tenant_id") if doc else None
        except Exception as e:
            logger.error(f"Error resolving tenant by FB page id: {e}")
            return None

    _require_local_fallback("resolve Facebook tenant")
    # JSON fallback: scan tenant_profile_*.json for a matching facebook_page_id.
    import glob
    data_dir = os.path.dirname(_get_profile_path("x")) or "data"
    for path in glob.glob(os.path.join(data_dir, "tenant_profile_*.json")):
        try:
            with open(path, "r", encoding="utf-8") as f:
                prof = json.load(f)
            if prof.get("facebook_page_id") == page_id:
                return prof.get("tenant_id") or os.path.basename(path)[len("tenant_profile_"):-len(".json")]
        except Exception:
            continue
    return None


async def db_tenant_exists(tenant_id: str) -> bool:
    """True if tenant_id belongs to a real registered user. Used to reject
    channel requests carrying a bogus/blank tenant_id (prevents cross-tenant probing
    and 'default'-bucket scatter)."""
    if not tenant_id:
        return False
    db = _mongo_db_or_none()
    if db is not None:
        try:
            return await db.users.count_documents({"tenant_id": tenant_id}, limit=1) > 0
        except Exception as e:
            logger.error(f"Error checking tenant existence: {e}")
            return False
    users = await db_load_users()
    return any(u.get("tenant_id") == tenant_id for u in users)
