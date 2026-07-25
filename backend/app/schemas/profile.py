from pydantic import BaseModel


class ProfileUpdate(BaseModel):
    cv_text: str | None = None  # None leaves the active CV untouched
    jd_text: str = ""


class ProfileRead(BaseModel):
    cv_text: str
    cv_filename: str = ""
    jd_text: str

    model_config = {"from_attributes": True}


class CompanyResearch(BaseModel):
    """Structured company briefing for a candidate."""

    overview: str = ""
    interview_process: str = ""
    skills: list[str] = []
    tips: list[str] = []


class ResearchRead(BaseModel):
    company: str = ""
    role: str = ""
    research: CompanyResearch | None = None
