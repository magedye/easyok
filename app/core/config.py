"""
EasyData Configuration
======================

This module loads and validates ALL environment variables using Pydantic v2.
It is the SINGLE source of truth for application settings.

Requirements:
    pip install pydantic-settings
"""

from functools import lru_cache
from typing import Literal, Optional, Any

from pydantic import Field, field_validator, ValidationInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # =========================================================================
    # Application
    # =========================================================================
    APP_NAME: str = "EasyData"
    APP_VERSION: str = "16.0.0"
    APP_ENV: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # =========================================================================
    # Core Provider Selectors (SSOT)
    # =========================================================================
    DB_PROVIDER: Literal["oracle", "mssql"]
    LLM_PROVIDER: Literal[
        "openai",
        "google",
        "ollama",
        "openai_compatible",
        "groq",
    ]
    VECTOR_DB: Literal["chromadb", "qdrant"]

    # =========================================================================
    # Security Toggles
    # =========================================================================
    AUTH_ENABLED: bool = True
    RBAC_ENABLED: bool = True
    RLS_ENABLED: bool = True

    # =========================================================================
    # Feature Toggles
    # =========================================================================
    ENABLE_LOGGING: bool = True
    ENABLE_AUDIT_LOGGING: bool = True
    ENABLE_RATE_LIMIT: bool = False
    ENABLE_GZIP_COMPRESSION: bool = True
    ENABLE_PERFORMANCE: bool = True
    # CORS configuration to allow frontend origin
    CORS_ORIGINS: list = ['http://localhost:3000']  # Assuming frontend runs at localhost:3000
    BACKEND_PORT: int = 8000  # Ensuring backend runs on port 8000

    # =========================================================================
    # JWT (Validation Only – External Identity)
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
    # Authorization / RBAC
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
    # Databases
    # =========================================================================
    ORACLE_CONNECTION_STRING: Optional[str] = None
    MSSQL_CONNECTION_STRING: Optional[str] = None

    SYSTEM_DB_TYPE: Literal["sqlite", "postgres"] = "sqlite"
    SYSTEM_DB_PATH: str = "./data/logs.db"

    # =========================================================================
    # Vector Store
    # =========================================================================
    VECTOR_STORE_PATH: str = "./data/vectorstore"
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None

    # =========================================================================
    # LLM Providers
    # =========================================================================
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TIMEOUT: int = 30

    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_MODEL: str = "gemini-1.5-pro"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    PHI3_BASE_URL: str = "http://localhost:1234/v1"
    PHI3_MODEL: str = "phi-3"
    PHI3_API_KEY: Optional[str] = None
    PHI3_TIMEOUT: int = 30

    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    GROQ_TIMEOUT: int = 30

    # =========================================================================
    # Shared LLM Controls (Deterministic Mode)
    # =========================================================================
    LLM_TEMPERATURE: float = Field(0.1, ge=0.0, le=1.0)
    LLM_MAX_TOKENS: int = 2048
    LLM_REQUEST_TIMEOUT: int = 60

    # =========================================================================
    # RAG / Vanna
    # =========================================================================
    RAG_TOP_K: int = 5
    MAX_SQL_TOKENS: int = 2000
    VANNA_ALLOW_DDL: bool = False
    VANNA_MAX_ROWS: int = 500

    # =========================================================================
    # Rate Limiting & Health
    # =========================================================================
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    RATE_LIMIT_SCOPE: Literal["user", "ip", "global"] = "user"

    HEALTH_CHECK_ENABLED: bool = True
    HEALTH_CHECK_TIMEOUT: int = 5
    HEALTH_AGGREGATION_MODE: Literal["strict", "degraded"] = "degraded"

    # =========================================================================
    # Pydantic Settings Configuration
    # =========================================================================
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # =========================================================================
    # Validators (Fail-Fast Logic)
    # =========================================================================

    @field_validator("RBAC_ENABLED", "RLS_ENABLED", mode="after")
    @classmethod
    def force_disable_if_no_auth(cls, v: Any, info: ValidationInfo) -> bool:
        """
        If AUTH_ENABLED is False, RBAC and RLS must be disabled
        regardless of their explicit values.
        """
        if not info.data.get("AUTH_ENABLED", True):
            return False
        return v

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_jwt_secret(
        cls, v: Optional[str], info: ValidationInfo
    ) -> Optional[str]:
        """
        JWT_SECRET_KEY is required only when:
        - AUTH_ENABLED is True
        - JWT_ALGORITHM is HS256
        """
        if not info.data.get("AUTH_ENABLED", True):
            return None

        if info.data.get("JWT_ALGORITHM") == "HS256" and not v:
            raise ValueError(
                "JWT_SECRET_KEY is required when AUTH_ENABLED is true "
                "and JWT_ALGORITHM is HS256"
            )
        return v

    @field_validator("ORACLE_CONNECTION_STRING")
    @classmethod
    def validate_oracle_conn(
        cls, v: Optional[str], info: ValidationInfo
    ) -> Optional[str]:
        """Validate and sanitize ORACLE_CONNECTION_STRING.

        - When DB_PROVIDER is 'oracle', the value must be present.
        - Trim surrounding whitespace and strip any trailing comments or markers
          (e.g., '>>> CHANGE ME <<<') by taking the first token before whitespace.
        """
        if info.data.get("DB_PROVIDER") == "oracle" and not v:
            raise ValueError(
                "ORACLE_CONNECTION_STRING is mandatory when DB_PROVIDER is 'oracle'"
            )

        if v:
            # Remove surrounding whitespace and trim anything after the first whitespace
            v_clean = str(v).strip().split()[0]
            # Remove surrounding quotes if present
            if (v_clean.startswith('"') and v_clean.endswith('"')) or (
                v_clean.startswith("'") and v_clean.endswith("'")
            ):
                v_clean = v_clean[1:-1]

            # Normalize common URL-style connection strings to a format accepted by oracledb.connect
            # e.g. oracle+oracledb://user:pw@host:port/service --> user/pw@host:port/service
            try:
                import re

                pattern = re.compile(
                    r"(?:(?:[a-zA-Z0-9_+\-]+)://)?"  # optional scheme
                    r"(?P<user>[^:]+):(?P<pw>[^@]+)@"
                    r"(?P<host>[^:/]+):(?P<port>\d+)[/\\](?P<service>\S+)"
                )
                m = pattern.search(v_clean)
                if m:
                    user = m.group("user")
                    pw = m.group("pw")
                    host = m.group("host")
                    port = m.group("port")
                    service = m.group("service")
                    return f"{user}/{pw}@{host}:{port}/{service}"
            except Exception:
                # If parsing fails, fall back to the cleaned token
                pass

            return v_clean

        return v

    @field_validator("MSSQL_CONNECTION_STRING")
    @classmethod
    def validate_mssql_conn(
        cls, v: Optional[str], info: ValidationInfo
    ) -> Optional[str]:
        if info.data.get("DB_PROVIDER") == "mssql" and not v:
            raise ValueError(
                "MSSQL_CONNECTION_STRING is mandatory when DB_PROVIDER is 'mssql'"
            )
        return v


_settings_cache: Optional[Settings] = None


def get_settings(force_reload: bool = False) -> Settings:
    """
    Access application settings. Set force_reload=True to re-read environment
    variables (useful in tests when monkeypatching os.environ).
    """
    global _settings_cache
    if force_reload or _settings_cache is None:
        _settings_cache = Settings()
    return _settings_cache


# Global settings instance (legacy alias; prefer get_settings() to allow refresh)
settings = get_settings()
