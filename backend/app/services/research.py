import json
import re

from app.config import settings
from app.schemas.profile import CompanyResearch, Source
from app.services import llm, websearch
from app.services.text import strip_markdown

_JSON = re.compile(r"\{.*\}", re.DOTALL)

EXTRACT_PROMPT = """Read the job description below and identify the company name \
and the role title. Reply with a single JSON object and nothing else:
{"company": "<company name or empty string>", "role": "<role title or empty string>"}

Job description:
"""

RESEARCH_PROMPT = """You are briefing a candidate who is about to interview for the \
role of {role} at {company}.
{context}Return a structured briefing as a single JSON object and \
nothing else, in exactly this shape:
{{
  "overview": "<what the company does and the values or culture it is known for>",
  "interview_process": "<how it usually interviews for this role: the likely stages \
and formats, and the themes questions tend to focus on such as behavioural, technical \
or values-based>",
  "technical_skills": ["<a hard or technical skill the role needs, e.g. a language, \
tool, or domain knowledge>"],
  "soft_skills": ["<an interpersonal or behavioural quality the role needs, e.g. \
teamwork or communication>"],
  "tips": ["<a concrete thing the candidate should prepare or emphasise>"]
}}

If you are not confident about specifics for this company, say so plainly in the \
relevant field and give the norms for this role and industry instead, rather than \
inventing details. Write in plain British English with no Markdown."""


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


def _list(items: list[str]) -> list[str]:
    return [strip_markdown(s) for s in items if s.strip()]


def _clean(report: CompanyResearch) -> CompanyResearch:
    return CompanyResearch(
        overview=strip_markdown(report.overview),
        interview_process=strip_markdown(report.interview_process),
        technical_skills=_list(report.technical_skills),
        soft_skills=_list(report.soft_skills),
        skills=_list(report.skills),
        tips=_list(report.tips),
    )


def _grounding(company: str, role: str) -> tuple[str, list[Source]]:
    """A prompt block of web snippets to ground the briefing and the sources it drew on;
    ("", []) when web search is off or returns nothing."""
    if not company.strip():
        return "", []
    results: list[dict] = []
    results.extend(websearch.search_results(f"{company} company overview what they do"))
    results.extend(websearch.search_results(f"{company} {role} interview process".strip()))
    results = results[: settings.web_search_max_results]

    snippets: list[str] = []
    sources: list[Source] = []
    seen: set[str] = set()
    for result in results:
        title, body, url = result["title"], result["body"], result["url"]
        if body:
            snippets.append(f"{title}: {body}" if title else body)
        if url and url not in seen:
            seen.add(url)
            sources.append(Source(title=title or url, url=url))

    if not snippets:
        return "", sources
    listed = "\n".join(f"- {s}" for s in snippets)
    text = (
        "Use these recent web search results to ground the briefing. Prefer them over "
        "guesswork, but where they are thin or conflicting, fall back to the norms for "
        "this role and industry and say plainly when you are unsure rather than "
        f"inventing details:\n{listed}\n\n"
    )
    return text, sources


def research_company(company: str, role: str) -> CompanyResearch:
    context, sources = _grounding(company, role)
    prompt = RESEARCH_PROMPT.format(
        company=company or "the employer",
        role=role or "the advertised role",
        context=context,
    )
    raw = llm.chat([{"role": "user", "content": prompt}], temperature=0.3)
    match = _JSON.search(raw)
    if match:
        try:
            report = _clean(CompanyResearch.model_validate_json(match.group()))
            return report.model_copy(update={"sources": sources})
        except ValueError:
            pass
    # not usable JSON; keep the prose as the overview
    return CompanyResearch(overview=strip_markdown(raw), sources=sources)


def render(report: CompanyResearch) -> str:
    """Flatten the structured research into plain text for the model prompts."""
    parts: list[str] = []
    if report.overview:
        parts.append(report.overview)
    if report.interview_process:
        parts.append(f"Interview process: {report.interview_process}")
    if report.technical_skills:
        parts.append("Technical skills: " + ", ".join(report.technical_skills))
    if report.soft_skills:
        parts.append("Soft skills: " + ", ".join(report.soft_skills))
    if report.skills:
        parts.append("Key skills: " + ", ".join(report.skills))
    if report.tips:
        parts.append("Preparation tips: " + "; ".join(report.tips))
    return "\n\n".join(parts)
