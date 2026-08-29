from pydantic import BaseModel, Field


class PracticeQuestion(BaseModel):
    question: str


class PracticeRequest(BaseModel):
    question: str = Field(max_length=500)
    answer: str = Field("", max_length=20000)
