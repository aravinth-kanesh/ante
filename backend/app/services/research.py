import json
import re

from app.services import llm
from app.services.text import strip_markdown

_JSON = re.compile(r"\{.*\}", re.DOTALL)

EXTRACT_PROMPT = """Read the job description below and identify the company name \
and the role title. Reply with a single JSON object and nothing else:
{"company": "<company name or empty string>", "role": "<role title or empty string>"}

Job description:
"""

RESEARCH_PROMPT = """You are briefing a candidate who is about to interview for the \
role of {role} at {company}. Write practical preparation notes that help them walk in \
ready.

Cover, in this order:
- what the company does and the values or culture it is known for;
- what it tends to look for in candidates for this kind of role (the competencies and \
qualities that matter);
- how it usually interviews for this role: the likely stages and formats, and the \
themes questions tend to focus on (behavioural, technical, values-based);
- a few concrete things the candidate should prepare or emphasise.

If you are not confident about specifics for this company, say so plainly and give the \
norms for this role and industry instead, rather than inventing details.

Write in plain British English prose, in short paragraphs. Do not use Markdown or any \
special formatting: no asterisks, no hashes, no bullet symbols, no bold, no headings. \
Keep it under 250 words."""


def extract_company_role(jd_text: str) -> tuple[str, str]:
    raw = llm.chat(
        [{"role": "user", "content": EXTRACT_PROMPT + jd_text}],
        temperature=0,
        max_tokens=200,
    )
    match = _JSON.search(raw)
    if match is None:
        return "", ""
    try:
        data = json.loads(match.group())
    except ValueError:
        return "", ""
    return str(data.get("company", "")).strip(), str(data.get("role", "")).strip()


def research_company(company: str, role: str) -> str:
    prompt = RESEARCH_PROMPT.format(
        company=company or "the employer", role=role or "the advertised role"
    )
    return strip_markdown(llm.chat([{"role": "user", "content": prompt}], temperature=0.3))
