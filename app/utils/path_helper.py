"""
Utility functions for constructing file system paths.

These helpers ensure that file paths remain correct on both Windows
and Unix environments, and centralise path manipulations.  Use
`config.BASE_DIR` and `config.DATA_DIR` where possible instead of
hard‑coding paths.
"""

from pathlib import Path

def ensure_directory(path: Path) -> Path:
    """Ensure that the given directory exists, creating it if necessary."""
    path.mkdir(parents=True, exist_ok=True)
    return path