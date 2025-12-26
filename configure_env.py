import os
from typing import Dict, List, Optional

# ============================================================================
# Constants
# ============================================================================

CHANGE_MARKER = ">>> CHANGE ME <<<"

CHOICE_VARIABLES = {
    "APP_ENV": ["development", "staging", "production"],
    "DB_PROVIDER": ["oracle", "mssql"],
    "LLM_PROVIDER": ["openai", "google", "ollama", "openai_compatible", "groq"],
    "VECTOR_DB": ["chromadb", "qdrant"],
    "AUTH_ENABLED": ["true", "false"],
    "RBAC_ENABLED": ["true", "false"],
    "RLS_ENABLED": ["true", "false"],
}

CORE_SELECTOR_KEYS = [
    "APP_ENV",
    "AUTH_ENABLED",
    "RBAC_ENABLED",
    "RLS_ENABLED",
    "DB_PROVIDER",
    "LLM_PROVIDER",
    "VECTOR_DB",
]

DB_PROVIDER_VARIABLES = {
    "oracle": [
        "ORACLE_CONNECTION_STRING",
    ],
    "mssql": [
        "MSSQL_CONNECTION_STRING",
    ],
}

LLM_PROVIDER_VARIABLES = {
    "openai": [
        "OPENAI_API_KEY",
        "OPENAI_MODEL",
        "OPENAI_TIMEOUT",
    ],
    "google": [
        "GOOGLE_API_KEY",
        "GOOGLE_MODEL",
    ],
    "ollama": [
        "OLLAMA_BASE_URL",
        "OLLAMA_MODEL",
    ],
    "openai_compatible": [
        "PHI3_BASE_URL",
        "PHI3_MODEL",
        "PHI3_API_KEY",
        "PHI3_TIMEOUT",
    ],
    "groq": [
        "GROQ_API_KEY",
        "GROQ_MODEL",
        "GROQ_TIMEOUT",
    ],
}

ALWAYS_PROMPT_IF_PRESENT = {
    "JWT_SECRET_KEY",
}

# ============================================================================
# Helpers
# ============================================================================

def read_lines(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as f:
        return f.readlines()


def parse_env_values(path: str) -> Dict[str, str]:
    values = {}
    if not os.path.exists(path):
        return values

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def extract_marked_keys(example_path: str) -> List[str]:
    keys = set()
    with open(example_path, "r", encoding="utf-8") as f:
        for line in f:
            if CHANGE_MARKER in line and "=" in line:
                key = line.split("=", 1)[0].strip()
                keys.add(key)
    return sorted(keys)


def prompt_with_choices(
    key: str,
    current_value: str,
    choices: Optional[List[str]] = None,
) -> str:
    print(f"\nVariable: {key}")
    print(f"Current value: {current_value or '<empty>'}")

    if choices:
        print("Available options:")
        for i, opt in enumerate(choices, start=1):
            print(f"  {i}) {opt}")

        user_input = input(
            "Select option number, type value directly, or press Enter to keep current: "
        ).strip()

        if not user_input:
            return current_value

        if user_input.isdigit():
            idx = int(user_input) - 1
            if 0 <= idx < len(choices):
                return choices[idx]
            print("Invalid option. Keeping current value.")
            return current_value

        if user_input in choices:
            return user_input

        print("Invalid value. Keeping current value.")
        return current_value

    user_input = input(
        "Press Enter to keep current value, or type new value: "
    ).strip()
    return user_input if user_input else current_value


# ============================================================================
# Main
# ============================================================================

def configure_env(
    example_path: str = ".env.example",
    env_path: str = ".env",
):
    if not os.path.exists(example_path):
        print(f"ERROR: Reference file '{example_path}' not found.")
        return

    if not os.path.exists(env_path):
        print(f"ERROR: Target file '{env_path}' not found.")
        return

    example_marked_keys = set(extract_marked_keys(example_path))
    env_lines = read_lines(env_path)
    current_values = parse_env_values(env_path)
    updates: Dict[str, str] = {}

    print("\nEasyData Interactive Environment Configuration")
    print("=" * 60)
    print("Only relevant variables will be shown.")
    print("Press Enter to keep the current value.\n")

    # ----------------------------------------------------------------------
    # Phase 1: Core selectors
    # ----------------------------------------------------------------------
    for key in CORE_SELECTOR_KEYS:
        if key not in current_values:
            continue

        current_value = current_values.get(key, "")
        new_value = prompt_with_choices(
            key,
            current_value,
            CHOICE_VARIABLES.get(key),
        )

        if new_value != current_value:
            updates[key] = new_value
            current_values[key] = new_value  # update session state

    # ----------------------------------------------------------------------
    # Phase 2: DB provider-specific variables
    # ----------------------------------------------------------------------
    db_provider = current_values.get("DB_PROVIDER")
    for key in DB_PROVIDER_VARIABLES.get(db_provider, []):
        current_value = current_values.get(key, "")
        new_value = prompt_with_choices(key, current_value)
        if new_value != current_value:
            updates[key] = new_value

    # ----------------------------------------------------------------------
    # Phase 3: LLM provider-specific variables
    # ----------------------------------------------------------------------
    llm_provider = current_values.get("LLM_PROVIDER")
    for key in LLM_PROVIDER_VARIABLES.get(llm_provider, []):
        current_value = current_values.get(key, "")
        new_value = prompt_with_choices(key, current_value)
        if new_value != current_value:
            updates[key] = new_value

    # ----------------------------------------------------------------------
    # Phase 4: Always-prompt sensitive keys (if present)
    # ----------------------------------------------------------------------
    for key in ALWAYS_PROMPT_IF_PRESENT:
        if key not in current_values:
            continue
        current_value = current_values.get(key, "")
        new_value = prompt_with_choices(key, current_value)
        if new_value != current_value:
            updates[key] = new_value

    if not updates:
        print("\nNo changes were made.")
        return

    # ----------------------------------------------------------------------
    # Apply updates (format-safe)
    # ----------------------------------------------------------------------
    with open(env_path, "w", encoding="utf-8") as f:
        for line in env_lines:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key = stripped.split("=", 1)[0].strip()
                if key in updates:
                    prefix = line.split("=", 1)[0]
                    f.write(f"{prefix}={updates[key]}\n")
                    continue
            f.write(line)

    print("\nSUCCESS: .env updated safely.")
    print("Modified variables:")
    for k in updates:
        print(f" - {k}")


if __name__ == "__main__":
    configure_env()

