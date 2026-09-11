"""Tenant-scoped media storage with GridFS as the production source of truth."""

from __future__ import annotations

import hashlib
import os
import re
import shutil
from pathlib import Path

from app.core.config import settings
from app.core.mongodb import get_mongo_db


_SAFE_COMPONENT = re.compile(r"^[A-Za-z0-9_-]+$")


def _safe_component(value: str, label: str) -> str:
    value = str(value or "").strip()
    if not value or not _SAFE_COMPONENT.fullmatch(value):
        raise ValueError(f"invalid media {label}")
    return value


def _media_url(media_id: str) -> str:
    # The opaque ID is stable. Private document URLs receive a fresh signed
    # token when they are read from the document metadata; marketing media can
    # be explicitly public and does not need a token.
    return f"/api/media/{media_id}"


async def store_media(
    content: bytes,
    *,
    tenant_id: str,
    filename: str,
    content_type: str,
    category: str,
    document_id: str | None = None,
) -> dict:
    """Store bytes and return an opaque URL plus integrity metadata."""
    tenant = _safe_component(tenant_id, "tenant")
    category = _safe_component(category, "category")
    digest = hashlib.sha256(content).hexdigest()
    db = get_mongo_db()

    if settings.is_production and settings.MEDIA_STORAGE == "gridfs" and db is None:
        raise RuntimeError("GRIDFS_UNAVAILABLE")

    if settings.MEDIA_STORAGE == "gridfs" and db is not None:
        from motor.motor_asyncio import AsyncIOMotorGridFSBucket

        bucket = AsyncIOMotorGridFSBucket(db, bucket_name="media")
        media_id = await bucket.upload_from_stream(
            os.path.basename(filename or "upload.bin"),
            content,
            metadata={
                "tenant_id": tenant,
                "category": category,
                "document_id": document_id,
                "content_type": content_type,
                "size": len(content),
                "sha256": digest,
                "public": category == "promotions",
            },
        )
        return {
            "media_id": str(media_id),
            "url": _media_url(str(media_id)),
            "sha256": digest,
            "size": len(content),
            "storage": "gridfs",
        }

    # Filesystem is retained only for local development without Mongo. The
    # caller still gets a tenant-scoped random filename, never user input.
    target_dir = Path(settings.STATIC_IMAGES_PATH) / tenant / category
    target_dir.mkdir(parents=True, exist_ok=True)
    extension = Path(os.path.basename(filename or "upload.bin")).suffix.lower()
    safe_name = f"{digest}{extension}"
    target = target_dir / safe_name
    target.write_bytes(content)
    return {
        "media_id": None,
        "url": f"/static/images/{tenant}/{category}/{safe_name}",
        "sha256": digest,
        "size": len(content),
        "storage": "filesystem",
    }


async def delete_document_media(tenant_id: str, document_id: str) -> None:
    db = get_mongo_db()
    if settings.MEDIA_STORAGE == "gridfs" and db is not None:
        from motor.motor_asyncio import AsyncIOMotorGridFSBucket

        bucket = AsyncIOMotorGridFSBucket(db, bucket_name="media")
        cursor = db["media.files"].find({"metadata.tenant_id": tenant_id, "metadata.document_id": document_id}, {"_id": 1})
        async for item in cursor:
            await bucket.delete(item["_id"])


async def delete_tenant_media(tenant_id: str) -> None:
    db = get_mongo_db()
    if settings.MEDIA_STORAGE == "gridfs" and db is not None:
        from motor.motor_asyncio import AsyncIOMotorGridFSBucket

        bucket = AsyncIOMotorGridFSBucket(db, bucket_name="media")
        cursor = db["media.files"].find({"metadata.tenant_id": tenant_id}, {"_id": 1})
        async for item in cursor:
            await bucket.delete(item["_id"])

    static_dir = Path(settings.STATIC_IMAGES_PATH) / tenant_id
    if static_dir.exists():
        shutil.rmtree(static_dir)
