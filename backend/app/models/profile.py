from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    cv_text: Mapped[str] = mapped_column(Text, default="")  # mirror of the active CV's text
    cv_filename: Mapped[str] = mapped_column(String, default="")
    selected_cv_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    jd_text: Mapped[str] = mapped_column(Text, default="")
    company: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="")
    company_context: Mapped[str] = mapped_column(Text, default="")  # rendered text for prompts
    company_research: Mapped[str] = mapped_column(Text, default="")  # structured JSON for display
    prep_questions: Mapped[str] = mapped_column(Text, default="")  # last generated questions (JSON)
    preparation: Mapped[str] = mapped_column(Text, default="")  # gap analysis + plan (JSON)
    # Cached coach summary of interview progress; cleared when the interview history
    # changes so it is regenerated on the next visit to the progress page.
    coach_summary: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    user: Mapped[User] = relationship(back_populates="profile")
