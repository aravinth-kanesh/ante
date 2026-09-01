"""Shared helpers for the per-user Profile row."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.models.user import User


def get_or_create(db: Session, user: User) -> Profile:
    if user.profile is not None:
        return user.profile
    # Several dashboard requests can reach here at once; the unique constraint on
    # profiles.user_id means only one insert wins, so treat a clash as "another request
    # already created it" and use that one.
    profile = Profile(user_id=user.id)
    db.add(profile)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(Profile).filter_by(user_id=user.id).one()
    db.refresh(profile)
    return profile


def clear_coach_summary(db: Session, user: User) -> None:
    """Drop the cached progress summary so it is regenerated after the history changes."""
    profile = user.profile
    if profile is not None and profile.coach_summary:
        profile.coach_summary = ""
        db.commit()
