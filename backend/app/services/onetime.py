"""Issue and consume single-use tokens for email verification and password reset.

Only the SHA-256 hash of each token is stored. Consuming a token checks that it
exists, matches the purpose, has not been used, and has not expired, then marks it
used so it cannot be replayed.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.onetime import OneTimeToken

VERIFY = "verify"
RESET = "reset"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue(db: Session, user_id: int, purpose: str, ttl_hours: int) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(
        OneTimeToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=_hash(raw),
            expires_at=_utcnow() + timedelta(hours=ttl_hours),
        )
    )
    db.commit()
    return raw


def consume(db: Session, raw: str, purpose: str) -> int | None:
    """Return the user id if the token is valid and unused, else None. Marks it used."""
    token = db.scalar(
        select(OneTimeToken).where(
            OneTimeToken.token_hash == _hash(raw), OneTimeToken.purpose == purpose
        )
    )
    if token is None or token.used_at is not None:
        return None
    if _aware(token.expires_at) <= _utcnow():
        return None
    token.used_at = _utcnow()
    db.commit()
    return token.user_id
