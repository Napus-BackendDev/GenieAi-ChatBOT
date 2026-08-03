import os
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "GenieAI RAG Chatbot"
    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    
    # API credentials
    OPENAI_API_KEY: str
    LINE_CHANNEL_ACCESS_TOKEN: str
    LINE_CHANNEL_SECRET: str
    
    # Database / cache URLs
    REDIS_URL: str

    # Auth / JWT. JWT_SECRET MUST be set in .env for production; a blank value
    # falls back to a dev-only key (with a startup warning) so local runs work.
    JWT_SECRET: str = ""
    WEBCHAT_JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7
    SESSION_COOKIE_NAME: str = "genieai_session"
    SESSION_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    EXPOSE_ACCESS_TOKEN: bool = True

    # Google Sign-In: audience check for ID tokens. Blank = Google login disabled.
    GOOGLE_CLIENT_ID: str = ""

    # Dev-only: allow the tokenless "mock" Google login. MUST stay False in any
    # shared/production deploy — when True, anyone can log in as the mock tenant.
    ALLOW_MOCK_LOGIN: bool = False
    ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS: bool = True
    ALLOW_LOCAL_DATA_FALLBACK: bool = True

    # MongoDB (optional; migration in progress). Leave MONGODB_URI blank to keep
    # using local JSON storage. Set it (in .env) to enable the MongoDB connection.
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "genieai"

    # Storage settings (paths relative to project root backend/)
    CHROMA_DB_PATH: str = "data/chroma"
    DOCUMENTS_JSON_PATH: str = "data/documents.json"
    BOOKINGS_JSON_PATH: str = "data/bookings.json"
    STATIC_IMAGES_PATH: str = "static/images"
    MAX_UPLOAD_BYTES: int = 15 * 1024 * 1024
    MAX_IMAGE_UPLOAD_BYTES: int = 5 * 1024 * 1024
    MAX_PDF_PAGES: int = 100
    MAX_PDF_PAGE_AREA: int = 5_000_000

    CORS_ORIGINS: str = "http://localhost:5173"
    TRUSTED_HOSTS: str = "localhost,127.0.0.1,testserver,test"
    TRUST_PROXY_HEADERS: bool = False
    TRUSTED_PROXY_NETWORKS: str = (
        "127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
    )
    LOG_LEVEL: str = "INFO"
    PORT: int = 8000

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [value.strip() for value in self.CORS_ORIGINS.split(",") if value.strip()]

    @property
    def trusted_hosts(self) -> list[str]:
        return [value.strip() for value in self.TRUSTED_HOSTS.split(",") if value.strip()]

    @property
    def trusted_proxy_networks(self) -> list[str]:
        return [
            value.strip()
            for value in self.TRUSTED_PROXY_NETWORKS.split(",")
            if value.strip()
        ]

    def validate_runtime(self) -> None:
        """Fail closed when a production deployment is configured unsafely."""
        if not self.is_production:
            return

        errors = []
        if len(self.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must contain at least 32 characters")
        if len(self.WEBCHAT_JWT_SECRET) < 32:
            errors.append("WEBCHAT_JWT_SECRET must contain at least 32 characters")
        if self.JWT_SECRET and self.JWT_SECRET == self.WEBCHAT_JWT_SECRET:
            errors.append("JWT_SECRET and WEBCHAT_JWT_SECRET must be different")
        if not self.MONGODB_URI:
            errors.append("MONGODB_URI is required")
        if self.ALLOW_MOCK_LOGIN:
            errors.append("ALLOW_MOCK_LOGIN must be false")
        if self.ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS:
            errors.append("ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS must be false")
        if self.ALLOW_LOCAL_DATA_FALLBACK:
            errors.append("ALLOW_LOCAL_DATA_FALLBACK must be false")
        if self.EXPOSE_ACCESS_TOKEN:
            errors.append("EXPOSE_ACCESS_TOKEN must be false")
        if self.SESSION_COOKIE_SAMESITE == "none":
            errors.append("SESSION_COOKIE_SAMESITE must be lax or strict")
        if not self.cors_origins:
            errors.append("CORS_ORIGINS must contain at least one HTTPS origin")
        for origin in self.cors_origins:
            if origin == "*" or not origin.startswith("https://"):
                errors.append("CORS_ORIGINS must contain only explicit HTTPS origins")
                break
        if not self.trusted_hosts or "*" in self.trusted_hosts:
            errors.append("TRUSTED_HOSTS must contain explicit hostnames")
        if self.TRUST_PROXY_HEADERS and not self.trusted_proxy_networks:
            errors.append("TRUSTED_PROXY_NETWORKS is required when proxy headers are trusted")

        if errors:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(errors))

    # Pydantic configuration to read from .env file
    # We look for .env in the parent directory of this core folder (which is backend/)
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
