"""Turn a student's past interviews into progress trends, computed on read.

Everything here is pure and deterministic: it parses the metrics and feedback already
stored on each interview's turns and aggregates them. There is no model call and no
new storage. The headline signal is the share of answers rated strong, which is
available for every interview (including typed ones); speaking and on-camera metrics
are only reported when they were actually measured.
"""

from app.models.session import InterviewSession
from app.schemas.interview import DeliveryMetrics, NonverbalMetrics
from app.schemas.progress import MetricDelta, ProgressReport, SessionStats, Totals, Verdicts
from app.services.interview import parse_feedback, session_title

# Metric identifier -> the SessionStats attribute holding it.
_ATTR = {
    "strong_rate": "strong_rate",
    "wpm": "avg_wpm",
    "filler_per_min": "filler_per_min",
    "eye_contact_pct": "eye_contact_pct",
    "head_steadiness": "head_steadiness",
}
_LABELS = {
    "strong_rate": "Strong-answer rate",
    "wpm": "Speaking pace",
    "filler_per_min": "Filler words",
    "eye_contact_pct": "Eye contact",
    "head_steadiness": "Head steadiness",
}
# A gentle "good" range shown to the student for context, not a hard target.
_GOOD_RANGE = {
    "strong_rate": (0.5, 1.0),  # aim for at least half of answers rated strong
    "wpm": (110.0, 160.0),  # a comfortable spoken pace
    "filler_per_min": (0.0, 3.0),  # few filler words
    "eye_contact_pct": (60.0, 100.0),  # look at the camera most of the time
    "head_steadiness": (60.0, 100.0),  # hold a fairly steady position
}
# Change within this counts as "steady" rather than improved or slipped.
_TOLERANCE = {
    "strong_rate": 0.05,
    "wpm": 5.0,
    "filler_per_min": 0.5,
    "eye_contact_pct": 5.0,
    "head_steadiness": 5.0,
}
_LOWER_IS_BETTER = {"filler_per_min"}
# Plain formatting of each metric value, for the coach summary's input.
_FORMAT = {
    "strong_rate": lambda v: f"{round(v * 100)}%",
    "wpm": lambda v: f"{round(v)} words per minute",
    "filler_per_min": lambda v: f"{v:.1f} filler words a minute",
    "eye_contact_pct": lambda v: f"{round(v)}%",
    "head_steadiness": lambda v: f"{round(v)} out of 100",
}
_TREND_WORDS = {
    "improved": "improving",
    "slipped": "slipped back",
    "steady": "about the same",
    "na": "not enough data yet",
}


def describe(report: ProgressReport) -> str:
    """A plain-text digest of a progress report, for the coach summary prompt. Pure."""
    lines = [
        f"Interviews completed: {report.totals.interviews}.",
        f"Questions answered: {report.totals.questions_answered}.",
        f"Minutes of spoken practice: {report.totals.minutes_practised}.",
    ]
    for delta in report.deltas:
        if delta.latest is None:
            continue
        fmt = _FORMAT.get(delta.metric, str)
        note = f"{delta.label}: now {fmt(delta.latest)}, {_TREND_WORDS.get(delta.direction, delta.direction)}"
        if delta.first is not None and delta.direction in ("improved", "slipped"):
            note += f" (from {fmt(delta.first)})"
        if delta.good_low is not None and delta.good_high is not None:
            if delta.latest < delta.good_low:
                note += "; below the good range"
            elif delta.latest > delta.good_high:
                note += "; above the good range"
            else:
                note += "; within the good range"
        lines.append(note + ".")
    if report.focus_areas:
        lines.append("Recurring things to work on: " + "; ".join(report.focus_areas) + ".")
    if report.strengths:
        lines.append("Recurring strengths: " + "; ".join(report.strengths) + ".")
    return "\n".join(lines)


def _parse(model, raw: str | None):
    if not raw:
        return None
    try:
        return model.model_validate_json(raw)
    except ValueError:
        return None


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _deliveries(session: InterviewSession) -> list[DeliveryMetrics]:
    out = []
    for turn in session.turns:
        if turn.kind != "answer":
            continue
        metrics = _parse(DeliveryMetrics, turn.metrics)
        if metrics and metrics.word_count > 0:
            out.append(metrics)
    return out


def _nonverbals(session: InterviewSession) -> list[NonverbalMetrics]:
    out = []
    for turn in session.turns:
        if turn.kind != "answer":
            continue
        nv = _parse(NonverbalMetrics, turn.nonverbal)
        if nv and nv.face_detected:
            out.append(nv)
    return out


def _feedback(session: InterviewSession):
    turn = next((t for t in session.turns if t.kind == "feedback"), None)
    return parse_feedback(turn.content) if turn else None


