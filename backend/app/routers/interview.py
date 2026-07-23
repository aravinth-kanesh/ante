from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.session import InterviewSession, Turn
from app.models.user import User
from app.routers.profile import _get_or_create
from app.schemas.interview import (
    AnswerRequest,
    AnswerResponse,
    DeliveryMetrics,
    FeedbackResponse,
    NonverbalMetrics,
    SessionSummary,
    StartRequest,
    StartResponse,
    TranscriptResponse,
    TurnRead,
)
from app.security import get_current_user
from app.services import interview, research

router = APIRouter(prefix="/interview", tags=["interview"])


def _owned(db: Session, session_id: int, user: User) -> InterviewSession:
    session = db.get(InterviewSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Interview not found")
    return session


def _parse(model, raw: str | None):
    if not raw:
        return None
    try:
        return model.model_validate_json(raw)
    except ValueError:
        return None


def _turn_read(turn: Turn) -> TurnRead:
    return TurnRead(
        role=turn.role,
        kind=turn.kind,
        content=turn.content,
        metrics=_parse(DeliveryMetrics, turn.metrics),
        nonverbal=_parse(NonverbalMetrics, turn.nonverbal),
    )


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
    metrics_json = data.metrics.model_dump_json() if data.metrics else None
    nonverbal_json = data.nonverbal.model_dump_json() if data.nonverbal else None
    try:
        question = interview.answer(db, session, data.answer, metrics_json, nonverbal_json)
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


@router.get("", response_model=list[SessionSummary])
def list_sessions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[SessionSummary]:
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.created_at.desc(), InterviewSession.id.desc())
        .all()
    )
    summaries: list[SessionSummary] = []
    for session in sessions:
        questions = [t for t in session.turns if t.kind == "question"]
        summaries.append(
            SessionSummary(
                id=session.id,
                mode=session.mode,
                status=session.status,
                created_at=session.created_at,
                question_count=len(questions),
                preview=questions[0].content if questions else "(no questions)",
            )
        )
    return summaries


@router.get("/{session_id}", response_model=TranscriptResponse)
def transcript(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TranscriptResponse:
    session = _owned(db, session_id, current_user)
    return TranscriptResponse(
        status=session.status,
        mode=session.mode,
        turns=[_turn_read(t) for t in session.turns],
    )
