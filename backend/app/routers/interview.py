import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.session import InterviewSession, Turn
from app.models.user import User
from app.ratelimit import limiter
from app.routers.profile import _get_or_create, run_research
from app.schemas.interview import (
    ActiveExchange,
    ActiveInterview,
    AnswerRequest,
    AnswerResponse,
    DeliveryMetrics,
    FeedbackReport,
    FeedbackResponse,
    NonverbalMetrics,
    ReflectionUpdate,
    SessionSummary,
    StartRequest,
    StartResponse,
    TranscriptResponse,
    TurnRead,
)
from app.security import get_current_user
from app.services import interview, samples, session_media

router = APIRouter(prefix="/interview", tags=["interview"])
logger = logging.getLogger(__name__)


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
@limiter.limit(settings.llm_rate_limit)
def start(
    request: Request,
    data: StartRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StartResponse:
    mode = data.mode if data else "text"
    interview_type = data.interview_type if data else "general"
    focus = data.focus if data else "balanced"
    category = data.category if data else ""
    duration_target_min = data.duration_target_min if data else 10
    sample = data.sample if data else False
    difficulty = data.difficulty if data else "standard"

    if sample:
        # A no-setup try of the app: use the built-in sample CV and role, no profile.
        cv, jd, context = samples.SAMPLE_CV, samples.SAMPLE_JD, samples.SAMPLE_CONTEXT
        company, role, focus_code, focus_text = samples.SAMPLE_COMPANY, samples.SAMPLE_ROLE, "", ""
    else:
        profile = _get_or_create(db, current_user)
        if not profile.cv_text.strip():
            raise HTTPException(status_code=400, detail="Add your CV before starting an interview")

        # ground on the company if the job description is set but not yet researched
        if not profile.company_context.strip() and profile.jd_text.strip():
            try:
                run_research(db, profile)
            except Exception:
                db.rollback()

        # Steer the interview at the candidate's weak spots or likely questions when
        # asked; falls back to a balanced interview if that prep data is not there.
        focus_code, focus_text = interview.focus_brief(
            profile.preparation, profile.prep_questions, focus, category
        )
        cv, jd, context = profile.cv_text, profile.jd_text, profile.company_context
        company, role = profile.company, profile.role

    try:
        session, question = interview.start(
            db,
            current_user,
            cv,
            jd,
            context,
            mode,
            interview_type,
            company,
            role,
            focus_code,
            focus_text,
            duration_target_min,
            is_sample=sample,
            difficulty="standard" if sample else difficulty,
        )
    except Exception as exc:
        logger.exception("interview start failed")
        raise HTTPException(
            status_code=502,
            detail="The interviewer could not start just now. Please try again in a moment.",
        ) from exc
    return StartResponse(
        session_id=session.id,
        question=question,
        mode=session.mode,
        interview_type=session.interview_type,
        duration_target_min=session.duration_target_min,
    )


@router.get("/active", response_model=ActiveInterview | None)
def active(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActiveInterview | None:
    # The most recent interview the student started but never finished, so the page can
    # offer to pick it up where they left off. Returns null when there is nothing to resume.
    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == current_user.id, InterviewSession.status == "active")
        .order_by(InterviewSession.created_at.desc(), InterviewSession.id.desc())
        .first()
    )
    if session is None:
        return None

    # Pair each question with the answer that followed it; a trailing question with no
    # answer is the one the student is currently on.
    history: list[ActiveExchange] = []
    pending: str | None = None
    for turn in session.turns:
        if turn.kind == "question":
            pending = turn.content
        elif turn.kind == "answer" and pending is not None:
            history.append(ActiveExchange(question=pending, answer=turn.content))
            pending = None

    return ActiveInterview(
        session_id=session.id,
        mode=session.mode,
        interview_type=session.interview_type,
        duration_target_min=session.duration_target_min,
        is_sample=session.is_sample,
        question=pending,
        history=history,
    )


