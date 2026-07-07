from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import ProfileRead, ProfileUpdate
from app.security import get_current_user

router = APIRouter(prefix="/profile", tags=["profile"])


def _get_or_create(db: Session, user: User) -> Profile:
    if user.profile is None:
        user.profile = Profile()
        db.add(user)
        db.commit()
        db.refresh(user)
    return user.profile


@router.get("", response_model=ProfileRead)
def read_profile(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Profile:
    return _get_or_create(db, current_user)


@router.put("", response_model=ProfileRead)
def update_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Profile:
    profile = _get_or_create(db, current_user)
    profile.cv_text = data.cv_text
    profile.jd_text = data.jd_text
    db.commit()
    db.refresh(profile)
    return profile
