from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.star import StarStory
from app.models.user import User
from app.schemas.star import StarStoryRead, StarStoryWrite
from app.security import get_current_user

router = APIRouter(prefix="/stars", tags=["stars"])


def _owned(db: Session, story_id: int, user: User) -> StarStory:
    story = db.get(StarStory, story_id)
    if story is None or story.user_id != user.id:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.get("", response_model=list[StarStoryRead])
def list_stories(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[StarStory]:
    return (
        db.query(StarStory)
        .filter(StarStory.user_id == current_user.id)
        .order_by(StarStory.updated_at.desc(), StarStory.id.desc())
        .all()
    )


@router.post("", response_model=StarStoryRead)
def create_story(
    data: StarStoryWrite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStory:
    story = StarStory(
        user_id=current_user.id,
        title=data.title.strip(),
        situation=data.situation.strip(),
        task=data.task.strip(),
        action=data.action.strip(),
        result=data.result.strip(),
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return story


@router.put("/{story_id}", response_model=StarStoryRead)
def update_story(
    story_id: int,
    data: StarStoryWrite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StarStory:
    story = _owned(db, story_id, current_user)
    story.title = data.title.strip()
    story.situation = data.situation.strip()
    story.task = data.task.strip()
    story.action = data.action.strip()
    story.result = data.result.strip()
    db.commit()
    db.refresh(story)
    return story


@router.delete("/{story_id}")
def delete_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    story = _owned(db, story_id, current_user)
    db.delete(story)
    db.commit()
    return {"ok": True}
