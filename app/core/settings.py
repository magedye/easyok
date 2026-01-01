from __future__ import annotations

import re
from functools import lru_cache
from typing import Literal, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, ValidationInfo, field_validator


class Settings(BaseSettings):
    # =========================================================================
    # Environment & Identity
    # =========================================================================
    ENV: Literal["local", "ci", "production"] = "production"
    APP_ENV: Literal["development", "staging", "production"] = "production"
    APP_NAME: str = "EasyData"
    APP_VERSION: str = "16.7.x"
    DEBUG: bool = False

    # =========================================================================
    # Core Provider Selectors
    # =========================================================================
    DB_PROVIDER: Literal["oracle", "mssql"] = "oracle"
    LLM_PROVIDER: Literal["openai", "google", "ollama", "openai_compatible", "groq"] = "groq"
    VECTOR_DB: Literal["chromadb", "qdrant"] = "chromadb"

    # =========================================================================
    # Operation Tier (Single Switch)
    # =========================================================================
    OPERATION_TIER: Literal[
        "tier0_fortress",
        "tier1_governed",
        "tier2_vanna",
    ] = "tier1_governed"

    # =========================================================================
    # Security Toggles
    # =========================================================================
    AUTH_ENABLED: bool = True
    RBAC_ENABLED: bool = True
    RLS_ENABLED: bool = True
    ADMIN_LOCAL_BYPASS: bool = False

    # =========================================================================
    # Feature Toggles
    # =========================================================================
    ENABLE_LOGGING: bool = True
    ENABLE_AUDIT_LOGGING: bool = True
    ENABLE_RATE_LIMIT: bool = True
    ENABLE_GZIP_COMPRESSION: bool = True
    ENABLE_PERFORMANCE: bool = True
    ENABLE_TRAINING_PILOT: bool = False
    TRAINING_READINESS_ENFORCED: bool = True
    ENABLE_RAG_QUALITY: bool = False
    EASYDATA_ALLOW_LOCAL_NO_SCHEMA_POLICY: bool = False

    # =========================================================================
    # JWT Configuration
    # =========================================================================
    JWT_ALGORITHM: Literal["HS256", "RS256", "ES256"] = "HS256"
    JWT_SECRET_KEY: Optional[str] = None
    JWT_PUBLIC_KEY: Optional[str] = None
    JWT_JWKS_URL: Optional[str] = None
    JWT_EXPIRATION_MINUTES: int = 60
    JWT_ISSUER: Optional[str] = None
    JWT_AUDIENCE: Optional[str] = None
    JWT_HEADER_NAME: str = "Authorization"
    JWT_HEADER_PREFIX: str = "Bearer"

    # =========================================================================
    # RBAC & Authorization
    # =========================================================================
    RBAC_ROLES_CLAIM: str = "roles"
    RBAC_DEFAULT_ROLE: str = "viewer"
    RBAC_ADMIN_ROLE: str = "admin"

    # =========================================================================
    # Row Level Security (RLS)
    # =========================================================================
    RLS_SCOPE_CLAIM: str = "tenant_id"
    RLS_MISSING_SCOPE_BEHAVIOR: Literal["deny", "allow"] = "deny"

    # =========================================================================
    # User / Business Database
    # =========================================================================
    ORACLE_CONNECTION_STRING: Optional[str] = None
    MSSQL_CONNECTION_STRING: Optional[str] = None
    ORACLE_USER: Optional[str] = None
    ORACLE_PASSWORD: Optional[str] = None
    ORACLE_DSN: Optional[str] = None

    # =========================================================================
    # System Database
    # =========================================================================
    SYSTEM_DB_TYPE: Literal["sqlite", "postgres"] = "sqlite"
    SYSTEM_DB_PATH: str = "./data/logs.db"

    # =========================================================================
    # Vector Store
    # =========================================================================
    VECTOR_STORE_PATH: str = "./data/vectorstore"
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None

    # =========================================================================
    # Observability & Tracing
    # =========================================================================
    ENABLE_TELEMETRY: bool = True
    ANON_TELEMETRY: bool = True
    ENABLE_OTEL: bool = True
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None
    OTEL_SAMPLER_RATIO: float = 1.0
    OTEL_SERVICE_NAME: str = "easydata-backend"
    ENABLE_SIGNOZ_ALERTS: bool = False

    # =========================================================================
    # Sentry
    # =========================================================================
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = "production"
    SENTRY_TRACES_SAMPLE_RATE: float = 1.0
    SENTRY_ATTACH_STACKTRACE: bool = True
    SENTRY_ENABLE_OTEL_BRIDGE: bool = True
    SENTRY_API_TOKEN: Optional[str] = None
    SENTRY_ORG_SLUG: Optional[str] = None
    SENTRY_PROJECT_SLUG: Optional[str] = None

    # =========================================================================
    # LLM Providers
    # =========================================================================
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    OPENAI_TIMEOUT: int = 30

    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_MODEL: str = "gemini-1.5-pro"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_TIMEOUT: int = 30

    PHI3_BASE_URL: Optional[str] = None
    PHI3_MODEL: str = "phi-3"
    PHI3_API_KEY: Optional[str] = None
    PHI3_TIMEOUT: int = 30

    # =========================================================================
    # Shared LLM Controls
    # =========================================================================
    LLM_TEMPERATURE: float = Field(0.1, ge=0.0, le=1.0)
    LLM_MAX_TOKENS: int = 2048
    LLM_REQUEST_TIMEOUT: int = 60

    # =========================================================================
    # RAG / Vanna Controls
    # =========================================================================
    RAG_TOP_K: int = 5
    MAX_SQL_TOKENS: int = 2000
    VANNA_ALLOW_DDL: bool = False
    VANNA_MAX_ROWS: int = 500

    # =========================================================================
    # Tier 2 — Vanna Native Settings
    # =========================================================================
    VANNA_LLM_PROVIDER: Literal[
        "ollama",
        "openai",
        "openai_compatible",
        "google",
        "groq",
    ] = "ollama"
    VANNA_LLM_MODEL: str = "neural-chat"
    VANNA_LLM_ENDPOINT: Optional[str] = "http://localhost:11434"

    VANNA_SQLRUNNER_DIALECT: Literal[
        "oracle",
        "mssql",
        "postgres",
        "sqlite",
    ] = "postgres"
    VANNA_SQLRUNNER_CONNECTION: Optional[str] = None

    VANNA_MEMORY_TYPE: Literal[
        "in_memory",
        "postgres",
        "redis",
        "chroma",
    ] = "in_memory"

    VANNA_SYSTEM_PROMPT_TEMPLATE: str = (
        """
You are an expert data analyst assistant.

Rules:
- Always explain your reasoning
- Prefer explicit column names
- Limit results to 100 unless asked
- Use EXPLAIN for complex queries
"""
    ).strip()

    VANNA_DEFAULT_LIMIT: int = 100
    VANNA_MAX_EXECUTION_TIME: int = 30
    VANNA_RATE_LIMIT_REQUESTS: int = 100
    VANNA_RATE_LIMIT_WINDOW: int = 3600

    VANNA_ENABLE_FEEDBACK: bool = True
    VANNA_ENABLE_MEMORY: bool = True
    VANNA_ENABLE_RICH_OUTPUT: bool = True
    VANNA_ENABLE_CHARTS: bool = True
    VANNA_DRY_RUN_MODE: bool = False

    # =========================================================================
    # Governed Semantic Cache
    # =========================================================================
    ENABLE_SEMANTIC_CACHE: bool = False
    SEMANTIC_CACHE_SIMILARITY_THRESHOLD: float = 0.85
    SEMANTIC_CACHE_MAX_RESULTS: int = 3
    SEMANTIC_CACHE_TTL_SECONDS: int = 3600
    SEMANTIC_CACHE_GOVERNANCE_MODE: Literal["revalidate"] = "revalidate"
    SEMANTIC_CACHE_STORE_SQL: bool = True
    SEMANTIC_CACHE_STORE_RESULTS: bool = True
    REDIS_URL: Optional[str] = None

    # =========================================================================
    # Admin Feature Governance
    # =========================================================================
    ADMIN_FEATURE_TOGGLE_API_ENABLED: bool = True
    ADMIN_FEATURE_TOGGLE_REQUIRE_REASON: bool = True
    ADMIN_FEATURE_TOGGLE_EMIT_OTEL: bool = True

    # =========================================================================
    # Arabic NLP Pipeline
    # =========================================================================
    ENABLE_ARABIC_NLP: bool = True
    ENABLE_CAMEL_TOOLS: bool = True
    ENABLE_FARASA: bool = False
    FARASA_MODEL_PATH: Optional[str] = None
    ARABIC_EMBEDDING_MODEL: str = "CAMeL-Lab/bert-base-arabic-camelbert-da"
    ARABIC_PREPROCESS_BEFORE_RAG: bool = True

    # =========================================================================
    # RAG Quality Governance (RAGAS)
    # =========================================================================
    ENABLE_RAGAS_EVALUATION: bool = False
    RAGAS_METRICS: str = "context_precision,context_recall,faithfulness,answer_relevance"
    RAGAS_EXECUTION_MODE: Literal["async"] = "async"
    RAGAS_LINK_TO_AUDIT_LOG: bool = True

    # =========================================================================
    # Rate Limiting
    # =========================================================================
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    RATE_LIMIT_SCOPE: Literal["user", "ip", "global"] = "user"

    # =========================================================================
    # Health Checks
    # =========================================================================
    HEALTH_CHECK_ENABLED: bool = True
    HEALTH_CHECK_TIMEOUT: int = 5
    HEALTH_AGGREGATION_MODE: Literal["strict", "degraded"] = "degraded"

    # =========================================================================
    # API Server / Runtime Controls
    # =========================================================================
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: list[str] = Field(default_factory=list)
    STREAM_PROTOCOL: Literal["ndjson", "sse"] = "ndjson"
    DEFAULT_ROW_LIMIT: int = 100

    # =========================================================================
    # Sandbox / Shadow Execution
    # =========================================================================
    SANDBOX_DATA_STRATEGY: Literal["schema_only", "masked_snapshot", "synthetic_data"] = "schema_only"
    SANDBOX_SENSITIVE_COLUMNS: list[str] = Field(default_factory=list)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # =========================================================================
    # Validators & Normalization
    # =========================================================================

    @field_validator("ORACLE_CONNECTION_STRING")
    @classmethod
    def sanitise_oracle_connection_string(
        cls, v: Optional[str], info: ValidationInfo
    ) -> Optional[str]:
        if v is None:
            return None

        v_clean = str(v).strip()
        if not v_clean:
            return v_clean

        # Remove trailing markers/comments by taking the first token.
        v_clean = v_clean.split()[0]

        # Strip surrounding quotes.
        if (v_clean.startswith('"') and v_clean.endswith('"')) or (
            v_clean.startswith("'") and v_clean.endswith("'")
        ):
            v_clean = v_clean[1:-1]

        # Normalize URL-style DSN to oracledb.connect format:
        # oracle+oracledb://user:pw@host:port/service -> user/pw@host:port/service
        m = re.match(
            r"^(?:[a-zA-Z0-9_+\-]+://)?(?P<user>[^:]+):(?P<pw>[^@]+)@(?P<host>[^:/]+):(?P<port>\d+)[/\\](?P<service>.+)$",
            v_clean,
        )
        if m:
            return f"{m.group('user')}/{m.group('pw')}@{m.group('host')}:{m.group('port')}/{m.group('service')}"

        return v_clean

    def model_post_init(self, __context) -> None:
        """
        Tier-2 normalization (non-destructive).

        Applied ONLY when OPERATION_TIER == 'tier2_vanna'
        and ONLY if the user did not explicitly configure the value.
        """
        if self.OPERATION_TIER == "tier2_vanna":
            # If default limit is still the strict 100, remove it for Tier-2
            if self.VANNA_DEFAULT_LIMIT == 100:
                self.VANNA_DEFAULT_LIMIT = 0

            # If training readiness is enforced, disable it for Tier-2 productivity
            if self.TRAINING_READINESS_ENFORCED is True:
                self.TRAINING_READINESS_ENFORCED = False


@lru_cache
def get_settings(force_reload: bool = False) -> Settings:
    if force_reload:
        get_settings.cache_clear()
    return Settings()


settings = get_settings()