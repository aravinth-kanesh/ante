from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., max_length=8000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(..., min_length=1, max_length=100)


class ChatResponse(BaseModel):
    reply: str
    blocked: bool = False
