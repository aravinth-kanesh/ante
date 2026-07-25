import json
import logging
import re

from app.schemas.prepare import PrepGroup, PrepQuestion
from app.services import llm, moderation
from app.services.text import strip_markdown

logger = logging.getLogger(__name__)

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)
_JSON_ARRAY = re.compile(r"\[.*\]", re.DOTALL)

PREP_PROMPT = """You are helping a student prepare for a specific job interview. Using \
their CV, the job description, and what is known about the company below, write the \
interview questions they are most likely to be asked, grouped by category.

Return a single JSON object and nothing else, in exactly this shape:
{{"groups": [{{"category": "<category>", "questions": [{{"question": "<the question>", \
"rationale": "<one short line on why it is likely or what it assesses>"}}]}}]}}

Use these four categories, in this order, each with 2 to 4 questions:
- "Common questions": the usual questions asked in almost any interview, such as \
inviting them to introduce themselves, why they want this role and company, their \
strengths, and how they handle a challenge.
- "Behavioural and competency": "tell me about a time when you..." questions targeting \
the competencies this role needs.
- "Role and technical": questions specific to the job description and the role's skills, \
answerable by talking, never a coding exercise, whiteboard or puzzle.
- "About your CV": questions that dig into specific projects, skills and experience on \
the candidate's CV.

Write in British English with no Markdown.

CV:
{cv}

Job description:
{jd}

Company and role context:
{context}"""


def _clean_group(group: PrepGroup) -> PrepGroup:
    return PrepGroup(
        category=strip_markdown(group.category),
        questions=[
            PrepQuestion(question=strip_markdown(q.question), rationale=strip_markdown(q.rationale))
            for q in group.questions
            if q.question.strip()
        ],
    )


def _parse(raw: str) -> list[PrepGroup]:
    match = _JSON_OBJECT.search(raw)
    if match:
        try:
            data = json.loads(match.group())
            groups = [PrepGroup.model_validate(g) for g in data.get("groups", [])]
            if groups:
                return groups
        except ValueError:
            pass
    # tolerate a bare array of questions (older prompt style)
    match = _JSON_ARRAY.search(raw)
    if match:
        try:
            items = [PrepQuestion.model_validate(i) for i in json.loads(match.group())]
            if items:
                return [PrepGroup(category="Likely questions", questions=items)]
        except ValueError:
            pass
    return []


def _generate_once(prompt: str) -> list[PrepGroup]:
    raw = llm.chat([{"role": "user", "content": prompt}], temperature=0.4)
    return [g for g in (_clean_group(g) for g in _parse(raw)) if g.questions]


def _passes_moderation(groups: list[PrepGroup]) -> bool:
    # Frame the questions so the judge assesses them as interview-prep content, not
    # as a bare list it mistakes for an off-topic reply.
    combined = "The following are mock interview questions prepared for a candidate:\n" + "\n".join(
        q.question for g in groups for q in g.questions
    )
    return moderation.moderate_output(combined).allowed


def generate_questions(cv_text: str, jd_text: str, company_context: str = "") -> list[PrepGroup]:
    prompt = PREP_PROMPT.format(
        cv=cv_text or "(not provided)",
        jd=jd_text or "(not provided)",
        context=company_context or "(not researched)",
    )
    groups = _generate_once(prompt)
    if not groups:
        raise ValueError("no questions generated")

    # The judge is non-deterministic and occasionally blocks fine questions, so on a
    # block regenerate once and use that set, rather than failing the whole feature.
    if not _passes_moderation(groups):
        retry = _generate_once(prompt)
        if retry:
            groups = retry
            if not _passes_moderation(groups):
                logger.warning("generated questions flagged twice; showing them anyway")
    return groups
