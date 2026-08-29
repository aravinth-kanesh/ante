from datetime import datetime

from pydantic import BaseModel, Field

from app.services.cv_parse import MAX_TEXT_CHARS


class CVSummary(BaseModel):
    id: int
    label: str
    filename: str
    created_at: datetime
    selected: bool


class CVRead(CVSummary):
    text: str


class CVCreate(BaseModel):
    label: str = "My CV"
    text: str = Field(max_length=MAX_TEXT_CHARS)


class CVUpdate(BaseModel):
    label: str | None = None
    text: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
