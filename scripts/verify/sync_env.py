import os
from datetime import datetime
from typing import Dict, List

"""
EasyData Environment Template Synchronizer
==========================================

Purpose
-------
Synchronize an existing `.env` file against `.env.example`
as a *strict, authoritative template*.

This tool is designed for:
- Preflight governance
- Configuration drift control
- Safe reconciliation before deployment

Core Guarantees
---------------
- `.env.example` defines the canonical structure
- Existing local values are preserved where applicable
- Unknown / legacy variables are NOT deleted
- All changes are backed up and auditable
- No execution, validation, or inference is performed

This tool MAY rewrite `.env`.
This tool MUST be run before application startup.
"""


# ============================================================================
# Backup Utilities
# ============================================================================

def backup_env_file(env_path: str) -> str:
    """
    Create a timestamped backup of the target `.env` file
    before any modification is performed.
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{env_path}.backup.{timestamp}"

    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as src:
            with open(backup_path, "w", encoding="utf-8") as dst:
                dst.write(src.read())

    return backup_path


# ============================================================================
# Parsing Utilities
# ============================================================================

def parse_env_values(path: str) -> Dict[str, str]:
    """
    Parse KEY=VALUE pairs from an env file.

    - Ignores comments and empty lines
    - Does NOT perform validation
    """
    values: Dict[str, str] = {}
    if not os.path.exists(path):
        return values

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key, value = stripped.split("=", 1)
                values[key.strip()] = value.strip()
    return values


# ============================================================================
# Synchronization Logic
# ============================================================================

def sync_env_template(
    example_path: str = ".env.example",
    env_path: str = ".env",
    report_path: str = "env_sync_report.txt",
) -> None:
    """
    Synchronize `.env` using `.env.example` as a strict template reference.

    Rules
    -----
    - Template ordering, sections, and comments are preserved
    - Existing local values override template defaults
    - Missing keys are added from the template
    - Unknown keys are preserved and moved to a dedicated section
    - A backup and audit report are always produced
    """

    if not os.path.exists(example_path):
        print(f"ERROR: Reference template '{example_path}' not found.")
        return

    if not os.path.exists(env_path):
        print(f"ERROR: Target env file '{env_path}' not found.")
        return

    # Backup before any mutation
    backup_path = backup_env_file(env_path)

    current_values = parse_env_values(env_path)
    new_env_lines: List[str] = []
    report_lines: List[str] = []

    processed_keys = set()
    added_keys: List[str] = []
    used_existing_keys: List[str] = []
    legacy_keys: List[str] = []

    # ----------------------------------------------------------------------
    # Phase 1: Rebuild .env strictly from template
    # ----------------------------------------------------------------------
    with open(example_path, "r", encoding="utf-8") as template:
        for line in template:
            raw_line = line.rstrip("\n")
            stripped = raw_line.strip()

            if stripped and not stripped.startswith("#") and "=" in stripped:
                key, default_value = stripped.split("=", 1)
                key = key.strip()
                processed_keys.add(key)

                if key in current_values:
                    new_env_lines.append(f"{key}={current_values[key]}")
                    used_existing_keys.append(key)
                else:
                    new_env_lines.append(raw_line)
                    added_keys.append(key)
            else:
                new_env_lines.append(raw_line)

    # ----------------------------------------------------------------------
    # Phase 2: Preserve legacy / custom variables
    # ----------------------------------------------------------------------
    legacy_keys = [k for k in current_values if k not in processed_keys]

    if legacy_keys:
        new_env_lines.append("")
        new_env_lines.append("# ============================================================================")
        new_env_lines.append("# CUSTOM & LEGACY VARIABLES (Not defined in .env.example)")
        new_env_lines.append("# These variables are preserved but not governed by the template.")
        new_env_lines.append("# ============================================================================")
        for key in sorted(legacy_keys):
            new_env_lines.append(f"{key}={current_values[key]}")

    # ----------------------------------------------------------------------
    # Phase 3: Write synchronized .env
    # ----------------------------------------------------------------------
    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_env_lines) + "\n")

    # ----------------------------------------------------------------------
    # Phase 4: Write audit report
    # ----------------------------------------------------------------------
    report_lines.append("ENV TEMPLATE SYNCHRONIZATION REPORT")
    report_lines.append("=" * 60)
    report_lines.append(f"Timestamp       : {datetime.utcnow().isoformat()}Z")
    report_lines.append(f"Template File   : {example_path}")
    report_lines.append(f"Target File     : {env_path}")
    report_lines.append(f"Backup Created  : {backup_path}")
    report_lines.append("")

    if added_keys:
        report_lines.append("Variables added from template:")
        for k in added_keys:
            report_lines.append(f"  + {k}")
        report_lines.append("")

    if used_existing_keys:
        report_lines.append("Variables using existing local values:")
        for k in used_existing_keys:
            report_lines.append(f"  = {k}")
        report_lines.append("")

    if legacy_keys:
        report_lines.append("Legacy / custom variables preserved:")
        for k in legacy_keys:
            report_lines.append(f"  * {k}")
        report_lines.append("")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines) + "\n")

    # ----------------------------------------------------------------------
    # Operator feedback
    # ----------------------------------------------------------------------
    print("SUCCESS: .env synchronized using template-governed strategy.")
    print(f"- Backup created : {backup_path}")
    print(f"- Audit report   : {report_path}")


if __name__ == "__main__":
    sync_env_template()
