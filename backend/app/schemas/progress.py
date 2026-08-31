from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class Verdicts(BaseModel):
    """How many answers in a session were rated strong / adequate / weak."""

    strong: int = 0
    adequate: int = 0
    weak: int = 0


class SessionStats(BaseModel):
    """One interview, reduced to the numbers a student can track over time.

    Metric fields are None when nothing was measured (for example a typed interview
    has no speaking pace, and a session with the camera off has no eye contact), so
    the UI can hide what does not apply rather than showing a misleading zero.
    """

    session_id: int
    created_at: datetime
    interview_type: str
    title: str
    answered_count: int
    # Answer quality is available for every interview, including typed ones.
    strong_rate: float | None = None  # share of answers rated strong, 0..1
    verdicts: Verdicts = Verdicts()
    # Delivery (voice interviews only).
    avg_wpm: int | None = None
    filler_per_min: float | None = None
    # On camera (webcam interviews only).
    eye_contact_pct: int | None = None
    head_steadiness: int | None = None
    has_delivery: bool = False
    has_nonverbal: bool = False
    # Self-rated confidence, 1 to 5; None when the student did not rate it.
    confidence_before: int | None = None
    confidence_after: int | None = None


class MetricDelta(BaseModel):
    """First-to-latest change in one metric, with the good range for context."""

    metric: str
    label: str
    first: float | None = None
    latest: float | None = None
    direction: Literal["improved", "steady", "slipped", "na"]
    lower_is_better: bool = False
    good_low: float | None = None
    good_high: float | None = None


class Totals(BaseModel):
    interviews: int = 0
    questions_answered: int = 0
    minutes_practised: int = 0  # spoken audio for voice answers, estimated from length for typed ones


class ProgressReport(BaseModel):
    totals: Totals = Totals()
    sessions: list[SessionStats] = []  # chronological; the per-metric trend series
    deltas: list[MetricDelta] = []
    focus_areas: list[str] = []  # recurring things to work on, from past feedback
    strengths: list[str] = []


class ProgressSummary(BaseModel):
    summary: str
