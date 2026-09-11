"""Authenticated/signed access to opaque GridFS media IDs."""

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.core.mongodb import get_mongo_db
from app.core.security import decode_admin_token, decode_media_token, extract_request_token
from app.core.config import settings


router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/{media_id}")
async def get_media(media_id: str, request: Request):
    if not ObjectId.is_valid(media_id):
        raise HTTPException(status_code=404, detail="Media not found")
    db = get_mongo_db()
    if db is None:
        raise HTTPException(status_code=404, detail="Media not found")

    metadata_doc = await db["media.files"].find_one({"_id": ObjectId(media_id)})
    if not metadata_doc:
        raise HTTPException(status_code=404, detail="Media not found")
    metadata = metadata_doc.get("metadata") or {}
    owner_tenant = str(metadata.get("tenant_id") or "")
    token = request.query_params.get("token")
    if token:
        claims = decode_media_token(token, media_id)
        if claims.get("sub") != owner_tenant:
            raise HTTPException(status_code=404, detail="Media not found")
    elif metadata.get("public") is not True:
        admin_token = extract_request_token(
            request.headers.get("Authorization"),
            request.cookies.get(settings.SESSION_COOKIE_NAME),
        )
        if not admin_token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        claims = decode_admin_token(admin_token)
        if claims.get("sub") != owner_tenant:
            raise HTTPException(status_code=404, detail="Media not found")

    from motor.motor_asyncio import AsyncIOMotorGridFSBucket
    import io

    sink = io.BytesIO()
    bucket = AsyncIOMotorGridFSBucket(db, bucket_name="media")
    await bucket.download_to_stream(ObjectId(media_id), sink)
    return Response(
        content=sink.getvalue(),
        media_type=metadata.get("content_type") or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )
