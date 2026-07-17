from pydantic import BaseModel


class ProfileUpdate(BaseModel):
    cv_text: str = ""
    jd_text: str = ""


class ProfileRead(BaseModel):
    cv_text: str
    cv_filename: str = ""
    jd_text: str

    model_config = {"from_attributes": True}


class ResearchRead(BaseModel):
    company: str
    role: str
    company_context: str

    model_config = {"from_attributes": True}
