from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.session import InterviewSession
from app.models.user import User
from app.ratelimit import limiter
from app.schemas.progress import ProgressReport, ProgressSummary
from app.security import get_current_user
from app.services import llm, moderation, profiles, progress
from app.services.prompts import PROGRESS_SUMMARY_PROMPT
from app.services.text import strip_markdown

router = APIRouter(prefix="/progress", tags=["progress"])


def _usable_sessions(db: Session, user: User) -> list[InterviewSession]:
    sessions = (
        db.query(InterviewSession)
        .filter_by(user_id=user.id)
        .order_by(InterviewSession.created_at)
        .all()
    )
    # A session counts once it is finished or has at least one answer to measure. Sample
    # interviews run on the built-in example CV are excluded so they do not skew a
    # student's real trends.
    return [
        s
        for s in sessions
        if not s.is_sample and (s.status == "finished" or any(t.kind == "answer" for t in s.turns))
    ]


@router.get("", response_model=ProgressReport)
def read_progress(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProgressReport:
    """Trends across the user's past interviews, aggregated from stored metrics."""
    return progress.build_report(_usable_sessions(db, current_user))


@router.get("/summary", response_model=ProgressSummary)
def read_coach_summary(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProgressSummary:
    """The stored coach summary, so it persists across logins. Empty when none is saved
    yet or the interview history changed and cleared it (the page regenerates it then)."""
    profile = current_user.profile
    return ProgressSummary(summary=profile.coach_summary if profile else "")


# A POST because it makes a billable model call: it must not be cached or prefetched.
@router.post("/summary", response_model=ProgressSummary)
@limiter.limit(settings.llm_rate_limit)
def coach_summary(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProgressSummary:
    """Generate and store a short coach note narrating the student's trends (a model call)."""
    report = progress.build_report(_usable_sessions(db, current_user))
    if report.totals.interviews == 0:
        return ProgressSummary(
            summary=(
                "You have not done any interviews yet. Do your first mock interview and "
                "a summary of your progress will appear here."
            )
        )
    prompt = PROGRESS_SUMMARY_PROMPT.format(progress=progress.describe(report))
    try:
        reply = llm.chat([{"role": "user", "content": prompt}])
        if not moderation.moderate_output(reply).allowed:
            reply = llm.chat([{"role": "user", "content": prompt}])  # one retry
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not summarise your progress: {exc}") from exc
    summary = strip_markdown(reply)
    profiles.get_or_create(db, current_user).coach_summary = summary
    db.commit()
    return ProgressSummary(summary=summary)
