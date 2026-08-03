import os
import logging
import uuid
from contextlib import asynccontextmanager

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.redis import init_redis, close_redis
from app.core.mongodb import init_mongo, close_mongo, is_mongo_connected, ping_mongo
from app.routers import webhooks, documents, bookings, auth, tenant, chat
from app.routers import webhooks_facebook, webhooks_web

# Ensure directories exist before mounting static folder
os.makedirs("static", exist_ok=True)
os.makedirs(settings.STATIC_IMAGES_PATH, exist_ok=True)
os.makedirs("data", exist_ok=True)

# Configure Logger
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown lifecycle events.
    """
    logger.info("Starting up FastAPI application...")
    settings.validate_runtime()
    
    # 1. Ensure static folders exist
    os.makedirs(settings.STATIC_IMAGES_PATH, exist_ok=True)
    os.makedirs("data", exist_ok=True)
    
    # 2. Connect to remote Redis API
    try:
        await init_redis()
    except Exception as e:
        logger.error(f"Failed to initialize Redis on startup: {e}")
        if settings.is_production:
            raise

    # 3. Connect to MongoDB (optional — no-op if MONGODB_URI is unset)
    try:
        await init_mongo()
    except Exception as e:
        logger.error(f"Failed to initialize MongoDB on startup: {e}")
        if settings.is_production:
            raise
    if settings.is_production and not is_mongo_connected():
        raise RuntimeError("MongoDB is required in production")

    yield

    # 4. Clean up connections on shutdown
    logger.info("Shutting down FastAPI application...")
    await close_redis()
    await close_mongo()

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Set up CORS Middleware (React Dashboard connection).
# Explicit allowlist from CORS_ORIGINS env var (comma-separated), defaulting to
# local Vite dev. Never pair "*" with allow_credentials=True (browser blocks it
# and it defeats the point of credentialed requests).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.url.path != "/api/webhooks/web/widget":
        response.headers["X-Frame-Options"] = "DENY"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Persisted uploads may live outside the source-controlled static directory.
app.mount(
    "/static/images",
    StaticFiles(directory=settings.STATIC_IMAGES_PATH),
    name="static-images",
)
# Mount public static assets directory (including the versioned widget script).
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount Routers
app.include_router(webhooks.router)
app.include_router(documents.router)
app.include_router(bookings.router)
app.include_router(auth.router)
app.include_router(tenant.router)
app.include_router(chat.router)
app.include_router(webhooks_facebook.router)
app.include_router(webhooks_web.router)

@app.get("/")
async def root():
    """
    Health check root route.
    """
    return {
        "app": settings.PROJECT_NAME,
        "status": "running",
    }


@app.get("/health/live", include_in_schema=False)
async def health_live():
    return {"status": "alive"}


@app.get("/health/ready", include_in_schema=False)
async def health_ready():
    from app.core.redis import get_redis

    redis_ready = False
    try:
        redis_ready = bool(await get_redis().ping())
    except Exception:
        pass
    mongo_ready = await ping_mongo()
    chroma_ready = False
    try:
        from app.services.rag import get_chroma_client

        chroma_ready = bool(get_chroma_client().heartbeat())
    except Exception:
        pass
    ready = (
        redis_ready
        and chroma_ready
        and (mongo_ready or not settings.is_production)
    )
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "redis": redis_ready,
            "mongodb": mongo_ready,
            "chroma": chroma_ready,
        },
    )
