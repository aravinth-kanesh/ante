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


class NonverbalSample(BaseModel):
    """One sampled video frame's derived signals, extracted in the browser."""

    face_detected: bool = False
    yaw: float = 0.0  # head rotation in degrees, 0 = facing the camera
    pitch: float = 0.0
    roll: float = 0.0
    eyes_open: bool = True
    smile: float = 0.0  # mean smile blendshape, 0..1
    pose_detected: bool = False
    shoulder_tilt: float | None = None  # degrees off level, None when no pose


class AnalyseRequest(BaseModel):
    samples: list[NonverbalSample]


class NonverbalMetrics(BaseModel):
    """How the candidate presented on camera, aggregated from sampled frames."""

    frames_analysed: int
    face_detected: bool
    eye_contact_pct: int
    head_steadiness: int  # 0..100, higher is steadier
    steadiness_label: str
    smile_pct: int | None = None  # None when expression analysis is off or no face
    posture_pct: int | None = None  # None when no pose was detected

    def summary(self) -> str:
        """A short British English sentence for the feedback prompt and the UI."""
        if not self.face_detected:
            return "No face was clearly detected on camera."
        clauses = [
            f"appeared to look at the camera about {self.eye_contact_pct}% of the time",
            f"held a {self.steadiness_label} head position",
        ]
        if self.posture_pct is not None:
            clauses.append(f"kept fairly level posture ({self.posture_pct}% of frames)")
        if self.smile_pct is not None:
            clauses.append(f"appeared to smile in {self.smile_pct}% of frames")
        if len(clauses) == 1:
            body = clauses[0]
        else:
            body = ", ".join(clauses[:-1]) + ", and " + clauses[-1]
        return "The candidate " + body + "."


class AnswerRequest(BaseModel):
    answer: str
    metrics: DeliveryMetrics | None = None
    nonverbal: NonverbalMetrics | None = None


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
