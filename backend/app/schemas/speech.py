from pydantic import BaseModel, Field


class Voice(BaseModel):
    id: str
    label: str


class VoicesResponse(BaseModel):
    available: bool  # False when the model is not installed; use browser voices
    voices: list[Voice]


class SayRequest(BaseModel):
    text: str = Field(..., max_length=4000)
    voice: str = Field("", max_length=100)
