import os

# Must be set before importing the app so settings pick it up: the suite builds its
# own in-memory schema and skips the startup migrations.
os.environ.setdefault("TESTING", "true")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.db import Base, get_db
from app.main import app
from app.ratelimit import limiter

# The tests hit auth many times from one client; rate limiting is exercised
# separately in test_auth, so disable it for the rest of the suite.
limiter.enabled = False
# CSRF is exercised on its own in test_auth; disable it elsewhere so the suite does
# not have to thread a CSRF header through every mutating request.
settings.csrf_enabled = False
# The breached-password check makes a network call and would reject the shared test
# password; it is exercised with a mock in test_auth. Off everywhere else.
settings.check_breached_passwords = False


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
