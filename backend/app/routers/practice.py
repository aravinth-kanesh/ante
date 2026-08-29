import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.user import User
from app.ratelimit import limiter
from app.routers.profile import _get_or_create
from app.schemas.interview import AnswerNote
from app.schemas.practice import PracticeQuestion, PracticeRequest
from app.schemas.prepare import PrepResponse
from app.security import get_current_user
from app.services import practice

router = APIRouter(prefix="/practice", tags=["practice"])
logger = logging.getLogger(__name__)


def _likely_questions(prep_questions: str) -> list[str]:
    if not prep_questions:
        return []
    try:
        response = PrepResponse.model_validate_json(prep_questions)
    except ValueError:
        return []
    return [q.question for group in response.groups for q in group.questions]


@router.get("/question", response_model=PracticeQuestion)
def question(
    exclude: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PracticeQuestion:
    # A single question to practise, drawn from the student's own likely questions when
    # they have them, otherwise the common bank. No interview is created.
    profile = _get_or_create(db, current_user)
    return PracticeQuestion(
        question=practice.pick_question(_likely_questions(profile.prep_questions), exclude)
    )


@router.post("/answer", response_model=AnswerNote)
@limiter.limit(settings.llm_rate_limit)
def answer(
    request: Request,
    data: PracticeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnswerNote:
    try:
        return practice.assess(data.question, data.answer)
    except Exception as exc:
        logger.exception("practice assessment failed")
        raise HTTPException(
            status_code=502,
            detail="Your answer could not be assessed just now. Please try again in a moment.",
        ) from exc
