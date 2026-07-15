from pydantic import BaseModel


class PrepQuestion(BaseModel):
    question: str
    rationale: str = ""


class PrepResponse(BaseModel):
    questions: list[PrepQuestion]
