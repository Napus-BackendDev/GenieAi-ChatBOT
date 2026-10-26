import asyncio

from app.core import db as persistence


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class _FakeCollection:
    def __init__(self):
        self.replacements = []
        self.deletes = []

    async def replace_one(self, query, doc, upsert=False):
        self.replacements.append((query, doc, upsert))

    async def delete_many(self, query):
        self.deletes.append(query)


class _FakeMongo:
    def __init__(self):
        self.documents = _FakeCollection()


def test_document_metadata_mongo_save_uses_document_id(monkeypatch):
    fake = _FakeMongo()
    monkeypatch.setattr(persistence, "_mongo_db_or_none", lambda: fake)

    _run(persistence.db_save_documents([
        {"document_id": "doc-1", "tenant_id": "tenant-a", "document_name": "a.pdf"},
        {"document_id": "doc-2", "tenant_id": "tenant-a", "document_name": "b.pdf"},
    ]))

    assert fake.documents.replacements == [
        ({"document_id": "doc-1"}, {"document_id": "doc-1", "tenant_id": "tenant-a", "document_name": "a.pdf"}, True),
        ({"document_id": "doc-2"}, {"document_id": "doc-2", "tenant_id": "tenant-a", "document_name": "b.pdf"}, True),
    ]
    assert fake.documents.deletes == []


def test_inbox_merges_durable_messages_with_legacy_embedded_ones(monkeypatch):
    """Regression: the inbox only showed the legacy embedded `messages`, so every chat since durable
    storage looked stale/missing in the dashboard while 'last message' was current."""
    import asyncio
    from datetime import datetime, timezone
    from app.core import db as persistence

    legacy = [{"role": "user", "content": "สวัสดี", "ts": "2026-07-14T11:35:10.123Z"}]
    new_docs = [
        {"tenant_id": "t1", "session_id": "U1", "role": "assistant", "content": "ตอบใหม่",
         "created_at": datetime(2026, 10, 26, 2, 0, tzinfo=timezone.utc)},
        {"tenant_id": "t1", "session_id": "U1", "role": "user", "content": "ถามใหม่",
         "created_at": datetime(2026, 10, 26, 1, 59, tzinfo=timezone.utc)},
    ]

    class _Cursor:
        def __init__(self, docs): self.docs = docs
        def sort(self, *_a, **_k): return self
        async def to_list(self, length=None): return list(self.docs)

    class _Coll:
        def __init__(self, docs): self.docs = docs
        def find(self, *_a, **_k): return _Cursor(self.docs)

    class _Db:
        conversations = _Coll([{"tenant_id": "t1", "session_id": "U1", "messages": legacy, "last_message": "ตอบใหม่"}])
        conversation_messages = _Coll(new_docs)

    monkeypatch.setattr(persistence, "_mongo_db_or_none", lambda: _Db())
    convos = asyncio.new_event_loop().run_until_complete(persistence.db_list_conversations("t1"))
    texts = [m["content"] for m in convos[0]["messages"]]
    assert texts == ["สวัสดี", "ถามใหม่", "ตอบใหม่"]  # legacy first, then new ones in time order
