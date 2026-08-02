"""Server-side refresh sessions: issue, rotate, and revoke browser logins.

Each login gets a row in ``refresh_sessions`` holding only the hash of the opaque
refresh token. Rotation revokes the presented token and issues a fresh one; if a
token that has already been rotated away is presented again, that signals theft, so
the whole family for the user is revoked.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.refresh import RefreshSession
from app.security import generate_refresh_token, hash_refresh_token

logger = logging.getLogger("app")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    # SQLite does not preserve tzinfo, so timestamps come back naive; treat them as UTC.
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _client(request: Request | None) -> tuple[str, str]:
    if request is None:
        return "", ""
    agent = request.headers.get("user-agent", "")[:400]
    ip = request.client.host if request.client else ""
    return agent, ip


def issue(db: Session, user_id: int, request: Request | None = None) -> str:
    """Create a new refresh session and return its raw token (stored only as a hash)."""
    raw = generate_refresh_token()
    agent, ip = _client(request)
    db.add(
        RefreshSession(
            user_id=user_id,
            token_hash=hash_refresh_token(raw),
            expires_at=_utcnow() + timedelta(days=settings.refresh_token_expire_days),
            user_agent=agent,
            ip=ip,
        )
    )
    db.commit()
    return raw


def rotate(db: Session, raw: str, request: Request | None = None) -> tuple[int, str] | None:
    """Validate and rotate a refresh token. Returns (user_id, new_raw) or None."""
    session = db.scalar(
        select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(raw))
    )
    if session is None:
        return None
    if session.revoked_at is not None:
        # A revoked token being replayed means it was stolen after rotation; burn the
        # whole family so neither the attacker nor the victim can keep using it.
        logger.warning("refresh token reuse detected for user %s; revoking all sessions", session.user_id)
        revoke_all(db, session.user_id)
        return None
    if _aware(session.expires_at) <= _utcnow():
        return None

    session.revoked_at = _utcnow()
    new_raw = issue(db, session.user_id, request)  # commits both the revoke and the new row
    return session.user_id, new_raw


def revoke(db: Session, raw: str) -> None:
    """Revoke a single session (used on logout). Silently ignores unknown tokens."""
    session = db.scalar(
        select(RefreshSession).where(RefreshSession.token_hash == hash_refresh_token(raw))
    )
    if session is not None and session.revoked_at is None:
        session.revoked_at = _utcnow()
        db.commit()


def revoke_all(db: Session, user_id: int) -> None:
    """Revoke every active session for a user (password change, reuse detection)."""
    db.execute(
        update(RefreshSession)
        .where(RefreshSession.user_id == user_id, RefreshSession.revoked_at.is_(None))
        .values(revoked_at=_utcnow())
    )
    db.commit()


def delete_all(db: Session, user_id: int) -> None:
    """Remove every session row for a user (account erasure)."""
    db.query(RefreshSession).filter_by(user_id=user_id).delete()
