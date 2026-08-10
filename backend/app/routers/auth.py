import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.cv import CV
from app.models.onetime import OneTimeToken
from app.models.session import InterviewSession
from app.models.user import User
from app.db import get_db
from app.ratelimit import limiter
from app.schemas.auth import (
    AuthConfig,
    ChangePasswordRequest,
    EmailRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
    UserCreate,
    UserRead,
    VerifyRequest,
)
from app.security import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    create_access_token,
    generate_csrf_token,
    get_current_user,
    hash_password,
    set_auth_cookies,
    verify_password,
)
from app.services import email, onetime, passwords, session_media, sessions

router = APIRouter(prefix="/auth", tags=["auth"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _establish_session(db: Session, response: Response, user: User, request: Request) -> None:
    """Issue an access token, a refresh session and a CSRF token as cookies."""
    refresh_token = sessions.issue(db, user.id, request)
    set_auth_cookies(response, create_access_token(user.id), refresh_token, generate_csrf_token())


def _send_verification(db: Session, user: User) -> None:
    raw = onetime.issue(db, user.id, onetime.VERIFY, settings.verification_token_expire_hours)
    email.send_verification(user.email, f"{settings.app_base_url}/verify?token={raw}")


@router.get("/config", response_model=AuthConfig)
def auth_config() -> AuthConfig:
    """Public flags the frontend needs before login (whether verification is on)."""
    return AuthConfig(verification_required=settings.email_verification_required)


@router.post("/signup", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.auth_rate_limit)
def signup(request: Request, response: Response, data: UserCreate, db: Session = Depends(get_db)) -> User:
    if db.scalar(select(User).where(User.email == data.email)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    if passwords.is_breached(data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password has appeared in a known data breach. Please choose a different one.",
        )

    required = settings.email_verification_required
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        is_verified=not required,
        consented_at=_utcnow() if data.consent else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if required:
        # Do not log the user in until they confirm the address; email a link instead.
        _send_verification(db, user)
    else:
        _establish_session(db, response, user, request)
    return user


@router.post("/login", response_model=UserRead)
@limiter.limit(settings.auth_rate_limit)
def login(request: Request, response: Response, data: LoginRequest, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == data.email))

    if user is not None and user.locked_until is not None and _aware(user.locked_until) > _utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account temporarily locked after too many failed attempts. Try again later.",
        )

    if user is None or not verify_password(data.password, user.hashed_password):
        if user is not None:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.max_failed_logins:
                user.locked_until = _utcnow() + timedelta(minutes=settings.lockout_minutes)
                user.failed_login_count = 0
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account is disabled")
    if settings.email_verification_required and not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before signing in",
        )

    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    _establish_session(db, response, user, request)
    return user


@router.post("/verify", response_model=UserRead)
@limiter.limit(settings.auth_rate_limit)
def verify(request: Request, response: Response, data: VerifyRequest, db: Session = Depends(get_db)) -> User:
    user_id = onetime.consume(db, data.token, onetime.VERIFY)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link"
        )
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link")
    user.is_verified = True
    db.commit()
    _establish_session(db, response, user, request)  # log them in now that the email is confirmed
    return user


@router.post("/resend-verification", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.auth_rate_limit)
def resend_verification(request: Request, data: EmailRequest, db: Session = Depends(get_db)) -> None:
    # Unauthenticated and enumeration-safe: a user blocked at login (no session) can
    # still request a fresh link, and the response never reveals whether the address
    # is registered.
    user = db.scalar(select(User).where(User.email == data.email))
    if user is not None and not user.is_verified:
        _send_verification(db, user)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.auth_rate_limit)
def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)) -> None:
    # Always return the same response so the endpoint cannot be used to probe for
    # registered email addresses.
    user = db.scalar(select(User).where(User.email == data.email))
    if user is not None:
        raw = onetime.issue(db, user.id, onetime.RESET, settings.reset_token_expire_hours)
        email.send_password_reset(user.email, f"{settings.app_base_url}/reset-password?token={raw}")


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit(settings.auth_rate_limit)
def reset_password(request: Request, data: ResetPasswordRequest, db: Session = Depends(get_db)) -> None:
    if passwords.is_breached(data.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password has appeared in a known data breach. Please choose a different one.",
        )
    user_id = onetime.consume(db, data.token, onetime.RESET)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link")
    user.hashed_password = hash_password(data.password)
    user.password_changed_at = _utcnow()
    user.is_verified = True  # completing a reset proves control of the mailbox
    user.failed_login_count = 0
    user.locked_until = None
    sessions.revoke_all(db, user.id)  # sign out every existing session
    db.commit()


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    request: Request,
    response: Response,
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if passwords.is_breached(data.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password has appeared in a known data breach. Please choose a different one.",
        )
    current_user.hashed_password = hash_password(data.new_password)
    current_user.password_changed_at = _utcnow()
    db.commit()
    # Invalidate every session, then re-establish this one so the current browser
    # stays signed in while other devices are logged out.
    sessions.revoke_all(db, current_user.id)
    _establish_session(db, response, current_user, request)


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


@router.get("/export")
def export_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    """Return everything held about the account as JSON (right to data portability)."""
    profile = current_user.profile
    data = {
        "account": {
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "is_verified": current_user.is_verified,
        },
        "profile": None
        if profile is None
        else {
            "cv_text": profile.cv_text,
            "cv_filename": profile.cv_filename,
            "jd_text": profile.jd_text,
            "company": profile.company,
            "role": profile.role,
            "company_context": profile.company_context,
            "company_research": profile.company_research,
            "prep_questions": profile.prep_questions,
            "preparation": profile.preparation,
        },
        "cvs": [
            {"label": cv.label, "filename": cv.filename, "text": cv.text,
             "created_at": cv.created_at.isoformat() if cv.created_at else None}
            for cv in db.query(CV).filter_by(user_id=current_user.id).all()
        ],
        "interviews": [
            {
                "id": s.id,
                "interview_type": s.interview_type,
                "mode": s.mode,
                "status": s.status,
                "company": s.company,
                "role": s.role,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "turns": [
                    {"index": t.index, "role": t.role, "kind": t.kind, "content": t.content,
                     "metrics": t.metrics, "nonverbal": t.nonverbal}
                    for t in s.turns
                ],
            }
            for s in db.query(InterviewSession).filter_by(user_id=current_user.id).all()
        ],
    }
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=ante-data.json"},
    )


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Permanently delete the account and all of its data (right to erasure)."""
    sessions.delete_all(db, current_user.id)
    db.query(OneTimeToken).filter_by(user_id=current_user.id).delete()
    # Interview sessions cascade to their turns via the ORM relationship; any answer
    # recordings held on disk for those sessions are purged too.
    for session in db.query(InterviewSession).filter_by(user_id=current_user.id).all():
        session_media.purge(session.id)
        db.delete(session)
    db.query(CV).filter_by(user_id=current_user.id).delete()
    if current_user.profile is not None:
        db.delete(current_user.profile)
    db.delete(current_user)
    db.commit()
    clear_auth_cookies(response)
