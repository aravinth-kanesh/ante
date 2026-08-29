from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Mode = Literal["text", "voice"]
InterviewType = Literal["general", "behavioural", "competency", "technical", "strengths"]
Difficulty = Literal["gentle", "standard", "stretch"]
# What the interview is steered towards: a balanced interview, the candidate's weak
# competencies from the gap analysis, or their generated likely questions.
Focus = Literal["balanced", "gaps", "questions"]


class StartRequest(BaseModel):
    mode: Mode = "text"
    interview_type: InterviewType = "general"
    focus: Focus = "balanced"
    # When focusing on likely questions, optionally narrow to a single category.
    category: str = Field("", max_length=100)
    # Start from a built-in sample CV and role instead of the user's profile (a no-setup
    # way to try the app).
    sample: bool = False
    # The candidate's chosen interview length, a soft target in minutes.
    duration_target_min: Literal[5, 10, 15, 20, 25, 30] = 10
    # How demanding the interviewer should be.
    difficulty: Difficulty = "standard"


class StartResponse(BaseModel):
    session_id: int
    question: str
    mode: Mode
    interview_type: InterviewType
    duration_target_min: int


class ActiveExchange(BaseModel):
    question: str
    answer: str


class ActiveInterview(BaseModel):
    """Enough to rehydrate an interview left unfinished, so a refresh or closed tab does
    not strand a student mid-practice."""

    session_id: int
    mode: Mode
    interview_type: InterviewType
    duration_target_min: int
    is_sample: bool = False
    # the current unanswered question, or null if the interviewer has finished asking
    question: str | None = None
    history: list[ActiveExchange] = []


class PauseEvent(BaseModel):
    """A silent gap in an answer, in seconds from the start of the recording."""

    start: float
    end: float
    long: bool = False


class FillerEvent(BaseModel):
    """A filler word and when it was said, in seconds from the start of the recording."""

    time: float
    text: str


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
    # Time-coded events for the annotated replay; default empty so older stored
    # metrics (saved before this field existed) still parse.
    pauses: list[PauseEvent] = []
    filler_events: list[FillerEvent] = []

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
    t: float = 0.0  # seconds from the start of the recording (0 from older clients)


class AnalyseRequest(BaseModel):
    samples: list[NonverbalSample] = Field(..., max_length=5000)


class NonverbalTick(BaseModel):
    """A one-second summary of the webcam for the replay overlay."""

    t: float  # seconds from the start of the recording
    eye_contact: bool  # facing the camera for most of this second


class NonverbalMetrics(BaseModel):
    """How the candidate presented on camera, aggregated from sampled frames."""

    frames_analysed: int
    face_detected: bool
    eye_contact_pct: int
    head_steadiness: int  # 0..100, higher is steadier
    steadiness_label: str
    smile_pct: int | None = None  # None when expression analysis is off or no face
    posture_pct: int | None = None  # None when no pose was detected
    # A ~1 Hz timeline for the replay overlay; empty when timing was not available.
    timeline: list[NonverbalTick] = []

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
    answer: str = Field("", max_length=20000)
    metrics: DeliveryMetrics | None = None
    nonverbal: NonverbalMetrics | None = None


class AnswerResponse(BaseModel):
    question: str | None = None
    done: bool = False


class AnswerNote(BaseModel):
    question: str
    verdict: Literal["strong", "adequate", "weak"]
    comment: str
    # A short example of how a strong answer might sound; empty for an already-strong one.
    model_answer: str = ""


class FeedbackReport(BaseModel):
    """Structured interview feedback. Lists may be empty when nothing applies."""

    summary: str
    strengths: list[str] = []
    improvements: list[str] = []
    answer_notes: list[AnswerNote] = []
    delivery: str = ""


class FeedbackResponse(BaseModel):
    feedback: FeedbackReport


class TurnRead(BaseModel):
    role: str
    kind: str
    content: str
    metrics: DeliveryMetrics | None = None
    nonverbal: NonverbalMetrics | None = None


class TranscriptResponse(BaseModel):
    status: str
    mode: Mode
    interview_type: InterviewType
    focus: str = ""  # "", "gaps" or "questions"
    company: str = ""
    role: str = ""
    feedback: FeedbackReport | None = None
    reflection: str = ""
    turns: list[TurnRead]


class ReflectionUpdate(BaseModel):
    text: str = Field("", max_length=5000)


class SessionSummary(BaseModel):
    id: int
    mode: Mode
    interview_type: InterviewType
    focus: str = ""  # "", "gaps" or "questions"
    status: str
    created_at: datetime
    question_count: int
    title: str
    preview: str
    is_sample: bool = False
