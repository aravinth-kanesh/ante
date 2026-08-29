from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.saved import SavedAnswer
from app.models.user import User
from app.schemas.saved import SavedAnswerCreate, SavedAnswerRead
from app.security import get_current_user

router = APIRouter(prefix="/saved-answers", tags=["saved"])


@router.get("", response_model=list[SavedAnswerRead])
def list_saved(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[SavedAnswer]:
    return (
        db.query(SavedAnswer)
        .filter(SavedAnswer.user_id == current_user.id)
        .order_by(SavedAnswer.created_at.desc(), SavedAnswer.id.desc())
        .all()
    )


@router.post("", response_model=SavedAnswerRead)
def create_saved(
    data: SavedAnswerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SavedAnswer:
    answer = SavedAnswer(
        user_id=current_user.id, question=data.question.strip(), answer=data.answer.strip()
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


@router.delete("/{answer_id}")
def delete_saved(
    answer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    answer = db.get(SavedAnswer, answer_id)
    if answer is None or answer.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Saved answer not found")
    db.delete(answer)
    db.commit()
    return {"ok": True}
