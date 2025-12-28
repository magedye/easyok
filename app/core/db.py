"""
System database helper.

Provides SQLAlchemy engine/session for the system DB (audit, training,
assets, feedback) and creates tables on startup.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import get_settings
from app.models.internal import Base

_engine = None
_SessionLocal = None


def _init_engine():
    global _engine, _SessionLocal
    settings = get_settings()
    if settings.SYSTEM_DB_TYPE == "sqlite":
        db_path = Path(settings.SYSTEM_DB_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{db_path}"
        _engine = create_engine(url, connect_args={"check_same_thread": False})
    else:
        url = settings.SYSTEM_DB_PATH
        _engine = create_engine(url)
    _SessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=_engine, expire_on_commit=False
    )
    Base.metadata.create_all(bind=_engine)


def get_engine():
    global _engine
    if _engine is None:
        _init_engine()
    return _engine


def get_sessionmaker():
    global _SessionLocal
    if _SessionLocal is None:
        _init_engine()
    return _SessionLocal


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a transactional scope around a series of operations."""
    SessionLocal = get_sessionmaker()
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
