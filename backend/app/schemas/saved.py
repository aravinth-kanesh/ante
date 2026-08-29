from datetime import datetime

from pydantic import BaseModel, Field


class SavedAnswerRead(BaseModel):
    id: int
    question: str
    answer: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SavedAnswerCreate(BaseModel):
    question: str = Field("", max_length=500)
    answer: str = Field(max_length=4000)
