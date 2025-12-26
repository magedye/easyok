from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # -------------------------------------------------
    # Application
    # -------------------------------------------------
    APP_NAME: str = "EasyData"
    APP_VERSION: str = "16.0.0"
    DEBUG: bool = False

    # -------------------------------------------------
    # Security Toggles (CRITICAL)
    # -------------------------------------------------
    AUTH_ENABLED: bool = True
    RBAC_ENABLED: bool = True
    RLS_ENABLED: bool = True

    # -------------------------------------------------
    # JWT Configuration (SSOT)
    # -------------------------------------------------
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

def get_settings() -> Settings:
    return settings
