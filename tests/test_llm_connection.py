# -*- coding: utf-8 -*-
"""
LLM connectivity smoke test.

Reads configuration from .env and attempts a simple completion against the
selected provider. Skips automatically when LLM_PROVIDER is not one of the
supported targets for this test (openai_compatible, groq).
"""
import os
import pathlib
import sys

import pytest

# Ensure project root is on sys.path
ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load environment variables from .env if present
try:  # pragma: no cover - optional dependency
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:
    pass


def _get_llm_config():
    """Return LLM connection settings based on the selected provider."""
    provider = os.getenv("LLM_PROVIDER")

    if provider == "openai_compatible":
        return {
            "base_url": os.getenv("PHI3_BASE_URL"),
            "api_key": os.getenv("PHI3_API_KEY", "lm-studio"),  # default for local servers
            "model": os.getenv("PHI3_MODEL"),
            "timeout": float(os.getenv("PHI3_TIMEOUT", 30)),
        }

    if provider == "groq":
        return {
            "base_url": os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
            "api_key": os.getenv("GROQ_API_KEY"),
            "model": os.getenv("GROQ_MODEL"),
            "timeout": float(os.getenv("GROQ_TIMEOUT", 30)),
        }

    return None


@pytest.mark.skipif(
    os.getenv("LLM_PROVIDER") not in ["openai_compatible", "groq"],
    reason="LLM_PROVIDER is not set to a supported test provider",
)
def test_llm_connectivity():
    """Send a simple prompt to verify the LLM endpoint responds."""
    pytest.importorskip("openai", reason="OpenAI SDK not installed")
    from openai import OpenAI

    config = _get_llm_config()
    if not config or not config["base_url"] or not config["model"]:
        pytest.fail("Missing configuration for the selected LLM provider")

    client = OpenAI(
        base_url=config["base_url"],
        api_key=config["api_key"],
        timeout=config["timeout"],
    )

    try:
        response = client.chat.completions.create(
            model=config["model"],
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Reply with only the word: Connected."},
            ],
            max_tokens=10,
            temperature=0.1,
        )

        content = response.choices[0].message.content.strip()
        assert content, "Empty response from LLM"
    except Exception as exc:
        pytest.fail(f"LLM connection failed: {exc}")
