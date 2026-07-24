from pydantic import BaseModel


class Voice(BaseModel):
    id: str
    label: str


class VoicesResponse(BaseModel):
    available: bool  # False when the model is not installed; use browser voices
    voices: list[Voice]


class SayRequest(BaseModel):
    text: str
    voice: str = ""
