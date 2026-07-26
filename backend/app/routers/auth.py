from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.cv import CV
from app.models.session import InterviewSession
from app.models.user import User
from app.ratelimit import limiter
from app.schemas.auth import LoginRequest, Token, UserCreate, UserRead
from app.security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.auth_rate_limit)
def signup(request: Request, data: UserCreate, db: Session = Depends(get_db)) -> Token:
    existing = db.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=data.email, hashed_password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(user.id))


@router.post("/login", response_model=Token)
@limiter.limit(settings.auth_rate_limit)
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.scalar(select(User).where(User.email == data.email))
    if user is None or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )
    return Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    """Permanently delete the account and all of its data (right to erasure)."""
    # Interview sessions cascade to their turns via the ORM relationship.
    for session in db.query(InterviewSession).filter_by(user_id=current_user.id).all():
        db.delete(session)
    db.query(CV).filter_by(user_id=current_user.id).delete()
    if current_user.profile is not None:
        db.delete(current_user.profile)
    db.delete(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
