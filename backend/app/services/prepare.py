import json
import re

from app.services import llm, moderation

_JSON_ARRAY = re.compile(r"\[.*\]", re.DOTALL)

PREP_PROMPT = """You are helping a student prepare for a specific job interview. \
Using their CV, the job description, and what is known about the company below, \
write {n} interview questions they are likely to be asked. Tailor them to the \
candidate's background, the role, and the way this company interviews. Include a \
mix of behavioural, technical and role-specific questions.

Write in British English. Return a JSON array and nothing else. Each item is an object:
{{"question": "<the question>", "rationale": "<one short line on why it is likely>"}}

CV:
{cv}

Job description:
{jd}

Company and role context:
{context}"""


def generate_questions(
    cv_text: str, jd_text: str, company_context: str = "", n: int = 8
) -> list[dict]:
    prompt = PREP_PROMPT.format(
        n=n,
        cv=cv_text or "(not provided)",
        jd=jd_text or "(not provided)",
        context=company_context or "(not researched)",
    )
    raw = llm.chat([{"role": "user", "content": prompt}], temperature=0.4)

    match = _JSON_ARRAY.search(raw)
    if match is None:
        raise ValueError(f"no JSON array in reply: {raw!r}")
    items = json.loads(match.group())

    combined = "\n".join(str(item.get("question", "")) for item in items)
    if not moderation.moderate_output(combined).allowed:
        raise ValueError("generated questions failed moderation")
    return items
