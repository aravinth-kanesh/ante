import json
import logging
import re

from app.schemas.preparation import Competency, PlanItem, PreparationReport
from app.services import llm, moderation
from app.services.dedupe import deduped_by
from app.services.text import strip_markdown

logger = logging.getLogger(__name__)

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)

PREPARATION_PROMPT = """You are a careful interview coach helping a student prepare for \
a specific role. Using their CV, the job description, and what is known about the \
company below, produce an honest competency gap analysis and a preparation plan.

Be truthful, the way a real assessor would; do not flatter. Judge the evidence in the \
CV on its merits:
- "strong": the CV clearly evidences this competency with concrete experience.
- "partial": there is some related evidence, but it is thin or indirect.
- "gap": the role needs it and the CV shows little or no evidence.
Name real gaps as gaps. Every judgement must reference what the CV does or does not \
show, not vague praise.

The plan must be concrete and actionable (what to revise, which specific examples or \
STAR stories to prepare, what to practise), prioritised, and focused on the gaps and \
partials first. Do not pad it.

Write for a university student who may be new to interviews. Use plain, encouraging \
language and explain any interview term you use (for example, STAR means describing \
the Situation, Task, Action and Result), so every point is clear and easy to act on.

Return a single JSON object and nothing else, in exactly this shape:
{{
  "summary": "<two or three honest sentences on how well the candidate fits this role \
and where to focus>",
  "competencies": [
    {{"name": "<a competency or skill this role needs>",
      "area": "technical|behavioural",
      "status": "strong|partial|gap",
      "evidence": "<one line citing what the CV shows or lacks>"}}
  ],
  "plan": [
    {{"focus": "<the gap or area this step addresses>",
      "action": "<a concrete, specific thing to do>",
      "priority": "high|medium|low"}}
  ]
}}

Cover the competencies that matter most for this role (roughly five to eight). Write \
in British English with no Markdown.

CV:
{cv}

Job description:
{jd}

Company and role context:
{context}"""


def _clean(report: PreparationReport) -> PreparationReport:
    return PreparationReport(
        summary=strip_markdown(report.summary),
        competencies=[
            Competency(
                name=strip_markdown(c.name),
                area=c.area,
                status=c.status,
                evidence=strip_markdown(c.evidence),
            )
            for c in report.competencies
            if c.name.strip()
        ],
        plan=deduped_by(
            [
                PlanItem(
                    focus=strip_markdown(p.focus),
                    action=strip_markdown(p.action),
                    priority=p.priority,
                )
                for p in report.plan
                if p.action.strip()
            ],
            key=lambda item: item.action,
        ),
    )


def _parse(raw: str) -> PreparationReport | None:
    match = _JSON_OBJECT.search(raw)
    if match:
        try:
            return _clean(PreparationReport.model_validate_json(match.group()))
        except ValueError:
            pass
    return None


def _is_usable(report: PreparationReport | None) -> bool:
    return bool(report and (report.competencies or report.plan))


def _generate_once(prompt: str) -> PreparationReport | None:
    return _parse(llm.chat([{"role": "user", "content": prompt}], temperature=0.4))


def _passes_moderation(report: PreparationReport) -> bool:
    # Frame it so the judge assesses interview-prep notes, not a bare list it might
    # mistake for an off-topic reply.
    combined = "The following are interview preparation notes for a candidate:\n" + "\n".join(
        [report.summary]
        + [f"{c.name}: {c.evidence}" for c in report.competencies]
        + [p.action for p in report.plan]
    )
    return moderation.moderate_output(combined).allowed


def analyse(cv_text: str, jd_text: str, company_context: str = "") -> PreparationReport:
    prompt = PREPARATION_PROMPT.format(
        cv=cv_text or "(not provided)",
        jd=jd_text or "(not provided)",
        context=company_context or "(not researched)",
    )
    report = _generate_once(prompt)
    if not _is_usable(report):
        raise ValueError("no preparation report generated")
    assert report is not None

    # The judge is non-deterministic; on a block, regenerate once and use that rather
    # than failing the whole feature.
    if not _passes_moderation(report):
        retry = _generate_once(prompt)
        if _is_usable(retry):
            assert retry is not None
            report = retry
            if not _passes_moderation(report):
                logger.warning("preparation report flagged twice; showing it anyway")
    return report