def session_stats(session: InterviewSession) -> SessionStats:
    answered = sum(1 for t in session.turns if t.kind == "answer")
    deliveries = _deliveries(session)
    nonverbals = _nonverbals(session)

    avg_wpm = round(_mean([d.wpm for d in deliveries])) if deliveries else None
    spoken_sec = sum(d.duration_sec for d in deliveries)
    fillers = sum(d.filler_count for d in deliveries)
    filler_per_min = round(fillers / (spoken_sec / 60), 1) if spoken_sec > 0 else None

    eye = round(_mean([n.eye_contact_pct for n in nonverbals])) if nonverbals else None
    steady = round(_mean([n.head_steadiness for n in nonverbals])) if nonverbals else None

    verdicts = Verdicts()
    strong_rate = None
    report = _feedback(session)
    if report is not None:
        counts = {"strong": 0, "adequate": 0, "weak": 0}
        for note in report.answer_notes:
            if note.verdict in counts:
                counts[note.verdict] += 1
        verdicts = Verdicts(**counts)
        total = counts["strong"] + counts["adequate"] + counts["weak"]
        if total:
            strong_rate = round(counts["strong"] / total, 2)

    return SessionStats(
        session_id=session.id,
        created_at=session.created_at,
        interview_type=session.interview_type,
        title=session_title(session.company, session.role, session.interview_type, focus=session.focus),
        answered_count=answered,
        strong_rate=strong_rate,
        verdicts=verdicts,
        avg_wpm=avg_wpm,
        filler_per_min=filler_per_min,
        eye_contact_pct=eye,
        head_steadiness=steady,
        has_delivery=bool(deliveries),
        has_nonverbal=bool(nonverbals),
        confidence_before=session.confidence_before or None,
        confidence_after=session.confidence_after or None,
    )


def _direction(metric: str, first: float, latest: float) -> str:
    change = latest - first
    if abs(change) <= _TOLERANCE[metric]:
        return "steady"
    improved = (change > 0) != (metric in _LOWER_IS_BETTER)
    return "improved" if improved else "slipped"


def _metric_delta(metric: str, series: list[float]) -> MetricDelta:
    first, latest = series[0], series[-1]
    direction = _direction(metric, first, latest) if len(series) >= 2 else "na"
    low, high = _GOOD_RANGE[metric]
    return MetricDelta(
        metric=metric,
        label=_LABELS[metric],
        first=first,
        latest=latest,
        direction=direction,
        lower_is_better=metric in _LOWER_IS_BETTER,
        good_low=low,
        good_high=high,
    )


# Progress is the broad, longitudinal view, so its "keep working on" and "you do this
# well" points are derived from the measured metrics rather than from per-interview
# feedback text (which is tied to a specific company, role and technology). Each metric
# maps to general, transferable coaching, shown only when the latest figure is outside
# its good range. Answer quality expands into two technique points because a low strong-
# answer rate almost always comes down to structure and answering the question.
_FOCUS_ORDER = ["strong_rate", "filler_per_min", "wpm", "eye_contact_pct", "head_steadiness"]
_FOCUS = {
    "strong_rate": {
        "below": [
            "Aim for more of your answers to land as strong: give a specific example with "
            "a clear outcome, structured as Situation, Task, Action and Result.",
            "Answer the question that was actually asked before adding extra detail, so "
            "each answer stays on point.",
        ]
    },
    "filler_per_min": {
        "above": [
            "Cut down on filler words like 'um'; aim for under about three a minute, and "
            "pause instead when you need a moment to think.",
        ]
    },
    "wpm": {
        "above": ["Slow your speaking pace a little; a comfortable range is about 110 to 160 words a minute."],
        "below": ["Lift your speaking pace a little; a comfortable range is about 110 to 160 words a minute."],
    },
    "eye_contact_pct": {
        "below": ["Look at the camera more of the time so you come across as engaged and confident."],
    },
    "head_steadiness": {
        "below": ["Keep a steadier, more settled posture on camera to look composed."],
    },
}
_WINS = {
    "strong_rate": "A good share of your answers are landing as strong.",
    "filler_per_min": "You keep filler words low, which sounds assured.",
    "wpm": "Your speaking pace is comfortable and easy to follow.",
    "eye_contact_pct": "You hold good eye contact with the camera.",
    "head_steadiness": "You keep a steady, composed posture on camera.",
}


def _focus_areas(deltas: list[MetricDelta]) -> list[str]:
    """General, data-driven things to work on, from the metrics that are out of range."""
    by = {d.metric: d for d in deltas}
    focus: list[str] = []
    for metric in _FOCUS_ORDER:
        d = by.get(metric)
        if d is None or d.latest is None or d.good_low is None or d.good_high is None:
            continue
        if d.latest > d.good_high and "above" in _FOCUS[metric]:
            focus.extend(_FOCUS[metric]["above"])
        elif d.latest < d.good_low and "below" in _FOCUS[metric]:
            focus.extend(_FOCUS[metric]["below"])
    return focus[:5]


def _strengths(deltas: list[MetricDelta]) -> list[str]:
    """General strengths, from the metrics that sit within their good range."""
    by = {d.metric: d for d in deltas}
    wins: list[str] = []
    for metric in _FOCUS_ORDER:
        d = by.get(metric)
        if d is None or d.latest is None or d.good_low is None or d.good_high is None:
            continue
        if d.good_low <= d.latest <= d.good_high:
            wins.append(_WINS[metric])
    return wins[:5]


def build_report(sessions: list[InterviewSession]) -> ProgressReport:
    """Build the report from the user's usable interviews, oldest first."""
    stats = [session_stats(s) for s in sessions]

    minutes = round(sum(sum(d.duration_sec for d in _deliveries(s)) for s in sessions) / 60)
    totals = Totals(
        interviews=len(stats),
        questions_answered=sum(s.answered_count for s in stats),
        minutes_practised=minutes,
    )

    deltas = []
    for metric, attr in _ATTR.items():
        series = [getattr(s, attr) for s in stats if getattr(s, attr) is not None]
        if series:  # only show metrics that were measured at least once
            deltas.append(_metric_delta(metric, series))

    return ProgressReport(
        totals=totals,
        sessions=stats,
        deltas=deltas,
        focus_areas=_focus_areas(deltas),
        strengths=_strengths(deltas),
    )
