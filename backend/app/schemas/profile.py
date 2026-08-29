from pydantic import BaseModel, Field

from app.services.cv_parse import MAX_TEXT_CHARS


class ProfileUpdate(BaseModel):
    cv_text: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)  # None leaves the active CV untouched
    jd_text: str = Field(default="", max_length=MAX_TEXT_CHARS)


class ProfileRead(BaseModel):
    cv_text: str
    cv_filename: str = ""
    jd_text: str

    model_config = {"from_attributes": True}


class Source(BaseModel):
    """A web result the briefing drew on, so a student can judge and dig further."""

    title: str = ""
    url: str = ""


class CompanyResearch(BaseModel):
    """Structured company briefing for a candidate."""

    overview: str = ""
    interview_process: str = ""
    technical_skills: list[str] = []
    soft_skills: list[str] = []
    skills: list[str] = []  # legacy: research saved before skills were split
    tips: list[str] = []
    sources: list[Source] = []  # web results the briefing was grounded in (when web search is on)


class ResearchRead(BaseModel):
    company: str = ""
    role: str = ""
    research: CompanyResearch | None = None
