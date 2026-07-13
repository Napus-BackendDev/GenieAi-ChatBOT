"""Regression tests: GET /api/documents must filter metadata by tenant_id.

Pure logic — `list_documents` is a plain async function; we monkeypatch the
metadata loader so no file / network / OpenAI is touched (Ponytail).
"""
import asyncio
import pytest
from app.routers import documents


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def fake_meta(monkeypatch):
    """Two tenants share the store; the loader returns the whole mixed list."""
    meta = [
        {"document_id": "d1", "document_name": "a.pdf", "tenant_id": "t1",
         "uploaded_at": "2026-01-01T00:00:00Z", "pages": [{}, {}]},
        {"document_id": "d2", "document_name": "b.pdf", "tenant_id": "t2",
         "uploaded_at": "2026-01-02T00:00:00Z", "pages": [{}]},
        {"document_id": "d3", "document_name": "c.pdf", "tenant_id": "t1",
         "uploaded_at": "2026-01-03T00:00:00Z", "pages": [{}, {}, {}]},
        {"document_id": "d4", "document_name": "no_tenant.pdf",
         "uploaded_at": "2026-01-04T00:00:00Z", "pages": []},
    ]
    monkeypatch.setattr(documents, "_load_documents_meta", lambda: meta)
    return meta


def test_list_returns_only_matching_tenant(fake_meta):
    result = _run(documents.list_documents(tenant_id="t1"))
    ids = {d["document_id"] for d in result}
    assert ids == {"d1", "d3"}  # t2's d2 and the tenant-less d4 excluded


def test_list_other_tenant_isolated(fake_meta):
    result = _run(documents.list_documents(tenant_id="t2"))
    assert [d["document_id"] for d in result] == ["d2"]


def test_list_unknown_tenant_is_empty(fake_meta):
    assert _run(documents.list_documents(tenant_id="ghost")) == []


def test_list_strips_page_contents_and_counts(fake_meta):
    result = _run(documents.list_documents(tenant_id="t1"))
    d3 = next(d for d in result if d["document_id"] == "d3")
    # page_count is derived; raw "pages" payload must NOT leak into the listing.
    assert d3["page_count"] == 3
    assert "pages" not in d3
