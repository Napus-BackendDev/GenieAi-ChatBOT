import os
import logging
import uuid
import asyncio
import secrets
import hmac
from contextlib import asynccontextmanager

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.redis import init_redis, close_redis
from app.core.mongodb import init_mongo, close_mongo, is_mongo_connected, ping_mongo
from app.core.security import extract_request_token, decode_admin_token
from app.core.db import db_get_user_by_tenant
from app.routers import webhooks, documents, bookings, auth, tenant, chat, media
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

    deletion_stop = asyncio.Event()
    deletion_worker = None
    webhook_stop = asyncio.Event()
    webhook_worker = None
    if settings.DELETION_WORKER_ENABLED:
        from app.services.account_deletion import run_deletion_worker
        deletion_worker = asyncio.create_task(run_deletion_worker(deletion_stop))
    if settings.WEBHOOK_WORKER_ENABLED and is_mongo_connected():
        from app.services.webhook_queue import run_webhook_worker
        webhook_worker = asyncio.create_task(run_webhook_worker(webhook_stop))
    app.state.deletion_stop = deletion_stop
    app.state.deletion_worker = deletion_worker
    app.state.webhook_stop = webhook_stop
    app.state.webhook_worker = webhook_worker

    yield

    # 4. Stop durable workers before closing their database connections.
    deletion_stop.set()
    webhook_stop.set()
    if deletion_worker:
        try:
            await asyncio.wait_for(deletion_worker, timeout=5)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            deletion_worker.cancel()
    if webhook_worker:
        try:
            await asyncio.wait_for(webhook_worker, timeout=5)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            webhook_worker.cancel()

    # 5. Clean up connections on shutdown
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
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", settings.CSRF_HEADER_NAME],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)


@app.middleware("http")
async def csrf_protection(request: Request, call_next):
    """Protect cookie-authenticated state changes with double-submit CSRF and origin validation."""
    unsafe = request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}
    path = request.url.path
    exempt = (
        path in {"/api/auth/login", "/api/auth/signup", "/api/auth/link-google", "/api/auth/providers"}
        or path.startswith("/api/webhooks/")
    )
    session_present = bool(request.cookies.get(settings.SESSION_COOKIE_NAME))

    # Origin & Fetch Metadata check for all unsafe requests (including unauthenticated login/signup)
    if unsafe and not path.startswith("/api/webhooks/"):
        origin = request.headers.get("Origin")
        fetch_site = request.headers.get("Sec-Fetch-Site", "").lower()
        origin_ok = not origin or origin in settings.cors_origins
        fetch_site_ok = fetch_site not in {"cross-site"}
        if not (origin_ok and fetch_site_ok):
            if settings.CSRF_ENFORCEMENT == "report":
                logger.warning("Origin/Fetch-Site validation failed in report-only mode: %s", path)
            else:
                return JSONResponse(status_code=403, content={"detail": "CSRF_VALIDATION_FAILED"})

    if unsafe and session_present and not exempt:
        cookie_token = request.cookies.get(settings.CSRF_COOKIE_NAME, "")
        header_token = request.headers.get(settings.CSRF_HEADER_NAME, "")
        valid = bool(
            cookie_token
            and header_token
            and hmac.compare_digest(cookie_token, header_token)
        )
        if not valid:
            if settings.CSRF_ENFORCEMENT == "report":
                logger.warning("CSRF validation failed in report-only mode: %s", path)
            else:
                return JSONResponse(status_code=403, content={"detail": "CSRF_VALIDATION_FAILED"})

    response = await call_next(request)
    already_set = any(
        settings.CSRF_COOKIE_NAME in h for h in response.headers.getlist("set-cookie")
    )
    if not request.cookies.get(settings.CSRF_COOKIE_NAME) and not already_set and not path.startswith("/api/webhooks/"):
        response.set_cookie(
            key=settings.CSRF_COOKIE_NAME,
            value=secrets.token_urlsafe(32),
            max_age=86400,
            httponly=False,
            secure=settings.is_production,
            samesite=settings.SESSION_COOKIE_SAMESITE,
            path="/",
        )
    return response


