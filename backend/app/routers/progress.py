from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.session import InterviewSession
from app.models.user import User
from app.schemas.progress import ProgressReport
from app.security import get_current_user
from app.services import progress

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressReport)
def read_progress(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ProgressReport:
    """Trends across the user's past interviews, aggregated from stored metrics."""
    sessions = (
        db.query(InterviewSession)
        .filter_by(user_id=current_user.id)
        .order_by(InterviewSession.created_at)
        .all()
    )
    # A session counts once it is finished or has at least one answer to measure.
    usable = [s for s in sessions if s.status == "finished" or any(t.kind == "answer" for t in s.turns)]
    return progress.build_report(usable)
