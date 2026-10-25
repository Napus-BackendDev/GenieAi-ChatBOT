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
    CSRF_COOKIE_NAME: str = "genieai_csrf"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"
    CSRF_ENFORCEMENT: Literal["report", "enforce"] = "enforce"
    SESSION_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    EXPOSE_ACCESS_TOKEN: bool = True

    # Google Sign-In: audience check for ID tokens. Blank = Google login disabled.
    GOOGLE_CLIENT_ID: str = ""

    # Dev-only: allow the tokenless "mock" Google login. MUST stay False in any
    # shared/production deploy — when True, anyone can log in as the mock tenant.
    ALLOW_MOCK_LOGIN: bool = False
    ALLOW_LEGACY_SINGLE_TENANT_WEBHOOKS: bool = True
    ALLOW_LOCAL_DATA_FALLBACK: bool = True

    # AI is enabled by default, but every provider call must reserve against
    # these hard token/request budgets first. Production fails closed when a
    # budget cannot be measured.
    AI_PROVIDER: Literal["disabled", "openai", "mock"] = "openai"
    AI_GLOBAL_DAILY_TOKEN_CAP: int = 1_000_000
    AI_TENANT_DAILY_TOKEN_CAP: int = 100_000
    AI_TENANT_DAILY_REQUEST_CAP: int = 500
    AI_MAX_OUTPUT_TOKENS: int = 600
    AI_MAX_OCR_OUTPUT_TOKENS_PER_PAGE: int = 2_000
    AI_MAX_EMBEDDING_INPUT_TOKENS: int = 8_000
    AI_MAX_TOOL_ITERATIONS: int = 6
    AI_ALLOWED_MODELS: str = "gpt-4o-mini,text-embedding-3-small"

    # Retention is explicit and bounded so a tenant cannot accidentally retain
    # unbounded conversation documents.
    CONVERSATION_RETENTION_DAYS: int = 90
    MIN_CONVERSATION_RETENTION_DAYS: int = 7
    MAX_CONVERSATION_RETENTION_DAYS: int = 365
    DEFAULT_TENANT_TIMEZONE: str = "Asia/Bangkok"
    WEBHOOK_WORKER_ENABLED: bool = True
    DELETION_WORKER_ENABLED: bool = True

    # MongoDB (optional; migration in progress). Leave MONGODB_URI blank to keep
    # using local JSON storage. Set it (in .env) to enable the MongoDB connection.
    MONGODB_URI: str = ""
    MONGODB_DB_NAME: str = "genieai"

    # Storage settings (paths relative to project root backend/)
    CHROMA_DB_PATH: str = "data/chroma"
    VECTOR_STORE: Literal["mongo", "chroma"] = "mongo"
    VECTOR_SHADOW_READ: bool = False
    MAX_KNOWLEDGE_CHUNKS_PER_TENANT: int = 2_000
    DOCUMENTS_JSON_PATH: str = "data/documents.json"
    BOOKINGS_JSON_PATH: str = "data/bookings.json"
    DELETION_JOBS_JSON_PATH: str = "data/deletion_jobs.json"
    STATIC_IMAGES_PATH: str = "static/images"
    MEDIA_STORAGE: Literal["gridfs", "filesystem"] = "gridfs"
    MAX_UPLOAD_BYTES: int = 15 * 1024 * 1024
    MAX_IMAGE_UPLOAD_BYTES: int = 5 * 1024 * 1024
    MAX_PDF_PAGES: int = 100
    MAX_PDF_PAGE_AREA: int = 5_000_000

    CORS_ORIGINS: str = "http://localhost:5173"
    TRUSTED_HOSTS: str = "localhost,127.0.0.1,testserver,test"
    RENDER_EXTERNAL_HOSTNAME: str = ""
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
        hosts = [value.strip() for value in self.TRUSTED_HOSTS.split(",") if value.strip()]
        render_host = self.RENDER_EXTERNAL_HOSTNAME.strip()
        if render_host and render_host not in hosts:
            hosts.append(render_host)
        return hosts

    @property
    def trusted_proxy_networks(self) -> list[str]:
        return [
            value.strip()
            for value in self.TRUSTED_PROXY_NETWORKS.split(",")
            if value.strip()
        ]

    def validate_runtime(self) -> None:
        """Fail closed when a production deployment is configured unsafely."""
        is_render = bool(
            os.getenv("RENDER")
            or os.getenv("RENDER_SERVICE_ID")
            or os.getenv("RENDER_INSTANCE_ID")
            or self.RENDER_EXTERNAL_HOSTNAME.strip()
        )
        if is_render and not self.is_production:
            raise RuntimeError("RENDER_NON_PRODUCTION_ENVIRONMENT: Application running on Render must set ENVIRONMENT=production")

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
        if self.AI_PROVIDER == "mock":
            errors.append("AI_PROVIDER must not be mock in production")
        if self.AI_PROVIDER == "openai" and not self.OPENAI_API_KEY:
            errors.append("OPENAI_API_KEY is required when AI_PROVIDER is openai")
        if self.AI_GLOBAL_DAILY_TOKEN_CAP <= 0:
            errors.append("AI_GLOBAL_DAILY_TOKEN_CAP must be positive")
        if self.AI_TENANT_DAILY_TOKEN_CAP <= 0:
            errors.append("AI_TENANT_DAILY_TOKEN_CAP must be positive")
        if self.AI_TENANT_DAILY_REQUEST_CAP <= 0:
            errors.append("AI_TENANT_DAILY_REQUEST_CAP must be positive")
        if self.AI_MAX_OUTPUT_TOKENS <= 0 or self.AI_MAX_TOOL_ITERATIONS <= 0:
            errors.append("AI output and tool iteration caps must be positive")
        if self.MAX_KNOWLEDGE_CHUNKS_PER_TENANT <= 0:
            errors.append("MAX_KNOWLEDGE_CHUNKS_PER_TENANT must be positive")
        if self.VECTOR_STORE != "mongo":
            errors.append("VECTOR_STORE must be mongo in production")
        if self.MEDIA_STORAGE != "gridfs":
            errors.append("MEDIA_STORAGE must be gridfs in production")
        if not (7 <= self.MIN_CONVERSATION_RETENTION_DAYS <= self.CONVERSATION_RETENTION_DAYS <= self.MAX_CONVERSATION_RETENTION_DAYS <= 365):
            errors.append("Conversation retention must be within 7..365 days")
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
