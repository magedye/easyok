"""app.main

ASGI entrypoint expected by the dev startup script:

    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

This is a thin wrapper that re-exports the FastAPI application created in the
project-level `main.py`.
"""

from importlib import import_module

app = import_module("main").app
