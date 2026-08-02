from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# check_same_thread is a SQLite-only flag needed for FastAPI's threaded requests.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Base(DeclarativeBase):
    pass


def run_migrations() -> None:
    """Bring the database up to the latest schema by applying Alembic migrations.

    Called once at startup so a fresh deployment (SQLite or PostgreSQL) is created
    and an existing one is upgraded. The Config carries no ini file, so the Alembic
    environment leaves the application's own logging untouched.
    """
    from alembic import command
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(_BACKEND_ROOT / "migrations"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
