from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import ProfileRead, ProfileUpdate
from app.security import get_current_user
from app.services.cv_parse import SUPPORTED, extract_text

router = APIRouter(prefix="/profile", tags=["profile"])

MAX_CV_BYTES = 2 * 1024 * 1024


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


@router.post("/cv", response_model=ProfileRead)
async def upload_cv(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Profile:
    filename = file.filename or ""
    if not filename.lower().endswith(SUPPORTED):
        raise HTTPException(status_code=400, detail="Use a PDF, Word (.docx) or plain text file")

    data = await file.read()
    if len(data) > MAX_CV_BYTES:
        raise HTTPException(status_code=400, detail="File too large (2 MB limit)")

    try:
        text = extract_text(filename, data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read the file: {exc}") from exc
    if not text:
        raise HTTPException(status_code=400, detail="No text could be extracted from the file")

    profile = _get_or_create(db, current_user)
    profile.cv_text = text
    profile.cv_filename = filename
    db.commit()
    db.refresh(profile)
    return profile
