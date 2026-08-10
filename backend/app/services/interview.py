import json
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.session import InterviewSession, Turn
from app.models.user import User
from app.schemas.interview import DeliveryMetrics, FeedbackReport, NonverbalMetrics
from app.schemas.prepare import PrepResponse
from app.schemas.preparation import PreparationReport
from app.services import llm, moderation
from app.services.dedupe import deduped
from app.services.prompts import FEEDBACK_PROMPT, INTERVIEW_STYLES, INTERVIEWER_PROMPT
from app.services.text import strip_markdown


TYPE_LABELS = {
    "general": "General",
    "behavioural": "Behavioural",
    "competency": "Competency-based",
    "technical": "Technical",
    "strengths": "Strengths-based",
}

# Short suffix shown in session titles when the interview was steered.
FOCUS_LABELS = {"gaps": "weak spots", "questions": "likely questions"}

# When the interviewer judges the conversation has naturally run its course it replies
# with this token instead of a question, and the session ends (subject to the floor).
_END_SENTINEL = "[[END]]"


def _now() -> datetime:
    """Wrapped so tests can control the interview clock."""
    return datetime.now(timezone.utc)


def _elapsed_seconds(session: InterviewSession) -> float:
    """Seconds since the interview started, tolerant of a naive stored timestamp."""
    now = _now()
    created = session.created_at
    if created.tzinfo is None:
        now = now.replace(tzinfo=None)
    return (now - created).total_seconds()


def _pacing_note(session: InterviewSession, elapsed: float, asked: int, closing: bool) -> dict:
    """A per-turn note so the interviewer paces itself like a real one glancing at the clock."""
    used = round(elapsed / 60)
    lines = [
        f"About {used} of {session.duration_target_min} minutes have passed and you have "
        f"asked {asked} question{'s' if asked != 1 else ''} so far."
    ]
    if closing:
        lines.append(
            "Time is nearly up. Ask one brief, natural closing question (for example "
            "whether there is anything they would like to add, or a strong final "
            "question), then the interview will end. Do not announce that it is over."
        )
    else:
        lines.append(
            "While there is time, ask the next planned question or a natural follow-up "
            "that probes the last answer; keep it conversational and cover a realistic "
            "breadth of areas."
        )
        if asked >= settings.interview_min_questions:
            lines.append(
                f"If the interview has genuinely covered enough and would naturally end "
                f"here, reply with only {_END_SENTINEL} and nothing else."
            )
    return {"role": "system", "content": " ".join(lines)}


def session_title(company: str, role: str, interview_type: str, seq: int = 1, focus: str = "") -> str:
    """A readable session title, e.g. 'Cognizant - Behavioural Interview for Analyst 2'.

    `seq` numbers repeats of the same interview type for the same company and role;
    the first of a kind is unnumbered. `focus` adds a short suffix when the interview
    was steered at the candidate's weak spots or likely questions.
    """
    label = TYPE_LABELS.get(interview_type, TYPE_LABELS["general"])
    company = (company or "").strip()
    role = (role or "").strip()

    title = f"{company} - {label} Interview" if company else f"{label} Interview"
    if role:
        title += f" for {role}"
    if seq > 1:
        title += f" {seq}"
    if focus in FOCUS_LABELS:
        title += f" ({FOCUS_LABELS[focus]})"
    return title


def focus_brief(preparation_json: str, questions_json: str, focus: str) -> tuple[str, str]:
    """Turn the stored gap analysis or questions into an interviewer instruction.

    Returns (focus_code, focus_text). The code is stored on the session for display;
    the text is injected into the interviewer prompt. Returns ("", "") when the
    requested focus has no data, so the caller falls back to a balanced interview.
    """
    if focus == "gaps" and preparation_json:
        try:
            report = PreparationReport.model_validate_json(preparation_json)
        except ValueError:
            return "", ""
        weak = [c.name.strip() for c in report.competencies if c.status in ("gap", "partial") and c.name.strip()]
        if not weak:
            return "", ""
        listed = "; ".join(weak[:6])
        text = (
            "This candidate most needs to practise these areas, where their CV is thin "
            f"for the role: {listed}. Prioritise questions that probe these areas and "
            "draw out concrete examples, with follow-ups, while still running a natural "
            "interview."
        )
        return "gaps", text

    if focus == "questions" and questions_json:
        try:
            groups = PrepResponse.model_validate_json(questions_json).groups
        except ValueError:
            return "", ""
        questions = [q.question.strip() for g in groups for q in g.questions if q.question.strip()]
        if not questions:
            return "", ""
        listed = "\n".join(f"- {q}" for q in questions[:8])
        text = (
            "Draw your main questions from this list the candidate wants to practise, "
            "asking them in a natural order and adding follow-ups that probe their "
            f"answers:\n{listed}"
        )
        return "questions", text

    return "", ""


def _system(session: InterviewSession) -> dict:
    style = INTERVIEW_STYLES.get(session.interview_type, INTERVIEW_STYLES["general"])
    content = INTERVIEWER_PROMPT.format(
        style=style,
        focus=session.focus_snapshot or "",
        cv=session.cv_snapshot or "(not provided)",
        jd=session.jd_snapshot or "(not provided)",
        context=session.company_context_snapshot or "(not researched)",
    )
    return {"role": "system", "content": content}


