#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import sys


@dataclass(frozen=True)
class EnvParseResult:
    keys: set[str]
    duplicates: set[str]


def _parse_env_keys(path: Path) -> EnvParseResult:
    keys: set[str] = set()
    duplicates: set[str] = set()
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key = line.split("=", 1)[0].strip()
        if not key:
            continue
        if key in keys:
            duplicates.add(key)
        keys.add(key)
    return EnvParseResult(keys=keys, duplicates=duplicates)


def _check_file(schema_keys: set[str], env_path: Path) -> int:
    if not env_path.exists():
        print(f"[FAIL] Missing env file: {env_path}")
        return 1

    parsed = _parse_env_keys(env_path)
    if parsed.duplicates:
        print(f"[FAIL] Duplicate keys in {env_path}: {sorted(parsed.duplicates)}")
        return 1

    missing = schema_keys - parsed.keys
    extra = parsed.keys - schema_keys
    if missing:
        print(f"[FAIL] {env_path} missing keys from .env.schema: {sorted(missing)}")
        return 1
    if extra:
        print(f"[FAIL] {env_path} has extra keys not in .env.schema: {sorted(extra)}")
        return 1

    print(f"[OK] {env_path} matches .env.schema (keys={len(schema_keys)})")
    return 0


def main(argv: list[str]) -> int:
    repo_root = Path(__file__).resolve().parents[2]
    schema_path = repo_root / ".env.schema"
    if not schema_path.exists():
        print(f"[FAIL] Missing schema file: {schema_path}")
        return 1

    schema_parsed = _parse_env_keys(schema_path)
    if schema_parsed.duplicates:
        print(f"[FAIL] Duplicate keys in .env.schema: {sorted(schema_parsed.duplicates)}")
        return 1

    targets = argv[1:] if len(argv) > 1 else [".env.local", ".env.ci", ".env.production"]
    exit_code = 0
    for rel in targets:
        exit_code |= _check_file(schema_parsed.keys, repo_root / rel)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

