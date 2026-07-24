import json
import re

from sqlalchemy.orm import Session

from app.config import settings
from app.models.session import InterviewSession, Turn
from app.models.user import User
from app.schemas.interview import DeliveryMetrics, FeedbackReport, NonverbalMetrics
from app.services import llm, moderation
from app.services.prompts import FEEDBACK_PROMPT, INTERVIEW_STYLES, INTERVIEWER_PROMPT
from app.services.text import strip_markdown


TYPE_LABELS = {
    "general": "General",
    "behavioural": "Behavioural",
    "competency": "Competency-based",
    "technical": "Technical",
    "strengths": "Strengths-based",
}


def session_title(company: str, role: str, interview_type: str, seq: int = 1) -> str:
    """A readable session title, e.g. 'Cognizant - Behavioural Interview for Analyst 2'.

    `seq` numbers repeats of the same interview type for the same company and role;
    the first of a kind is unnumbered.
    """
    label = TYPE_LABELS.get(interview_type, TYPE_LABELS["general"])
    company = (company or "").strip()
    role = (role or "").strip()

    title = f"{company} - {label} Interview" if company else f"{label} Interview"
    if role:
        title += f" for {role}"
    if seq > 1:
        title += f" {seq}"
    return title


def _system(session: InterviewSession) -> dict:
    style = INTERVIEW_STYLES.get(session.interview_type, INTERVIEW_STYLES["general"])
    content = INTERVIEWER_PROMPT.format(
        style=style,
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


def _delivery_block(session: InterviewSession) -> str:
    """A feedback-prompt block summarising measured delivery, or empty if none."""
    lines: list[str] = []
    answered = 0
    has_speech = False
    has_nonverbal = False
    for turn in session.turns:
        if turn.kind != "answer":
            continue
        answered += 1
        parts: list[str] = []
        if turn.metrics:
            try:
                parts.append(DeliveryMetrics.model_validate_json(turn.metrics).summary())
                has_speech = True
            except ValueError:
                pass
        if turn.nonverbal:
            try:
                parts.append(NonverbalMetrics.model_validate_json(turn.nonverbal).summary())
                has_nonverbal = True
            except ValueError:
                pass
        if parts:
            lines.append(f"- Answer {answered}: " + " ".join(parts))
    if not lines:
        return ""
    aspects: list[str] = []
    if has_speech:
        aspects.append("speaking pace, pauses and filler words")
    if has_nonverbal:
        aspects.append("eye contact, composure and posture")
    header = (
        "\nThe candidate's delivery was measured during the interview ("
        + "; ".join(aspects)
        + "). Comment briefly and honestly on it using these measurements: flag "
        "genuine issues such as a very slow or very fast pace, long pauses or "
        "frequent fillers, and do not spin a weak signal as a positive. Do not "
        "overstate the numbers or diagnose emotion:\n"
    )
    return header + "\n".join(lines) + "\n"


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
) -> tuple[InterviewSession, str]:
    session = InterviewSession(
        user_id=user.id,
        mode=mode,
        interview_type=interview_type,
        company=company,
        role=role,
        cv_snapshot=cv,
        jd_snapshot=jd,
        company_context_snapshot=context,
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

    asked = sum(1 for turn in session.turns if turn.kind == "question")
    if asked >= settings.interview_max_questions:
        return None  # interview complete; caller should finish

    question = _generate(_messages(session))
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
                strengths=[strip_markdown(s) for s in report.strengths if s.strip()],
                improvements=[strip_markdown(s) for s in report.improvements if s.strip()],
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


def finish(db: Session, session: InterviewSession) -> FeedbackReport:
    transcript = "\n".join(
        f"{'Interviewer' if t.role == 'interviewer' else 'Candidate'}: {t.content}"
        for t in session.turns
        if t.kind in ("question", "answer")
    )
    prompt = FEEDBACK_PROMPT.format(transcript=transcript, delivery=_delivery_block(session))
    raw = llm.chat([{"role": "user", "content": prompt}])
    if not moderation.moderate_output(raw).allowed:
        raw = llm.chat([{"role": "user", "content": prompt}])
    report = parse_feedback(raw)

    _add_turn(db, session, "interviewer", "feedback", report.model_dump_json())
    session.status = "finished"
    db.commit()
    db.refresh(session)
    return report
