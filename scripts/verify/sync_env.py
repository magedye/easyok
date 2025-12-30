#!/usr/bin/env python3
import shutil
import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# Supported environment sources
# ---------------------------------------------------------------------------
ALLOWED_SOURCES = [
    ".env.schema",
    ".env.local",
    ".env.production",
]

DEFAULT_TARGET = ".env"


def choose_file(prompt, options, default=None):
    print(prompt)
    for i, opt in enumerate(options, start=1):
        print(f"  [{i}] {opt}")
    if default:
        print(f"Press ENTER for default: {default}")

    while True:
        choice = input("> ").strip()
        if not choice and default:
            return default
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
        print("Invalid selection.")


def parse_env_lines(lines):
    """
    Returns:
    - dict of key -> (index, value)
    """
    mapping = {}
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        mapping[key] = (i, value)
    return mapping


def backup_target(path: Path):
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = path.with_suffix(f".backup.{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"[OK] Backup created: {backup_path}")
    return backup_path


def prompt_user(key, old, new):
    print("\n────────────────────────────────────────")
    print(f"Variable       : {key}")
    print(f"Current value  : {old}")
    print(f"Source value   : {new}")
    print("Choose:")
    print("  [1] Keep current value")
    print("  [2] Replace with source value")
    print("  [3] Enter new value")

    while True:
        choice = input("Your choice (1/2/3): ").strip()
        if choice == "1":
            return old
        elif choice == "2":
            return new
        elif choice == "3":
            return input("Enter new value: ")
        else:
            print("Invalid choice.")


def main():
    print("=== Environment Synchronization Utility ===")

    source_file = choose_file(
        "Select SOURCE environment file:",
        ALLOWED_SOURCES,
    )

    target_file = choose_file(
        "Select TARGET environment file:",
        [DEFAULT_TARGET],
        default=DEFAULT_TARGET,
    )

    source_path = Path(source_file)
    target_path = Path(target_file)

    if not source_path.exists():
        raise FileNotFoundError(f"Source file not found: {source_file}")

    # If target does not exist → create from source
    if not target_path.exists():
        print(f"[INFO] {target_file} not found. Creating from {source_file}.")
        shutil.copy2(source_path, target_path)
        print(f"[OK] {target_file} created.")
        return

    # Read files
    source_lines = source_path.read_text().splitlines()
    target_lines = target_path.read_text().splitlines()

    source_map = parse_env_lines(source_lines)
    target_map = parse_env_lines(target_lines)

    # Backup
    backup_target(target_path)

    report = {
        "kept": [],
        "replaced": [],
        "custom": [],
        "added": [],
    }

    # Synchronize variables
    for key, (_, src_val) in source_map.items():
        if key in target_map:
            tgt_idx, tgt_val = target_map[key]
            if tgt_val != src_val:
                chosen = prompt_user(key, tgt_val, src_val)
                target_lines[tgt_idx] = f"{key}={chosen}"
                if chosen == tgt_val:
                    report["kept"].append(key)
                elif chosen == src_val:
                    report["replaced"].append(key)
                else:
                    report["custom"].append(key)
        else:
            target_lines.append(f"{key}={src_val}")
            report["added"].append(key)

    # Write updated file
    target_path.write_text("\n".join(target_lines) + "\n")

    # Final report
    print("\n================ CHANGE REPORT ================")
    for section, keys in report.items():
        print(f"{section.upper():>10}: {len(keys)}")
        for k in keys:
            print(f"  - {k}")
    print("================================================")
    print("[DONE] Environment synchronization complete.")
    print(f"Source: {source_file}")
    print(f"Target: {target_file}")


if __name__ == "__main__":
    main()