@app.middleware("http")
async def tenant_context_guard(request: Request, call_next):
    """Ensure cookie-authenticated write operations match the active UI tenant context."""
    unsafe = request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}
    path = request.url.path
    exempt = (
        path in {"/api/auth/login", "/api/auth/signup", "/api/auth/link-google", "/api/auth/providers"}
        or path.startswith("/api/webhooks/")
    )
    session_present = bool(request.cookies.get(settings.SESSION_COOKIE_NAME))
    tenant_context = request.headers.get("X-Tenant-Context")

    if unsafe and session_present and not exempt and tenant_context:
        try:
            token = extract_request_token(
                request.headers.get("Authorization"),
                request.cookies.get(settings.SESSION_COOKIE_NAME),
            )
            if token:
                claims = decode_admin_token(token)
                session_tenant = claims.get("sub")
                if session_tenant and tenant_context.strip() != session_tenant:
                    return JSONResponse(
                        status_code=409,
                        content={
                            "detail": "SESSION_CONTEXT_CHANGED",
                            "message": "Session context changed in another tab.",
                        },
                    )
        except Exception:
            pass

    return await call_next(request)


@app.middleware("http")
async def auth_state_guard(request: Request, call_next):
    """Reject revoked, stale, locked, or deleting admin sessions before execution."""
    path = request.url.path
    # Logout must remain callable with an expired/stale cookie so the browser
    # can clear it. Public webhooks use provider signatures instead of admin JWTs.
    if path not in {"/api/auth/login", "/api/auth/providers", "/api/auth/logout"} and not path.startswith("/api/webhooks/"):
        try:
            token = extract_request_token(
                request.headers.get("Authorization"),
                request.cookies.get(settings.SESSION_COOKIE_NAME),
            )
        except HTTPException:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
        if token:
            try:
                claims = decode_admin_token(token)
            except HTTPException:
                return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
            tenant_id = claims["sub"]
            jti = claims.get("jti")
            if jti:
                try:
                    from app.core.redis import get_redis
                    redis_client = get_redis()
                    if await redis_client.exists(f"auth:revoked:{tenant_id}:{jti}") or await redis_client.exists(f"auth:revoked:{jti}"):
                        return JSONResponse(status_code=401, content={"detail": "Session revoked"})
                except Exception:
                    if settings.is_production:
                        return JSONResponse(status_code=503, content={"detail": "Authentication is temporarily unavailable."})
                    logger.warning("Session denylist unavailable in local mode")

                try:
                    user = await db_get_user_by_tenant(claims["sub"])
                except Exception:
                    if settings.is_production:
                        return JSONResponse(status_code=503, content={"detail": "Authentication is temporarily unavailable."})
                    user = None
                expected_version = int(user.get("session_version") or 0) if user else None
                token_version = int(claims.get("session_version") or 0)
                if user and (user.get("status", "active") != "active" or token_version != expected_version):
                    return JSONResponse(status_code=401, content={"detail": "Session is no longer active"})
                if settings.is_production and not user:
                    return JSONResponse(status_code=401, content={"detail": "Session is no longer active"})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-site"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
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
app.include_router(media.router)

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
    # In production Mongo is the only supported vector store. Do not even
    # initialize the legacy Chroma client during readiness checks; this keeps
    # the vulnerable transitional dependency out of the live request path.
    if settings.VECTOR_STORE != "mongo" or not settings.is_production:
        try:
            from app.services.rag import get_chroma_client

            chroma_ready = bool(get_chroma_client().heartbeat())
        except Exception:
            pass
    if settings.VECTOR_STORE == "mongo":
        # Mongo is the authoritative vector store in production. Chroma is an
        # embedded transitional fallback and must not keep a healthy Mongo
        # deployment out of readiness (or become a required network service).
        vector_ready = mongo_ready if settings.is_production else (mongo_ready or chroma_ready)
    else:
        vector_ready = chroma_ready
    ready = (
        redis_ready
        and vector_ready
        and (mongo_ready or not settings.is_production)
    )
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "redis": redis_ready,
            "mongodb": mongo_ready,
            "chroma": chroma_ready,
            "vector_store": settings.VECTOR_STORE,
            "vector_ready": vector_ready,
        },
    )
