from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.routers.profile import _get_or_create, run_research
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

    # research the company once and reuse it; a failure just means no company context
    if not profile.company_context.strip() and profile.jd_text.strip():
        try:
            run_research(db, profile)
        except Exception:
            db.rollback()

    try:
        items = prepare.generate_questions(
            profile.cv_text, profile.jd_text, profile.company_context
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate questions: {exc}") from exc
    return PrepResponse(questions=items)
