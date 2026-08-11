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
from app.services.dedupe import deduped
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


def _recurring(sessions: list[InterviewSession], field: str, cap: int = 5) -> list[str]:
    """The distinct recurring points from the most recent interviews' feedback.

    Bullets are collapsed across interviews with an aggressive similarity threshold so
    a theme that keeps coming up (for example "use the STAR structure") appears once,
    not once per interview.
    """
    collected: list[str] = []
    for session in list(reversed(sessions))[:3]:  # the last three interviews, newest first
        report = _feedback(session)
        if report is not None:
            collected.extend(getattr(report, field))
    return deduped(collected, threshold=0.5)[:cap]


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
        focus_areas=_recurring(sessions, "improvements"),
        strengths=_recurring(sessions, "strengths"),
    )
