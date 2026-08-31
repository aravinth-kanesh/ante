import random

from app.schemas.interview import AnswerNote
from app.services import interview, llm, moderation
from app.services.prompts import FEEDBACK_PROMPT, WRITTEN_INTERVIEW_NOTE

# A small bank of common questions so a student can practise one straight away, with no
# setup. When they have generated their own likely questions in Prepare, those are mixed
# in as well.
COMMON_QUESTIONS = [
    "Tell me about yourself.",
    "Why do you want this role?",
    "Why do you want to work for this company?",
    "Tell me about a time you worked well in a team.",
    "Describe a challenge you faced and how you handled it.",
    "What are your greatest strengths?",
    "Tell me about a time you showed leadership.",
    "Tell me about a time you dealt with a setback or failure.",
    "Where do you see yourself in five years?",
    "Why should we hire you?",
    "Describe a time you had to meet a tight deadline.",
    "Tell me about a time you had a disagreement and how you resolved it.",
]


def pick_question(extra: list[str] | None = None, exclude: str = "") -> str:
    # Prefer variety: never hand back the question the student just did if there is another.
    pool = list(dict.fromkeys([q for q in (extra or []) if q] + COMMON_QUESTIONS))
    choices = [q for q in pool if q != exclude] or pool
    return random.choice(choices)


def assess(question: str, answer: str) -> AnswerNote:
    # Reuse the interview feedback prompt on a single question and answer, and return just
    # the one answer note, so quick practice gives the same honest, structured read.
    body = answer.strip() or "(the candidate gave no answer)"
    transcript = f"Interviewer: {question}\nCandidate: {body}"
    # Quick practice is always typed, so assess the written content only and never invent
    # spoken-delivery feedback.
    prompt = FEEDBACK_PROMPT.format(transcript=transcript, delivery="", mode_note=WRITTEN_INTERVIEW_NOTE)
    raw = llm.chat([{"role": "user", "content": prompt}])
    if not moderation.moderate_output(raw).allowed:
        raw = llm.chat([{"role": "user", "content": prompt}])
    report = interview.parse_feedback(raw)
    if report.answer_notes:
        return report.answer_notes[0]
    # The model returned a report without a per-answer note; fall back to its summary.
    return AnswerNote(question=question, verdict="adequate", comment=report.summary, model_answer="")
