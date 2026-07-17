import json
import re

from app.services import llm

_JSON = re.compile(r"\{.*\}", re.DOTALL)

EXTRACT_PROMPT = """Read the job description below and identify the company name \
and the role title. Reply with a single JSON object and nothing else:
{"company": "<company name or empty string>", "role": "<role title or empty string>"}

Job description:
"""

RESEARCH_PROMPT = """You are briefing a candidate before a job interview. Using what \
you know about {company}, write a short briefing for someone interviewing for the \
role of {role} there. Cover the company's values and culture, what it tends to look \
for in candidates, and how it commonly interviews for this kind of role (formats, \
themes, competencies). If you are not confident about specifics for this company, \
say so plainly and give the norms for this role and industry instead. Keep it under \
250 words and write in British English."""


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
    return llm.chat([{"role": "user", "content": prompt}], temperature=0.3).strip()
