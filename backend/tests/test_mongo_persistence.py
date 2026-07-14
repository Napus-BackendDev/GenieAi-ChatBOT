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
