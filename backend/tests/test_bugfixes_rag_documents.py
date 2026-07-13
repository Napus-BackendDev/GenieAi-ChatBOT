"""Regression tests for two confirmed bugs.

Network-free and deterministic (Ponytail):
- ChromaDB is faked with a stub collection that records delete(where=...) calls.
- Redis is faked so no network is hit.
- Profile/document JSON is redirected into tmp_path.

BUG 1 (rag.delete_document): the tenant-ownership check must run BEFORE any
ChromaDB deletion, and the ChromaDB delete must be scoped by tenant using the
$and filter syntax -- so passing another tenant's document_id deletes NOTHING.

BUG 2 (documents.reextract_schedules): the read-modify-write of the tenant
profile must hold tenant_file_lock, validate tenant_id, write atomically, and
invalidate the Redis CAG cache.
"""
import json
import asyncio
import pytest
from fastapi import HTTPException

from app.services import rag
from app.routers import documents


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

class _FakeCollection:
    """Records the where-filter passed to delete()."""
    def __init__(self):
        self.delete_calls = []

    def delete(self, where=None):
        self.delete_calls.append(where)


class _FakeRedis:
    def __init__(self):
        self.deleted_keys = []

    async def delete(self, key):
        self.deleted_keys.append(key)
        return 1


# ---------------------------------------------------------------------------
# BUG 1 -- delete_document
# ---------------------------------------------------------------------------

@pytest.fixture
def rag_env(monkeypatch, tmp_path):
    """Redirect documents.json + Chroma + Redis + static path for rag tests."""
    docs_path = tmp_path / "documents.json"
    monkeypatch.setattr(rag.settings, "DOCUMENTS_JSON_PATH", str(docs_path))
    monkeypatch.setattr(rag.settings, "STATIC_IMAGES_PATH", str(tmp_path / "static_images"))

    fake_collection = _FakeCollection()
    monkeypatch.setattr(rag, "get_knowledge_collection", lambda: fake_collection)

    fake_redis = _FakeRedis()
    import app.core.redis as core_redis
    monkeypatch.setattr(core_redis, "get_redis", lambda: fake_redis)

    return docs_path, fake_collection, fake_redis


def _seed_docs(path, docs):
    path.write_text(json.dumps(docs, ensure_ascii=False), encoding="utf-8")


def test_delete_document_wrong_tenant_deletes_nothing(rag_env):
    """A caller passing another tenant's doc_id must NOT touch ChromaDB and returns False."""
    docs_path, collection, _redis = rag_env
    # Document belongs to tenant 'owner'.
    _seed_docs(docs_path, [{"document_id": "docA", "tenant_id": "owner"}])

    result = _run(rag.delete_document("docA", tenant_id="attacker"))

    assert result is False
    # Ownership check ran first -> NO ChromaDB delete happened at all.
    assert collection.delete_calls == []
    # Metadata untouched.
    remaining = json.loads(docs_path.read_text(encoding="utf-8"))
    assert remaining == [{"document_id": "docA", "tenant_id": "owner"}]


def test_delete_document_owner_scopes_chroma_by_tenant(rag_env):
    """The owner's delete uses the $and filter (document_id AND tenant_id)."""
    docs_path, collection, redis = rag_env
    _seed_docs(docs_path, [
        {"document_id": "docA", "tenant_id": "owner"},
        {"document_id": "docB", "tenant_id": "owner"},
    ])

    result = _run(rag.delete_document("docA", tenant_id="owner"))

    assert result is True
    # Exactly one tenant-scoped delete with the required $and syntax.
    assert collection.delete_calls == [
        {"$and": [{"document_id": "docA"}, {"tenant_id": "owner"}]}
    ]
    # Only docA removed from metadata.
    remaining = json.loads(docs_path.read_text(encoding="utf-8"))
    assert remaining == [{"document_id": "docB", "tenant_id": "owner"}]
    # Cache invalidated for the tenant.
    assert f"tenant_cag_profile:owner" in redis.deleted_keys


# ---------------------------------------------------------------------------
# BUG 2 -- reextract_schedules
# ---------------------------------------------------------------------------

@pytest.fixture
def reextract_env(monkeypatch, tmp_path):
    """Redirect profile path + Redis + fake extraction/corpus for reextract tests."""
    profile_path = tmp_path / "tenant_profile_t1.json"
    # documents.py imported _get_profile_path into its own namespace, so patch it there.
    monkeypatch.setattr(documents, "_get_profile_path", lambda tid: str(profile_path))

    fake_redis = _FakeRedis()
    import app.core.redis as core_redis
    monkeypatch.setattr(core_redis, "get_redis", lambda: fake_redis)

    # Corpus always has text so we reach the profile write.
    async def _fake_profile(tenant_id):
        return {"consolidated_text": "some document text"}
    monkeypatch.setattr(rag, "get_tenant_knowledge_profile", _fake_profile)

    return profile_path, fake_redis


def test_reextract_rejects_bad_tenant_id(reextract_env):
    with pytest.raises(HTTPException) as exc:
        _run(documents.reextract_schedules("../x"))
    assert exc.value.status_code == 400


def test_reextract_missing_profile_404(reextract_env, monkeypatch):
    async def _fake_extract(text):
        return {"staff": []}
    monkeypatch.setattr(documents, "extract_business_rules_from_text", _fake_extract)

    with pytest.raises(HTTPException) as exc:
        _run(documents.reextract_schedules("t1"))
    assert exc.value.status_code == 404


def test_reextract_updates_schedule_atomically_and_busts_cache(reextract_env, monkeypatch):
    profile_path, redis = reextract_env
    profile_path.write_text(json.dumps({
        "company_name": "Acme",
        "staff": [{"name": "Dr. Lee", "schedule": ""}],
    }), encoding="utf-8")

    async def _fake_extract(text):
        return {"staff": [{"name": "dr. lee", "schedule": "Mon-Fri 9-5"}]}
    monkeypatch.setattr(documents, "extract_business_rules_from_text", _fake_extract)

    result = _run(documents.reextract_schedules("t1"))

    assert result == {"status": "success", "updated_count": 1}
    saved = json.loads(profile_path.read_text(encoding="utf-8"))
    assert saved["staff"][0]["schedule"] == "Mon-Fri 9-5"
    assert saved["company_name"] == "Acme"  # untouched field preserved
    # No leftover temp file in the directory.
    leftovers = [p.name for p in profile_path.parent.glob("*.tmp")]
    assert leftovers == []
    # Cache invalidated.
    assert "tenant_cag_profile:t1" in redis.deleted_keys


def test_reextract_no_match_does_not_write_or_bust_cache(reextract_env, monkeypatch):
    profile_path, redis = reextract_env
    original = {"staff": [{"name": "Dr. Lee", "schedule": "orig"}]}
    profile_path.write_text(json.dumps(original), encoding="utf-8")

    async def _fake_extract(text):
        return {"staff": [{"name": "Someone Else", "schedule": "X"}]}
    monkeypatch.setattr(documents, "extract_business_rules_from_text", _fake_extract)

    result = _run(documents.reextract_schedules("t1"))

    assert result == {"status": "success", "updated_count": 0}
    saved = json.loads(profile_path.read_text(encoding="utf-8"))
    assert saved == original  # unchanged
    assert redis.deleted_keys == []  # no cache bust when nothing changed
