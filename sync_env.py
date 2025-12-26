import os
from datetime import datetime
from typing import Dict, List


def backup_env_file(env_path: str) -> str:
    """Create a timestamped backup of the .env file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{env_path}.backup.{timestamp}"

    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as src:
            with open(backup_path, "w", encoding="utf-8") as dst:
                dst.write(src.read())

    return backup_path


def parse_env_values(path: str) -> Dict[str, str]:
    """Parse KEY=VALUE pairs from an env file (ignores comments)."""
    values = {}
    if not os.path.exists(path):
        return values

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key, value = stripped.split("=", 1)
                values[key.strip()] = value.strip()
    return values


def sync_env_template(
    example_path: str = ".env.example",
    env_path: str = ".env",
    report_path: str = "env_sync_report.txt",
):
    """
    Synchronize .env using .env.example as a strict template reference.
    - Preserves sections, comments, and ordering from the template.
    - Keeps existing local values.
    - Moves legacy variables to a dedicated section.
    - Creates a backup and a change report.
    """

    if not os.path.exists(example_path):
        print(f"ERROR: Reference file '{example_path}' not found.")
        return

    # Backup before any modification
    backup_path = backup_env_file(env_path)

    current_values = parse_env_values(env_path)
    new_env_lines: List[str] = []
    report_lines: List[str] = []

    processed_keys = set()
    added_keys = []
    used_existing_keys = []
    legacy_keys = []

    # Rebuild .env using the template structure
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

    # Handle legacy / custom variables
    legacy_keys = [k for k in current_values if k not in processed_keys]
    if legacy_keys:
        new_env_lines.append("")
        new_env_lines.append("# ============================================================================")
        new_env_lines.append("# CUSTOM & LEGACY VARIABLES (Not in .env.example)")
        new_env_lines.append("# ============================================================================")
        for key in sorted(legacy_keys):
            new_env_lines.append(f"{key}={current_values[key]}")

    # Write the synchronized .env
    with open(env_path, "w", encoding="utf-8") as f:
        f.write("\n".join(new_env_lines) + "\n")

    # Write the audit report
    report_lines.append("ENV SYNC REPORT")
    report_lines.append("=" * 60)
    report_lines.append(f"Timestamp      : {datetime.now().isoformat()}")
    report_lines.append(f"Template File  : {example_path}")
    report_lines.append(f"Target File    : {env_path}")
    report_lines.append(f"Backup Created : {backup_path}")
    report_lines.append("")

    if added_keys:
        report_lines.append("Added variables (from template):")
        for k in added_keys:
            report_lines.append(f"  + {k}")
        report_lines.append("")

    if used_existing_keys:
        report_lines.append("Variables using existing local values:")
        for k in used_existing_keys:
            report_lines.append(f"  = {k}")
        report_lines.append("")

    if legacy_keys:
        report_lines.append("Legacy / custom variables moved to bottom:")
        for k in legacy_keys:
            report_lines.append(f"  * {k}")
        report_lines.append("")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines) + "\n")

    print("SUCCESS: .env synchronized using template-based strategy.")
    print(f"- Backup created at: {backup_path}")
    print(f"- Change report written to: {report_path}")


if __name__ == "__main__":
    sync_env_template()
