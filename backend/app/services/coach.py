from dataclasses import dataclass

from app.config import settings
from app.services import llm, moderation
from app.services.prompts import COACH_SYSTEM_PROMPT

REFUSALS = {
    "off_topic": "I can only help with interview preparation. Ask me for a practice "
    "question, or share an answer you'd like feedback on.",
    "unsafe": "I can't help with that. Let's keep to preparing for your interview.",
    "injection": "Let's stay focused on your interview preparation. What would you "
    "like to practise?",
}
FALLBACK = (
    "Sorry, I couldn't give a useful answer to that. Could you rephrase or "
    "ask about a specific interview question?"
)


@dataclass
class CoachResult:
    reply: str
    blocked: bool = False
    category: str = "ok"


def respond(messages: list[dict]) -> CoachResult:
    if not settings.moderation_enabled:
        return CoachResult(reply=llm.chat([_system(), *messages]))

    last_user = next((m for m in reversed(messages) if m["role"] == "user"), None)
    if last_user is not None:
        verdict = moderation.moderate_input(last_user["content"])
        if not verdict.allowed:
            refusal = REFUSALS.get(verdict.category, REFUSALS["off_topic"])
            return CoachResult(reply=refusal, blocked=True, category=verdict.category)

    convo = [_system(), *messages]
    reply = llm.chat(convo)

    retries = 0
    while not moderation.moderate_output(reply).allowed:
        if retries >= settings.moderation_max_retries:
            return CoachResult(reply=FALLBACK, blocked=True, category="unsafe")
        reply = llm.chat([*convo, _retry_note()])
        retries += 1

    return CoachResult(reply=reply)


def _system() -> dict:
    return {"role": "system", "content": COACH_SYSTEM_PROMPT}


def _retry_note() -> dict:
    return {
        "role": "user",
        "content": "That reply drifted off interview preparation. Answer again, "
        "staying on topic and honest.",
    }
