from pydantic import BaseModel


class PrepQuestion(BaseModel):
    question: str
    rationale: str = ""


class PrepGroup(BaseModel):
    category: str
    questions: list[PrepQuestion]


class PrepResponse(BaseModel):
    groups: list[PrepGroup]
