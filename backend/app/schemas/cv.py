from datetime import datetime

from pydantic import BaseModel


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
    text: str


class CVUpdate(BaseModel):
    label: str | None = None
    text: str | None = None
