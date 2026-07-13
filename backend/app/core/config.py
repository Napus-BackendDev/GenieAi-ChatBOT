import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "GenieAI RAG Chatbot"
    
    # API credentials
    OPENAI_API_KEY: str
    LINE_CHANNEL_ACCESS_TOKEN: str
    LINE_CHANNEL_SECRET: str
    
    # Database / cache URLs
    REDIS_URL: str

    # Auth / JWT. JWT_SECRET MUST be set in .env for production; a blank value
    # falls back to a dev-only key (with a startup warning) so local runs work.
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # MongoDB (optional; migration in progress). Leave MONGODB_URI blank to keep
    # using local JSON storage. Set it (in .env) to enable the MongoDB connection.
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "genieai"

    # Storage settings (paths relative to project root backend/)
    CHROMA_DB_PATH: str = "data/chroma"
    DOCUMENTS_JSON_PATH: str = "data/documents.json"
    BOOKINGS_JSON_PATH: str = "data/bookings.json"
    STATIC_IMAGES_PATH: str = "static/images"
    
    PORT: int = 8000

    # Pydantic configuration to read from .env file
    # We look for .env in the parent directory of this core folder (which is backend/)
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
