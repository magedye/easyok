#!/usr/bin/env python3
"""
easydata_preflight_env.py
=========================

EasyData v16.7 – Environment Preflight Governance Tool

Authority
---------
This tool is a GOVERNANCE GATE.

If this tool fails:
- EasyData MUST NOT start
- CI/CD MUST fail
- Deployment MUST stop

It enforces EasyData-Env-Contract-v16.7.

Behavior
--------
1. Synchronizes `.env` with `.env.example` (template-governed)
2. Preserves legacy variables (non-destructive)
3. Creates backup + audit report
4. Performs HARD governance validation
5. Exits with non-zero code on any violation

No runtime logic.
No provider loading.
No inference.
"""

import os
import sys
from datetime import datetime
from typing import Dict, List


# ============================================================================
# Contract Constants (v16.7)
# ============================================================================

IMMUTABLE_KEYS = {
    "APP_ENV",
    "DB_PROVIDER",
    "LLM_PROVIDER",
    "VECTOR_DB",
    "AUTH_ENABLED",
    "RBAC_ENABLED",
    "RLS_ENABLED",
}

PRODUCTION_FORBIDDEN = {
    "DEBUG": "true",
}

PROVIDER_REQUIRED_VARS = {
    "oracle": ["ORACLE_CONNECTION_STRING"],
    "mssql": ["MSSQL_CONNECTION_STRING"],
}

LLM_REQUIRED_VARS = {
    "openai": ["OPENAI_API_KEY"],
    "google": ["GOOGLE_API_KEY"],
    "ollama": ["OLLAMA_BASE_URL"],
    "openai_compatible": ["PHI3_BASE_URL"],
    "groq": ["GROQ_API_KEY"],
}

CHANGE_MARKER = ">>> CHANGE ME <<<"


# ============================================================================
# Utilities
# ============================================================================

def backup_env_file(env_path: str) -> str:
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup = f"{env_path}.backup.{ts}"
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as src:
            with open(backup, "w", encoding="utf-8") as dst:
                dst.write(src.read())
    return backup


def parse_env(path: str) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not os.path.exists(path):
        return values
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if s and not s.startswith("#") and "=" in s:
                k, v = s.split("=", 1)
                values[k.strip()] = v.strip()
    return values


def sync_from_template(example_path: str, env_path: str) -> Dict[str, List[str]]:
    current = parse_env(env_path)
    processed = set()
    new_lines: List[str] = []

    added, reused, legacy = [], [], []

    with open(example_path, "r", encoding="utf-8") as tpl:
        for line in tpl:
            raw = line.rstrip("\n")
            s = raw.strip()
            if s and not s.startswith("#") and "=" in s:
                key, _ = s.split("=", 1)
                key = key.strip()
                processed.add(key)
                if key in current:
                    new_lines.append(f"{key}={current[key]}")
                    reused.append(key)
                else:
                    new_lines.append(raw)
                    added.append(key)
            else:
                new_lines.append(raw)

    legacy = [k for k in current if k not in processed]
    if legacy:
        new_lines.append("")
        new_lines.append("# ============================================================================")
        new_lines.append("# CUSTOM / LEGACY VARIABLES (Not governed by template)")
        new_lines.append("# ============================================================================")
        for k in sorted(legacy):
            new_lines.append(f"{k}={current[k]}")

    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines) + "\n")

    return {
        "added": added,
        "reused": reused,
        "legacy": legacy,
    }


# ============================================================================
# Governance Validation
# ============================================================================

def validate_env(values: Dict[str, str], template_text: str) -> List[str]:
    errors: List[str] = []

    app_env = values.get("APP_ENV", "").lower()

    # Production safety
    if app_env == "production":
        for k, bad in PRODUCTION_FORBIDDEN.items():
            if values.get(k, "").lower() == bad:
                errors.append(f"Production violation: {k} must not be '{bad}'")

    # AUTH → RBAC/RLS coupling
    if values.get("AUTH_ENABLED", "false") == "false":
        if values.get("RBAC_ENABLED") == "true":
            errors.append("RBAC_ENABLED=true while AUTH_ENABLED=false")
        if values.get("RLS_ENABLED") == "true":
            errors.append("RLS_ENABLED=true while AUTH_ENABLED=false")

    # DB provider requirements
    db = values.get("DB_PROVIDER")
    if db in PROVIDER_REQUIRED_VARS:
        for req in PROVIDER_REQUIRED_VARS[db]:
            if not values.get(req):
                errors.append(f"Missing required DB variable: {req}")

    # LLM provider requirements
    llm = values.get("LLM_PROVIDER")
    if llm in LLM_REQUIRED_VARS:
        for req in LLM_REQUIRED_VARS[llm]:
            if not values.get(req):
                errors.append(f"Missing required LLM variable: {req}")

    # CHANGE ME markers must not survive in .env
    if CHANGE_MARKER in template_text:
        for k, v in values.items():
            if CHANGE_MARKER in v:
                errors.append(f"Unresolved CHANGE ME marker in variable: {k}")

    return errors


# ============================================================================
# Main Preflight
# ============================================================================

def main(
    example_path: str = ".env.example",
    env_path: str = ".env",
    report_path: str = "env_preflight_report.txt",
) -> None:

    if not os.path.exists(example_path):
        print(f"FATAL: Missing template {example_path}")
        sys.exit(1)

    if not os.path.exists(env_path):
        print(f"FATAL: Missing env file {env_path}")
        sys.exit(1)

    with open(example_path, "r", encoding="utf-8") as f:
        template_text = f.read()

    backup = backup_env_file(env_path)
    sync_info = sync_from_template(example_path, env_path)
    values = parse_env(env_path)

    violations = validate_env(values, template_text)

    with open(report_path, "w", encoding="utf-8") as r:
        r.write("EASYDATA ENV PREFLIGHT REPORT\n")
        r.write("=" * 60 + "\n")
        r.write(f"Timestamp      : {datetime.utcnow().isoformat()}Z\n")
        r.write(f"Backup         : {backup}\n\n")

        r.write("Synchronization:\n")
        for k in sync_info["added"]:
            r.write(f"  + Added    : {k}\n")
        for k in sync_info["reused"]:
            r.write(f"  = Reused   : {k}\n")
        for k in sync_info["legacy"]:
            r.write(f"  * Legacy   : {k}\n")

        r.write("\nGovernance Validation:\n")
        if violations:
            for v in violations:
                r.write(f"  ❌ {v}\n")
        else:
            r.write("  ✅ No violations detected\n")

    if violations:
        print("❌ ENV PREFLIGHT FAILED")
        print(f"See report: {report_path}")
        sys.exit(1)

    print("✅ ENV PREFLIGHT PASSED")
    print(f"- Backup : {backup}")
    print(f"- Report : {report_path}")
    sys.exit(0)


if __name__ == "__main__":
    main()
