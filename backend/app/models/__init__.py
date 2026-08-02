"""Importing this package registers every ORM model on ``Base.metadata``.

Both the application startup and the Alembic migration environment import it so
that table creation and autogenerate see the full schema from one place.
"""

from app.models import cv, profile, refresh, session, user  # noqa: F401
