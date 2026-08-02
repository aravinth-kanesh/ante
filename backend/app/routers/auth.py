from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.cv import CV
from app.models.session import InterviewSession
from app.models.user import User
from app.ratelimit import limiter
from app.schemas.auth import LoginRequest, UserCreate, UserRead
from app.security import (
    clear_auth_cookies,
    create_access_token,
    generate_csrf_token,
    get_current_user,
    hash_password,
    set_auth_cookies,
    verify_password,
    REFRESH_COOKIE,
)
from app.services import sessions

router = APIRouter(prefix="/auth", tags=["auth"])


def _establish_session(db: Session, response: Response, user: User, request: Request) -> None:
    """Issue an access token, a refresh session and a CSRF token as cookies."""
    refresh_token = sessions.issue(db, user.id, request)
    set_auth_cookies(response, create_access_token(user.id), refresh_token, generate_csrf_token())


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.auth_rate_limit)
def signup(request: Request, response: Response, data: UserCreate, db: Session = Depends(get_db)) -> User:
    existing = db.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(email=data.email, hashed_password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _establish_session(db, response, user, request)
    return user


@router.post("/login", response_model=UserRead)
@limiter.limit(settings.auth_rate_limit)
def login(request: Request, response: Response, data: LoginRequest, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == data.email))
    if user is None or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )
    _establish_session(db, response, user, request)
    return user


@router.post("/refresh", status_code=status.HTTP_204_NO_CONTENT)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    """Rotate the refresh session and mint a fresh access token."""
    raw = request.cookies.get(REFRESH_COOKIE)
    result = sessions.rotate(db, raw, request) if raw else None
    if result is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not refresh session")
    user_id, new_refresh = result
    # Set cookies on the injected response so returning None keeps them (returning a
    # fresh Response would drop them).
    set_auth_cookies(response, create_access_token(user_id), new_refresh, generate_csrf_token())


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        sessions.revoke(db, raw)
    clear_auth_cookies(response)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Permanently delete the account and all of its data (right to erasure)."""
    sessions.delete_all(db, current_user.id)
    # Interview sessions cascade to their turns via the ORM relationship.
    for session in db.query(InterviewSession).filter_by(user_id=current_user.id).all():
        db.delete(session)
    db.query(CV).filter_by(user_id=current_user.id).delete()
    if current_user.profile is not None:
        db.delete(current_user.profile)
    db.delete(current_user)
    db.commit()
    clear_auth_cookies(response)
