import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.redis import init_redis, close_redis
from app.core.mongodb import init_mongo, close_mongo, is_mongo_connected
from app.routers import webhooks, documents, bookings, auth, tenant, chat

# Ensure directories exist before mounting static folder
os.makedirs("static", exist_ok=True)
os.makedirs("static/images", exist_ok=True)
os.makedirs("data", exist_ok=True)

# Configure Logger
logging.basicConfig(
    level=logging.INFO,
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
    
    # 1. Ensure static folders exist
    os.makedirs(settings.STATIC_IMAGES_PATH, exist_ok=True)
    os.makedirs("data", exist_ok=True)
    
    # 2. Connect to remote Redis API
    try:
        await init_redis()
    except Exception as e:
        logger.error(f"Failed to initialize Redis on startup: {e}")

    # 3. Connect to MongoDB (optional — no-op if MONGODB_URI is unset)
    try:
        await init_mongo()
    except Exception as e:
        logger.error(f"Failed to initialize MongoDB on startup: {e}")

    yield

    # 4. Clean up connections on shutdown
    logger.info("Shutting down FastAPI application...")
    await close_redis()
    await close_mongo()

# Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan
)

# Set up CORS Middleware (React Dashboard connection).
# Explicit allowlist from CORS_ORIGINS env var (comma-separated), defaulting to
# local Vite dev. Never pair "*" with allow_credentials=True (browser blocks it
# and it defeats the point of credentialed requests).
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount public static assets directory (to serve PDF-extracted images to LINE/Web chat)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount Routers
app.include_router(webhooks.router)
app.include_router(documents.router)
app.include_router(bookings.router)
app.include_router(auth.router)
app.include_router(tenant.router)
app.include_router(chat.router)

@app.get("/")
async def root():
    """
    Health check root route.
    """
    return {
        "app": settings.PROJECT_NAME,
        "status": "running",
        "redis_connected": "connected" if os.getenv("REDIS_URL") else "missing",
        "mongodb_connected": is_mongo_connected()
    }
