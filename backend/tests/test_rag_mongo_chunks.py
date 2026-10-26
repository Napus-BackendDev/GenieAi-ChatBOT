"""Regression: multi-page documents must get document-unique chunk_index values.

The Mongo store has a unique index on (tenant_id, document_id, chunk_index). Numbering chunks per page made
every multi-page PDF fail with BulkWriteError on production.
"""
import asyncio

import pytest

from app.services import rag


class _Cursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, length=None):
        return list(self.rows)


class _Chunks:
    def __init__(self):
        self.rows = []

    async def count_documents(self, flt):
        return len(self.rows)

    async def insert_many(self, records, ordered=True):
        for r in records:
            key = (r["tenant_id"], r["document_id"], r["chunk_index"])
            if any((x["tenant_id"], x["document_id"], x["chunk_index"]) == key for x in self.rows):
                raise RuntimeError(f"duplicate key {key}")
            self.rows.append(r)

    async def delete_many(self, flt):
        return None


class _FakeDb:
    def __init__(self):
        self.knowledge_chunks = _Chunks()
        saved = self.saved = []

        class _Docs:
            def find(self, flt):
                return _Cursor([])

            async def delete_many(self, flt):
                return None

            async def insert_one(self, doc):
                saved.append(doc)

        self.documents = _Docs()


def test_multi_page_document_has_unique_chunk_indexes(monkeypatch):
    fake = _FakeDb()
    saved = fake.saved

    async def fake_embedding(text, tenant_id=None):
        return [0.1, 0.2, 0.3]

    async def fake_save(docs):
        saved.extend(docs)

    monkeypatch.setattr(rag, "get_mongo_db", lambda: fake)
    monkeypatch.setattr(rag, "get_embedding", fake_embedding)
    monkeypatch.setattr(rag, "db_save_documents", fake_save)

    doc = {
        "document_id": "d1",
        "document_name": "multi.pdf",
        "pages": [
            {"page_number": 1, "text": "หน้าหนึ่ง " * 200, "images": []},
            {"page_number": 2, "text": "หน้าสอง " * 200, "images": []},
            {"page_number": 3, "text": "หน้าสาม " * 200, "images": []},
        ],
    }
    asyncio.run(rag._index_document_mongo(doc, "t1", "hash1"))
    idx = [r["chunk_index"] for r in fake.knowledge_chunks.rows]
    assert len(idx) > 3 and idx == sorted(set(idx)) == list(range(len(idx)))