def _messages(session: InterviewSession) -> list[dict]:
    messages = [_system(session)]
    for turn in session.turns:
        if turn.kind == "question":
            messages.append({"role": "assistant", "content": turn.content})
        elif turn.kind == "answer":
            messages.append({"role": "user", "content": turn.content})
    return messages


def _generate(messages: list[dict]) -> str:
    reply = llm.chat(messages)
    if not moderation.moderate_output(reply).allowed:
        reply = llm.chat(messages)  # one retry
    return strip_markdown(reply)


def _add_turn(
    db: Session,
    session: InterviewSession,
    role: str,
    kind: str,
    content: str,
    metrics: str | None = None,
    nonverbal: str | None = None,
) -> None:
    turn = Turn(
        session_id=session.id,
        index=len(session.turns),
        role=role,
        kind=kind,
        content=content,
        metrics=metrics,
        nonverbal=nonverbal,
    )
    db.add(turn)
    db.commit()
    db.refresh(session)


def _mean(values: list[float]) -> float:
    return sum(values) / len(values)


def _delivery_block(session: InterviewSession) -> str:
    """A feedback-prompt block summarising measured delivery, or empty if none.

    Gives the model a per-answer breakdown and an overall picture, and states the
    healthy range for each measure so it can judge whether a number is good or bad
    rather than guessing, and turn the measurements into specific, honest feedback.
    """
    per_answer: list[str] = []
    speech: list[DeliveryMetrics] = []
    nonverbal: list[NonverbalMetrics] = []
    answered = 0
    for turn in session.turns:
        if turn.kind != "answer":
            continue
        answered += 1
        parts: list[str] = []
        if turn.metrics:
            try:
                metrics = DeliveryMetrics.model_validate_json(turn.metrics)
                parts.append(metrics.summary())
                if metrics.word_count:
                    speech.append(metrics)
            except ValueError:
                pass
        if turn.nonverbal:
            try:
                nv = NonverbalMetrics.model_validate_json(turn.nonverbal)
                parts.append(nv.summary())
                if nv.face_detected:
                    nonverbal.append(nv)
            except ValueError:
                pass
        if parts:
            per_answer.append(f"- Answer {answered}: " + " ".join(parts))
    if not per_answer:
        return ""

    aspects: list[str] = []
    overall: list[str] = []
    if speech:
        aspects.append("speaking pace, pauses and filler words")
        total_sec = sum(m.duration_sec for m in speech)
        total_words = sum(m.word_count for m in speech)
        total_fillers = sum(m.filler_count for m in speech)
        wpm = round(total_words / total_sec * 60) if total_sec else 0
        per_min = round(total_fillers / (total_sec / 60), 1) if total_sec else 0.0
        overall.append(
            f"they spoke at about {wpm} words per minute and used about {per_min} "
            "filler words a minute"
        )
    if nonverbal:
        aspects.append("eye contact, composure and posture")
        clauses = [
            f"looked at the camera about {round(_mean([n.eye_contact_pct for n in nonverbal]))}% of the time",
            f"scored {round(_mean([n.head_steadiness for n in nonverbal]))} out of 100 for head steadiness",
        ]
        postures = [n.posture_pct for n in nonverbal if n.posture_pct is not None]
        if postures:
            clauses.append(f"kept level posture in about {round(_mean(postures))}% of frames")
        overall.append("on camera they " + ", ".join(clauses))

    header = (
        "\nThe candidate's delivery was measured during the interview ("
        + "; ".join(aspects)
        + "). Across the interview overall, "
        + "; ".join(overall)
        + ". For reference, a comfortable pace is about 110 to 160 words a minute, "
        "under about three filler words a minute sounds assured, and looking at the "
        "camera for at least 60% of the time comes across as engaged. Use these "
        "measurements to give honest, specific delivery feedback in the 'delivery' "
        "field: name what genuinely came across well and the one or two habits most "
        "worth improving (for example slowing down, cutting filler words, or holding "
        "more eye contact), each tied to the numbers. Where a delivery point is clearly "
        "a strength or clearly worth working on, also add it to 'strengths' or "
        "'improvements'. Do not overstate small differences, do not spin a weak signal "
        "as a positive, and do not diagnose emotion; only mention what was actually "
        "measured.\n"
        "Per answer:\n"
    )
    return header + "\n".join(per_answer) + "\n"


