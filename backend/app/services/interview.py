from sqlalchemy.orm import Session

from app.config import settings
from app.models.session import InterviewSession, Turn
from app.models.user import User
from app.services import llm, moderation
from app.services.prompts import FEEDBACK_PROMPT, INTERVIEWER_PROMPT


def _system(session: InterviewSession) -> dict:
    content = INTERVIEWER_PROMPT.format(
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
    return reply.strip()


def _add_turn(db: Session, session: InterviewSession, role: str, kind: str, content: str) -> None:
    turn = Turn(session_id=session.id, index=len(session.turns), role=role, kind=kind, content=content)
    db.add(turn)
    db.commit()
    db.refresh(session)


def start(
    db: Session, user: User, cv: str, jd: str, context: str, mode: str = "text"
) -> tuple[InterviewSession, str]:
    session = InterviewSession(
        user_id=user.id,
        mode=mode,
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


def answer(db: Session, session: InterviewSession, text: str) -> str | None:
    _add_turn(db, session, "candidate", "answer", text)

    asked = sum(1 for turn in session.turns if turn.kind == "question")
    if asked >= settings.interview_max_questions:
        return None  # interview complete; caller should finish

    question = _generate(_messages(session))
    _add_turn(db, session, "interviewer", "question", question)
    return question


def finish(db: Session, session: InterviewSession) -> str:
    transcript = "\n".join(
        f"{'Interviewer' if t.role == 'interviewer' else 'Candidate'}: {t.content}"
        for t in session.turns
        if t.kind in ("question", "answer")
    )
    feedback = llm.chat([{"role": "user", "content": FEEDBACK_PROMPT.format(transcript=transcript)}])
    if not moderation.moderate_output(feedback).allowed:
        feedback = llm.chat([{"role": "user", "content": FEEDBACK_PROMPT.format(transcript=transcript)}])
    feedback = feedback.strip()

    _add_turn(db, session, "interviewer", "feedback", feedback)
    session.status = "finished"
    db.commit()
    db.refresh(session)
    return feedback