@router.post("/{session_id}/answer", response_model=AnswerResponse)
@limiter.limit(settings.llm_rate_limit)
def answer(
    request: Request,
    session_id: int,
    data: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnswerResponse:
    session = _owned(db, session_id, current_user)
    if session.status != "active":
        raise HTTPException(status_code=400, detail="This interview has finished")
    metrics_json = data.metrics.model_dump_json() if data.metrics else None
    # The per-second timeline is only used by the live in-session replay, so it is not
    # persisted with the turn; only the aggregate numbers are stored and read back.
    nonverbal_json = (
        data.nonverbal.model_copy(update={"timeline": []}).model_dump_json() if data.nonverbal else None
    )
    try:
        question = interview.answer(db, session, data.answer, metrics_json, nonverbal_json)
    except Exception as exc:
        logger.exception("interview answer failed")
        raise HTTPException(
            status_code=502,
            detail="The interview hit a problem. Please try again in a moment.",
        ) from exc
    return AnswerResponse(question=question, done=question is None)


@router.post("/{session_id}/finish", response_model=FeedbackResponse)
@limiter.limit(settings.llm_rate_limit)
def finish(
    request: Request,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeedbackResponse:
    session = _owned(db, session_id, current_user)
    try:
        report = interview.finish(db, session)
    except Exception as exc:
        logger.exception("feedback generation failed")
        raise HTTPException(
            status_code=502,
            detail="Your feedback could not be generated just now. Please try again in a moment.",
        ) from exc
    return FeedbackResponse(feedback=report)


@router.post("/{session_id}/feedback", response_model=FeedbackResponse)
@limiter.limit(settings.llm_rate_limit)
def regenerate_feedback(
    request: Request,
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FeedbackResponse:
    session = _owned(db, session_id, current_user)
    if not any(t.kind == "answer" for t in session.turns):
        raise HTTPException(status_code=400, detail="This interview has no answers to assess")
    try:
        report = interview.regenerate_feedback(db, session)
    except Exception as exc:
        logger.exception("feedback generation failed")
        raise HTTPException(
            status_code=502,
            detail="Your feedback could not be generated just now. Please try again in a moment.",
        ) from exc
    return FeedbackResponse(feedback=report)


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
    # Sessions created before the company and role were recorded show a generic
    # title. Adopt the profile's company and role when the session was run against
    # the same job description, so old runs are still identifiable.
    profile = _get_or_create(db, current_user)
    backfilled = False
    for session in sessions:
        if not session.company and profile.company and session.jd_snapshot == profile.jd_text:
            session.company = profile.company
            session.role = profile.role
            backfilled = True
    if backfilled:
        db.commit()

    # Number repeats of the same interview type for the same company and role,
    # counting from the oldest so a session's number never changes.
    seen: dict[tuple[str, str, str], int] = {}
    seq_by_id: dict[int, int] = {}
    for session in sorted(sessions, key=lambda s: (s.created_at, s.id)):
        key = (session.company, session.role, session.interview_type)
        seen[key] = seen.get(key, 0) + 1
        seq_by_id[session.id] = seen[key]

    summaries: list[SessionSummary] = []
    for session in sessions:
        questions = [t for t in session.turns if t.kind == "question"]
        summaries.append(
            SessionSummary(
                id=session.id,
                mode=session.mode,
                interview_type=session.interview_type,
                focus=session.focus,
                status=session.status,
                created_at=session.created_at,
                question_count=len(questions),
                title=interview.session_title(
                    session.company,
                    session.role,
                    session.interview_type,
                    seq_by_id[session.id],
                    session.focus,
                ),
                preview=questions[0].content if questions else "(no questions)",
                is_sample=session.is_sample,
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
    feedback_turn = next((t for t in session.turns if t.kind == "feedback"), None)
    feedback = None
    if feedback_turn:
        # Newer sessions store a JSON report; older ones stored plain prose.
        feedback = _parse(FeedbackReport, feedback_turn.content) or FeedbackReport(
            summary=feedback_turn.content
        )
    return TranscriptResponse(
        status=session.status,
        mode=session.mode,
        interview_type=session.interview_type,
        focus=session.focus,
        company=session.company,
        role=session.role,
        feedback=feedback,
        reflection=session.reflection,
        turns=[_turn_read(t) for t in session.turns],
    )


@router.put("/{session_id}/reflection")
def save_reflection(
    session_id: int,
    data: ReflectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # The student's own note on what they will do differently next time.
    session = _owned(db, session_id, current_user)
    session.reflection = data.text.strip()
    db.commit()
    return {"ok": True}


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    # A candidate can delete their own past interviews (their own data).
    session = _owned(db, session_id, current_user)
    session_media.purge(session.id)  # remove any recordings held for this session
    db.delete(session)
    db.commit()
    return {"ok": True}
