from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# check_same_thread is a SQLite-only flag needed for FastAPI's threaded requests.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


# Columns added after a table was first created, keyed by table. create_all does
# not ALTER existing tables, so for the long-lived SQLite dev database we add any
# missing columns here at startup. This stays lightweight in place of Alembic.
_ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "interview_sessions": {
        "mode": "VARCHAR NOT NULL DEFAULT 'text'",
        "interview_type": "VARCHAR NOT NULL DEFAULT 'general'",
        "company": "VARCHAR NOT NULL DEFAULT ''",
        "role": "VARCHAR NOT NULL DEFAULT ''",
    },
    "turns": {"metrics": "TEXT", "nonverbal": "TEXT"},
    "profiles": {"selected_cv_id": "INTEGER", "company_research": "TEXT NOT NULL DEFAULT ''"},
}


def ensure_columns() -> None:
    """Add missing columns to existing SQLite tables. Idempotent; SQLite only."""
    if not settings.database_url.startswith("sqlite"):
        return
    inspector = inspect(engine)
    for table, columns in _ADDED_COLUMNS.items():
        if not inspector.has_table(table):
            continue
        existing = {col["name"] for col in inspector.get_columns(table)}
        for name, definition in columns.items():
            if name not in existing:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
