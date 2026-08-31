from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.profile import Profile
from app.models.user import User
from app.ratelimit import limiter
from app.schemas.profile import CompanyResearch, ProfileRead, ProfileUpdate, ResearchRead
from app.security import get_current_user
from app.services import research
from app.services.cv_parse import SUPPORTED, extract_text

router = APIRouter(prefix="/profile", tags=["profile"])

MAX_CV_BYTES = 2 * 1024 * 1024


def _get_or_create(db: Session, user: User) -> Profile:
    if user.profile is not None:
        return user.profile
    # The dashboard fires several requests at once, each of which may reach here; the
    # unique constraint on profiles.user_id means only one insert wins, so treat a
    # clash as "another request already created it" and use that one.
    profile = Profile(user_id=user.id)
    db.add(profile)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.query(Profile).filter_by(user_id=user.id).one()
    db.refresh(profile)
    return profile


def _stored_research(profile: Profile) -> CompanyResearch | None:
    if not profile.company_research:
        return None
    try:
        return CompanyResearch.model_validate_json(profile.company_research)
    except ValueError:
        return None


def run_research(db: Session, profile: Profile) -> CompanyResearch:
    """Research the company from the job description and store it on the profile.

    Keeps a structured version for display and a flattened text version that the
    interview and question prompts read as context.
    """
    company, role = research.extract_company_role(profile.jd_text)
    report = research.research_company(company, role, profile.jd_text)
    profile.company = company
    profile.role = role
    profile.company_research = report.model_dump_json()
    profile.company_context = research.render(report)
    db.commit()
    db.refresh(profile)
    return report


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
    if data.cv_text is not None:
        profile.cv_text = data.cv_text
    if data.jd_text != profile.jd_text:
        # The job description changed, so every tailored section is now out of date: the
        # research, the grounding context, the gap-analysis plan, and the likely questions.
        # Clear them so the Prepare page regenerates them for the new role.
        profile.company = ""
        profile.role = ""
        profile.company_context = ""
        profile.company_research = ""
        profile.preparation = ""
        profile.prep_questions = ""
    profile.jd_text = data.jd_text
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/research", response_model=ResearchRead)
def read_research(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ResearchRead:
    profile = _get_or_create(db, current_user)
    return ResearchRead(
        company=profile.company, role=profile.role, research=_stored_research(profile)
    )


@router.post("/research", response_model=ResearchRead)
@limiter.limit(settings.llm_rate_limit)
def research_profile(
    request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ResearchRead:
    profile = _get_or_create(db, current_user)
    if not profile.jd_text.strip():
        raise HTTPException(status_code=400, detail="Add a job description first")
    try:
        report = run_research(db, profile)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Research failed: {exc}") from exc
    return ResearchRead(company=profile.company, role=profile.role, research=report)


@router.post("/cv", response_model=ProfileRead)
@limiter.limit(settings.upload_rate_limit)
async def upload_cv(
    request: Request,
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
