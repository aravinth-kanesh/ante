from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="active")  # active | finished
    mode: Mapped[str] = mapped_column(String, default="text")  # text | voice
    interview_type: Mapped[str] = mapped_column(String, default="general")
    company: Mapped[str] = mapped_column(String, default="")  # snapshot, for the session title
    role: Mapped[str] = mapped_column(String, default="")
    cv_snapshot: Mapped[str] = mapped_column(Text, default="")
    jd_snapshot: Mapped[str] = mapped_column(Text, default="")
    company_context_snapshot: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped[User] = relationship()
    turns: Mapped[list["Turn"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Turn.index",
    )


class Turn(Base):
    __tablename__ = "turns"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("interview_sessions.id"), index=True)
    index: Mapped[int] = mapped_column()
    role: Mapped[str] = mapped_column(String)  # interviewer | candidate
    kind: Mapped[str] = mapped_column(String)  # question | answer | feedback
    content: Mapped[str] = mapped_column(Text)
    metrics: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON delivery metrics on spoken answers
    nonverbal: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON nonverbal metrics on webcam answers
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    session: Mapped[InterviewSession] = relationship(back_populates="turns")
