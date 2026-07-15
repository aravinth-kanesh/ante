from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.routers.profile import _get_or_create
from app.schemas.prepare import PrepResponse
from app.security import get_current_user
from app.services import prepare

router = APIRouter(prefix="/prepare", tags=["prepare"])


@router.post("/questions", response_model=PrepResponse)
def questions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PrepResponse:
    profile = _get_or_create(db, current_user)
    if not profile.cv_text.strip() and not profile.jd_text.strip():
        raise HTTPException(status_code=400, detail="Add your CV and job description first")
    try:
        items = prepare.generate_questions(profile.cv_text, profile.jd_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate questions: {exc}") from exc
    return PrepResponse(questions=items)
