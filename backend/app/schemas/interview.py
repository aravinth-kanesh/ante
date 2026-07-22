from typing import Literal

from pydantic import BaseModel

Mode = Literal["text", "voice"]


class StartRequest(BaseModel):
    mode: Mode = "text"


class StartResponse(BaseModel):
    session_id: int
    question: str
    mode: Mode


class DeliveryMetrics(BaseModel):
    """How the candidate spoke an answer, measured from the audio."""

    duration_sec: float
    word_count: int
    wpm: int
    pause_count: int
    long_pause_count: int
    total_pause_sec: float
    filler_count: int
    fillers: dict[str, int]

    def summary(self) -> str:
        """A short British English sentence for the feedback prompt and the UI."""
        if self.word_count == 0:
            return "No speech was detected in this answer."
        sentence = (
            f"Spoke at about {self.wpm} words per minute over "
            f"{self.duration_sec:.0f} seconds"
        )
        extras: list[str] = []
        if self.pause_count:
            pause = f"{self.pause_count} noticeable pause{'s' if self.pause_count != 1 else ''}"
            if self.long_pause_count:
                pause += f" ({self.long_pause_count} long)"
            extras.append(pause)
        if self.filler_count:
            top = sorted(self.fillers.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
            listed = ", ".join(f"'{word}' x{count}" for word, count in top)
            extras.append(
                f"{self.filler_count} filler word{'s' if self.filler_count != 1 else ''} ({listed})"
            )
        if extras:
            sentence += ", with " + " and ".join(extras)
        return sentence + "."


class TranscribeResponse(BaseModel):
    transcript: str
    metrics: DeliveryMetrics


class AnswerRequest(BaseModel):
    answer: str
    metrics: DeliveryMetrics | None = None


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
