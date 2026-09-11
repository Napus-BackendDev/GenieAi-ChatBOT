#!/usr/bin/env python3
"""Safe, resumable Chroma -> Mongo vector migration.

The command is intentionally dry-run by default. ``--apply`` only upserts
tenant-scoped ``knowledge_chunks`` records; it never drops or deletes Chroma
data. Run it in a maintenance window, compare the redacted report, then use
the application's vector feature flag for the dual-read/cutover period.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import chromadb
import numpy as np
from bson.binary import Binary
from pymongo import MongoClient


CHROMA_COLLECTION = "business_knowledge"
CHUNK_SUFFIX = re.compile(r"_p(?P<page>\d+)_c(?P<chunk>\d+)$")


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, default=str)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.remove(temporary)


def _record_key(tenant_id: str, document_id: str, chunk_index: int) -> str:
    return f"{tenant_id}:{document_id}:{chunk_index}"


def _hash_record(tenant_id: str, document_id: str, chunk_index: int, text: str, vector: np.ndarray) -> str:
    digest = hashlib.sha256()
    digest.update(tenant_id.encode("utf-8"))
    digest.update(b"\0")
    digest.update(document_id.encode("utf-8"))
    digest.update(b"\0")
    digest.update(str(chunk_index).encode("ascii"))
    digest.update(b"\0")
    digest.update(text.encode("utf-8"))
    digest.update(b"\0")
    digest.update(vector.astype(np.float32, copy=False).tobytes())
    return digest.hexdigest()


def _normalise_records(collection) -> list[dict]:
    result = collection.get(include=["documents", "embeddings", "metadatas"])
    ids = result.get("ids") or []
    documents = result.get("documents") or []
    embeddings = result.get("embeddings") or []
    metadatas = result.get("metadatas") or []
    records = []
    for index, record_id in enumerate(ids):
        metadata = metadatas[index] or {} if index < len(metadatas) else {}
        tenant_id = str(metadata.get("tenant_id") or "").strip()
        document_id = str(metadata.get("document_id") or "").strip()
        if not tenant_id or not document_id:
            raise RuntimeError(f"record {record_id!r} is missing tenant/document ownership metadata")
        match = CHUNK_SUFFIX.search(str(record_id))
        page_number = int(metadata.get("page_number") or (match.group("page") if match else 1))
        chunk_index = int(match.group("chunk")) if match else index
        text = str(documents[index] or "") if index < len(documents) else ""
        vector = np.asarray(embeddings[index], dtype=np.float32) if index < len(embeddings) else np.asarray([], dtype=np.float32)
        if vector.ndim != 1 or vector.size == 0:
            raise RuntimeError(f"record {record_id!r} has no valid embedding")
        records.append({
            "record_id": str(record_id),
            "tenant_id": tenant_id,
            "document_id": document_id,
            "document_name": str(metadata.get("document_name") or ""),
            "content_hash": str(metadata.get("content_hash") or ""),
            "page_number": page_number,
            "chunk_index": chunk_index,
            "text": text,
            "instruction_like": bool(metadata.get("instruction_like", False)),
            "vector": vector,
        })
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-path", required=True, help="Chroma persistence directory")
    parser.add_argument("--mongo-uri", required=True, help="MongoDB URI; never printed")
    parser.add_argument("--mongo-db", required=True, help="Target Mongo database name")
    parser.add_argument("--checkpoint", default="data/chroma-migration-checkpoint.json")
    parser.add_argument("--report", default="data/chroma-migration-report.json")
    parser.add_argument("--max-chunks-per-tenant", type=int, default=2000)
    parser.add_argument("--apply", action="store_true", help="Write idempotent upserts; default is dry-run")
    args = parser.parse_args()

    source = Path(args.source_path)
    checkpoint_path = Path(args.checkpoint)
    report_path = Path(args.report)
    if not source.exists():
        raise SystemExit(f"Chroma source path does not exist: {source}")
    if args.max_chunks_per_tenant <= 0:
        raise SystemExit("--max-chunks-per-tenant must be positive")

    client = chromadb.PersistentClient(path=str(source))
    collection = client.get_collection(name=CHROMA_COLLECTION)
    records = _normalise_records(collection)
    by_tenant: dict[str, list[dict]] = {}
    for record in records:
        by_tenant.setdefault(record["tenant_id"], []).append(record)
    over_limit = {
        tenant: len(items)
        for tenant, items in by_tenant.items()
        if len(items) > args.max_chunks_per_tenant
    }
    if over_limit:
        raise SystemExit(f"tenant chunk limit exceeded: {json.dumps(over_limit, sort_keys=True)}")

    checkpoint = _load_json(checkpoint_path, {"version": 1, "completed_keys": []})
    completed = set(checkpoint.get("completed_keys") or [])
    mongo = MongoClient(args.mongo_uri, serverSelectionTimeoutMS=5000)
    db = mongo[args.mongo_db]
    target = db.knowledge_chunks
    before = {tenant: target.count_documents({"tenant_id": tenant}) for tenant in by_tenant}
    sample_hashes = {}
    migrated = 0
    skipped = 0

    try:
        for record in records:
            key = _record_key(record["tenant_id"], record["document_id"], record["chunk_index"])
            record_hash = _hash_record(
                record["tenant_id"], record["document_id"], record["chunk_index"], record["text"], record["vector"]
            )
            sample_hashes.setdefault(record["tenant_id"], []).append(record_hash)
            if key in completed:
                skipped += 1
                continue
            if args.apply:
                target.update_one(
                    {
                        "tenant_id": record["tenant_id"],
                        "document_id": record["document_id"],
                        "chunk_index": record["chunk_index"],
                    },
                    {
                        "$set": {
                            "tenant_id": record["tenant_id"],
                            "document_id": record["document_id"],
                            "document_name": record["document_name"],
                            "content_hash": record["content_hash"],
                            "page_number": record["page_number"],
                            "chunk_index": record["chunk_index"],
                            "text": record["text"],
                            "embedding": Binary(record["vector"].tobytes()),
                            "embedding_dim": int(record["vector"].size),
                            "instruction_like": record["instruction_like"],
                            "migration_source_id": record["record_id"],
                            "migration_hash": record_hash,
                        }
                    },
                    upsert=True,
                )
                completed.add(key)
                checkpoint["completed_keys"] = sorted(completed)
                checkpoint["updated_at"] = _utc_now()
                _atomic_write_json(checkpoint_path, checkpoint)
            migrated += 1

        after = {tenant: target.count_documents({"tenant_id": tenant}) for tenant in by_tenant}
        report = {
            "version": 1,
            "generated_at": _utc_now(),
            "mode": "apply" if args.apply else "dry-run",
            "source_collection": CHROMA_COLLECTION,
            "source_count": len(records),
            "migrated_or_pending": migrated,
            "checkpoint_skipped": skipped,
            "tenant_source_counts": {tenant: len(items) for tenant, items in by_tenant.items()},
            "mongo_counts_before": before,
            "mongo_counts_after": after,
            "sample_hashes": {tenant: hashes[:5] for tenant, hashes in sample_hashes.items()},
            "chroma_unchanged": True,
            "next_step": "Run dual-read shadow comparison before enabling VECTOR_STORE=mongo." if not args.apply else "Compare counts/hashes and run retrieval overlap before cutover.",
        }
        _atomic_write_json(report_path, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
    finally:
        mongo.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
