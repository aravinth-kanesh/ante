from pydantic import BaseModel


class ProfileUpdate(BaseModel):
    cv_text: str = ""
    jd_text: str = ""


class ProfileRead(BaseModel):
    cv_text: str
    jd_text: str

    model_config = {"from_attributes": True}
