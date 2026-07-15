import json
import logging
import re

from pydantic import BaseModel

from app.config import settings
from app.services import llm
from app.services.prompts import INPUT_RUBRIC, OUTPUT_RUBRIC

logger = logging.getLogger(__name__)

_JSON = re.compile(r"\{.*\}", re.DOTALL)


class Verdict(BaseModel):
    allowed: bool
    category: str = "ok"
    reason: str = ""


def _judge(rubric: str, text: str) -> Verdict:
    model = settings.moderation_model or settings.llm_model
    raw = llm.chat(
        [{"role": "system", "content": rubric}, {"role": "user", "content": text}],
        model=model,
        temperature=0,
        max_tokens=200,
    )
    match = _JSON.search(raw)
    if match is None:
        raise ValueError(f"no JSON in judge reply: {raw!r}")
    return Verdict(**json.loads(match.group()))


def _run(rubric: str, text: str) -> Verdict:
    # Fail open: a judge hiccup should not block a real user.
    try:
        return _judge(rubric, text)
    except Exception:
        logger.warning("moderation judge failed, allowing by default", exc_info=True)
        return Verdict(allowed=True, category="ok", reason="judge unavailable")


def moderate_input(text: str) -> Verdict:
    if not settings.moderate_input_enabled:
        return Verdict(allowed=True)
    return _run(INPUT_RUBRIC, text)


def moderate_output(text: str) -> Verdict:
    if not settings.moderate_output_enabled:
        return Verdict(allowed=True)
    return _run(OUTPUT_RUBRIC, text)
