from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.cv import CV
from app.models.profile import Profile
from app.models.user import User
from app.ratelimit import limiter
from app.routers.profile import MAX_CV_BYTES, _get_or_create
from app.schemas.cv import CVCreate, CVRead, CVSummary, CVUpdate
from app.security import get_current_user
from app.services.cv_parse import SUPPORTED, extract_text

router = APIRouter(prefix="/cv", tags=["cv"])


def _summary(cv: CV, selected_id: int | None) -> CVSummary:
    return CVSummary(
        id=cv.id,
        label=cv.label,
        filename=cv.filename,
        created_at=cv.created_at,
        selected=cv.id == selected_id,
    )


def _read(cv: CV, selected_id: int | None) -> CVRead:
    return CVRead(**_summary(cv, selected_id).model_dump(), text=cv.text)


def _owned_cv(db: Session, cv_id: int, user: User) -> CV:
    cv = db.get(CV, cv_id)
    if cv is None or cv.user_id != user.id:
        raise HTTPException(status_code=404, detail="CV not found")
    return cv


def _mirror(profile: Profile, cv: CV) -> None:
    """Point the active-CV mirror (read by interview/prepare) at this CV."""
    profile.selected_cv_id = cv.id
    profile.cv_text = cv.text
    profile.cv_filename = cv.filename


def _user_cvs(db: Session, user: User) -> list[CV]:
    return (
        db.query(CV)
        .filter(CV.user_id == user.id)
        .order_by(CV.created_at.desc(), CV.id.desc())
        .all()
    )


@router.get("", response_model=list[CVSummary])
def list_cvs(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[CVSummary]:
    profile = _get_or_create(db, current_user)
    cvs = _user_cvs(db, current_user)
    # Backfill a legacy single CV so existing users keep it.
    if not cvs and profile.cv_text.strip():
        cv = CV(
            user_id=current_user.id,
            label="My CV",
            filename=profile.cv_filename or "",
            text=profile.cv_text,
        )
        db.add(cv)
        db.commit()
        db.refresh(cv)
        profile.selected_cv_id = cv.id
        db.commit()
        cvs = [cv]
    return [_summary(cv, profile.selected_cv_id) for cv in cvs]


@router.post("", response_model=CVRead)
def create_cv(
    data: CVCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CVRead:
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="CV text is empty")
    profile = _get_or_create(db, current_user)
    cv = CV(user_id=current_user.id, label=data.label.strip() or "My CV", text=data.text)
    db.add(cv)
    db.commit()
    db.refresh(cv)
    _mirror(profile, cv)
    db.commit()
    return _read(cv, profile.selected_cv_id)


@router.post("/upload", response_model=CVRead)
@limiter.limit(settings.upload_rate_limit)
async def upload_cv(
    request: Request,
    file: UploadFile = File(...),
    label: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CVRead:
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
    cv = CV(user_id=current_user.id, label=label.strip() or filename, filename=filename, text=text)
    db.add(cv)
    db.commit()
    db.refresh(cv)
    _mirror(profile, cv)
    db.commit()
    return _read(cv, profile.selected_cv_id)


@router.get("/{cv_id}", response_model=CVRead)
def get_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CVRead:
    cv = _owned_cv(db, cv_id, current_user)
    profile = _get_or_create(db, current_user)
    return _read(cv, profile.selected_cv_id)


@router.patch("/{cv_id}", response_model=CVRead)
def update_cv(
    cv_id: int,
    data: CVUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CVRead:
    cv = _owned_cv(db, cv_id, current_user)
    if data.label is not None:
        cv.label = data.label.strip() or cv.label
    if data.text is not None:
        cv.text = data.text
    db.commit()
    db.refresh(cv)
    profile = _get_or_create(db, current_user)
    if profile.selected_cv_id == cv.id:
        _mirror(profile, cv)  # keep the mirror in step with edits
        db.commit()
    return _read(cv, profile.selected_cv_id)


@router.post("/{cv_id}/select", response_model=CVRead)
def select_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CVRead:
    cv = _owned_cv(db, cv_id, current_user)
    profile = _get_or_create(db, current_user)
    _mirror(profile, cv)
    db.commit()
    return _read(cv, profile.selected_cv_id)


@router.delete("/{cv_id}")
def delete_cv(
    cv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    cv = _owned_cv(db, cv_id, current_user)
    profile = _get_or_create(db, current_user)
    was_selected = profile.selected_cv_id == cv.id
    db.delete(cv)
    db.commit()
    if was_selected:
        other = _user_cvs(db, current_user)
        if other:
            _mirror(profile, other[0])
        else:
            profile.selected_cv_id = None
            profile.cv_text = ""
            profile.cv_filename = ""
        db.commit()
    return {"ok": True}
