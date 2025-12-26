"""
Application configuration module.

This module defines the Settings class which reads configuration from
environment variables via Pydantic.  It centralises all tunable
parameters and ensures a single source of truth for the application.

To change a configuration value, edit the `.env` file at the project
root.  Do not hard‑code any configuration in other modules.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Literal


class Settings(BaseSettings):
    # --------------------
    # LLM Selector
    # --------------------
    LLM_PROVIDER: Literal[
            "openai",
            "google",
            "ollama",
            "phi3",
            "groq",
        ] = "openai"
    
        # --------------------
        # Shared LLM Settings
        # --------------------
        LLM_TEMPERATURE: float = 0.2
        LLM_MAX_TOKENS: int = 2048
    
        # --------------------
        # PHI-3 (OpenAI-compatible)
        # --------------------
        PHI3_API_KEY: str | None = None
        PHI3_MODEL: str = "phi-3"
        PHI3_BASE_URL: str | None = None
    
        # --------------------
        # GROQ
        # --------------------
        GROQ_API_KEY: str | None = None
        GROQ_MODEL: str = "llama-3.1-8b-instant"
    
        class Config:
            env_file = ".env"


settings = Settings()