def start(
    db: Session,
    user: User,
    cv: str,
    jd: str,
    context: str,
    mode: str = "text",
    interview_type: str = "general",
    company: str = "",
    role: str = "",
    focus_code: str = "",
    focus_text: str = "",
    duration_target_min: int = 10,
) -> tuple[InterviewSession, str]:
    session = InterviewSession(
        user_id=user.id,
        mode=mode,
        interview_type=interview_type,
        focus=focus_code,
        focus_snapshot=focus_text,
        company=company,
        role=role,
        cv_snapshot=cv,
        jd_snapshot=jd,
        company_context_snapshot=context,
        duration_target_min=duration_target_min,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    messages = [_system(session), {"role": "user", "content": "Please begin with your first question."}]
    question = _generate(messages)
    _add_turn(db, session, "interviewer", "question", question)
    return session, question


def answer(
    db: Session,
    session: InterviewSession,
    text: str,
    metrics: str | None = None,
    nonverbal: str | None = None,
) -> str | None:
    _add_turn(db, session, "candidate", "answer", text, metrics=metrics, nonverbal=nonverbal)

    # The stop decision is only ever taken here, after an answer, so a question is never
    # cut off part way through. The chosen length is a soft target.
    asked = sum(1 for turn in session.turns if turn.kind == "question")
    if session.wrapping_up:
        return None  # the closing question has now been answered; end the interview
    if asked >= settings.interview_max_questions:
        return None  # the hard cap on questions including follow-ups
    elapsed = _elapsed_seconds(session)
    target = session.duration_target_min * 60
    if elapsed >= target * settings.interview_runaway_multiple:
        return None  # absolute guard against a session left running

    # Near the end of the chosen length (and past the minimum), the next question is a
    # natural closing one, after which the interview ends.
    closing = (
        asked >= settings.interview_min_questions
        and elapsed >= target - settings.interview_wind_down_sec
    )
    messages = _messages(session)
    messages.append(_pacing_note(session, elapsed, asked, closing))
    question = _generate(messages)

    if _END_SENTINEL in question:
        if asked >= settings.interview_min_questions:
            return None  # the interviewer judged the conversation naturally complete
        # Too early to end: drop the token and keep whatever question remains.
        question = question.replace(_END_SENTINEL, "").strip()
        if not question:
            question = "Could you tell me a little more about that?"

    if closing:
        session.wrapping_up = True
    _add_turn(db, session, "interviewer", "question", question)
    return question


_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)


def parse_feedback(raw: str) -> FeedbackReport:
    """Parse the model's JSON assessment, falling back to a summary-only report."""
    match = _JSON_OBJECT.search(raw)
    if match:
        try:
            report = FeedbackReport.model_validate(json.loads(match.group()))
        except ValueError:
            report = None
        if report is not None:
            return FeedbackReport(
                summary=strip_markdown(report.summary),
                strengths=deduped([strip_markdown(s) for s in report.strengths if s.strip()]),
                improvements=deduped([strip_markdown(s) for s in report.improvements if s.strip()]),
                answer_notes=[
                    note.model_copy(
                        update={
                            "question": strip_markdown(note.question),
                            "comment": strip_markdown(note.comment),
                        }
                    )
                    for note in report.answer_notes
                ],
                delivery=strip_markdown(report.delivery),
            )
    # The model did not return usable JSON; keep its prose as the summary.
    return FeedbackReport(summary=strip_markdown(raw))


def _has_answers(session: InterviewSession) -> bool:
    return any(turn.kind == "answer" and turn.content.strip() for turn in session.turns)


def _generate_feedback(session: InterviewSession) -> FeedbackReport:
    # If the candidate never actually answered, say so honestly rather than letting the
    # model invent an assessment of a missing answer.
    if not _has_answers(session):
        return FeedbackReport(
            summary=(
                "You finished the interview without answering any of the questions, so "
                "there is nothing to assess yet. Start an interview and give each "
                "question a go, even a short attempt out loud, to get feedback on your "
                "answers."
            ),
            improvements=[
                "Have a go at answering each question, even if you are unsure. A rough "
                "attempt is far more useful to practise on than no answer.",
            ],
        )

    lines: list[str] = []
    for turn in session.turns:
        if turn.kind == "question":
            lines.append(f"Interviewer: {turn.content}")
        elif turn.kind == "answer":
            content = turn.content.strip() or "(the candidate gave no answer to this question)"
            lines.append(f"Candidate: {content}")
    transcript = "\n".join(lines)
    prompt = FEEDBACK_PROMPT.format(transcript=transcript, delivery=_delivery_block(session))
    raw = llm.chat([{"role": "user", "content": prompt}])
    if not moderation.moderate_output(raw).allowed:
        raw = llm.chat([{"role": "user", "content": prompt}])
    return parse_feedback(raw)


def finish(db: Session, session: InterviewSession) -> FeedbackReport:
    report = _generate_feedback(session)
    _add_turn(db, session, "interviewer", "feedback", report.model_dump_json())
    session.status = "finished"
    db.commit()
    db.refresh(session)
    return report


def regenerate_feedback(db: Session, session: InterviewSession) -> FeedbackReport:
    """Re-assess a finished interview, replacing its stored feedback.

    Used to upgrade older interviews to the structured report from their saved
    transcript, and to refresh feedback on demand.
    """
    report = _generate_feedback(session)
    for turn in list(session.turns):
        if turn.kind == "feedback":
            db.delete(turn)
    db.commit()
    db.refresh(session)
    _add_turn(db, session, "interviewer", "feedback", report.model_dump_json())
    if session.status != "finished":
        session.status = "finished"
        db.commit()
        db.refresh(session)
    return report
