from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.profile import Profile
from app.models.user import User
from app.routers.profile import _get_or_create, run_research
from app.schemas.prepare import PrepResponse
from app.schemas.preparation import PreparationReport
from app.security import get_current_user
from app.services import prepare, preparation

router = APIRouter(prefix="/prepare", tags=["prepare"])


def _stored_questions(profile: Profile) -> PrepResponse:
    if not profile.prep_questions:
        return PrepResponse(groups=[])
    try:
        return PrepResponse.model_validate_json(profile.prep_questions)
    except ValueError:
        return PrepResponse(groups=[])


def _stored_plan(profile: Profile) -> PreparationReport:
    if not profile.preparation:
        return PreparationReport()
    try:
        return PreparationReport.model_validate_json(profile.preparation)
    except ValueError:
        return PreparationReport()


def _ground(db: Session, profile: Profile) -> None:
    """Research the company once so questions and the plan are grounded in it."""
    if not profile.company_context.strip() and profile.jd_text.strip():
        try:
            run_research(db, profile)
        except Exception:
            db.rollback()


@router.get("/questions", response_model=PrepResponse)
def read_questions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PrepResponse:
    return _stored_questions(_get_or_create(db, current_user))


@router.post("/questions", response_model=PrepResponse)
def questions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PrepResponse:
    profile = _get_or_create(db, current_user)
    if not profile.cv_text.strip() and not profile.jd_text.strip():
        raise HTTPException(status_code=400, detail="Add your CV and job description first")

    _ground(db, profile)
    try:
        groups = prepare.generate_questions(
            profile.cv_text, profile.jd_text, profile.company_context
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate questions: {exc}") from exc

    response = PrepResponse(groups=groups)
    profile.prep_questions = response.model_dump_json()
    db.commit()
    return response


@router.get("/plan", response_model=PreparationReport)
def read_plan(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PreparationReport:
    return _stored_plan(_get_or_create(db, current_user))


@router.post("/plan", response_model=PreparationReport)
def make_plan(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PreparationReport:
    profile = _get_or_create(db, current_user)
    if not profile.cv_text.strip():
        raise HTTPException(status_code=400, detail="Add your CV first")
    if not profile.jd_text.strip():
        raise HTTPException(status_code=400, detail="Add a job description first")

    _ground(db, profile)
    try:
        report = preparation.analyse(profile.cv_text, profile.jd_text, profile.company_context)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not build a plan: {exc}") from exc

    profile.preparation = report.model_dump_json()
    db.commit()
    return report
