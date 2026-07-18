from pydantic import BaseModel


class StartResponse(BaseModel):
    session_id: int
    question: str


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
    turns: list[TurnRead]
