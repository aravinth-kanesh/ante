from typing import Literal

from pydantic import BaseModel

Mode = Literal["text", "voice"]


class StartRequest(BaseModel):
    mode: Mode = "text"


class StartResponse(BaseModel):
    session_id: int
    question: str
    mode: Mode


class AnswerRequest(BaseModel):
    answer: str


class AnswerResponse(BaseModel):
    question: str | None = None
    done: bool = False


class FeedbackResponse(BaseModel):
    feedback: str


class TurnRead(BaseModel):
    role: str
    kind: str
    content: str

    model_config = {"from_attributes": True}


class TranscriptResponse(BaseModel):
    status: str
    mode: Mode
    turns: list[TurnRead]
