from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.session import InterviewSession
from app.models.user import User
from app.routers.profile import _get_or_create
from app.schemas.interview import (
    AnswerRequest,
    AnswerResponse,
    FeedbackResponse,
    StartRequest,
    StartResponse,
    TranscriptResponse,
)
from app.security import get_current_user
from app.services import interview, research

router = APIRouter(prefix="/interview", tags=["interview"])


def _owned(db: Session, session_id: int, user: User) -> InterviewSession:
    session = db.get(InterviewSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Interview not found")
    return session


@router.post("/start", response_model=StartResponse)
def start(
    data: StartRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StartResponse:
    mode = data.mode if data else "text"
    profile = _get_or_create(db, current_user)
    if not profile.cv_text.strip():
        raise HTTPException(status_code=400, detail="Add your CV before starting an interview")

    # ground on the company if the job description is set but not yet researched
    if not profile.company_context.strip() and profile.jd_text.strip():
        try:
            profile.company, profile.role = research.extract_company_role(profile.jd_text)
            profile.company_context = research.research_company(profile.company, profile.role)
            db.commit()
        except Exception:
            db.rollback()

    try:
        session, question = interview.start(
            db, current_user, profile.cv_text, profile.jd_text, profile.company_context, mode
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not start interview: {exc}") from exc
    return StartResponse(session_id=session.id, question=question, mode=session.mode)


@router.post("/{session_id}/answer", response_model=AnswerResponse)
def answer(
    session_id: int,
    data: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnswerResponse:
    session = _owned(db, session_id, current_user)
    if session.status != "active":
        raise HTTPException(status_code=400, detail="This interview has finished")
    try:
        question = interview.answer(db, session, data.answer)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Interview error: {exc}") from exc
    return AnswerResponse(question=question, done=question is None)


@router.post("/{session_id}/finish", response_model=FeedbackResponse)
def finish(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeedbackResponse:
    session = _owned(db, session_id, current_user)
    try:
        feedback = interview.finish(db, session)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not generate feedback: {exc}") from exc
    return FeedbackResponse(feedback=feedback)


@router.get("/{session_id}", response_model=TranscriptResponse)
def transcript(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TranscriptResponse:
    session = _owned(db, session_id, current_user)
    return TranscriptResponse(status=session.status, mode=session.mode, turns=session.turns)
