"""A deterministic offline stand-in for the language model.

Enabled with `LLM_FAKE=1`, it returns canned but valid responses for every prompt the
app makes, so the whole application can be run and demonstrated without an API key, and
so an end-to-end test can drive a full interview deterministically. Detection is by a
short marker unique to each prompt template; the JSON replies are built from Python
objects so they are always well-formed.
"""

import json

_INTERVIEW_QUESTIONS = [
    "To start, tell me a little about yourself and why this role interests you.",
    "Tell me about a time you worked in a team to deliver something. What was your part?",
    "Describe a challenge you faced in a project and how you worked through it.",
    "What would you say is your greatest strength, and how have you shown it?",
    "Tell me about a time you had to learn something quickly.",
    "How do you approach a problem you have not seen before?",
    "Before we finish, is there anything you would like to add?",
]

_FEEDBACK = {
    "summary": "A solid attempt overall. Your answers were relevant and reasonably "
    "structured, with room to add more specific detail and stronger examples.",
    "strengths": [
        "You answered the question that was asked and stayed on topic.",
        "You gave a clear structure that was easy to follow.",
    ],
    "improvements": [
        "Add a concrete example with a specific action and result.",
        "Say what you personally did, rather than only what the team did.",
        "Get to the point sooner so your strongest evidence lands early.",
    ],
    "answer_notes": [
        {
            "question": "Your answer",
            "verdict": "adequate",
            "comment": "A reasonable answer; make it stronger with a specific example and "
            "the outcome you achieved.",
            "model_answer": "In my final-year project I led a team of four to build a "
            "working prototype in eight weeks; I coordinated the plan, took the database "
            "design myself, and we delivered on time with positive user feedback.",
        }
    ],
    "delivery": "",
}

_RESEARCH = {
    "overview": "A well-regarded employer in its field, known for a collaborative "
    "culture and a focus on careful, high-quality work.",
    "interview_process": "Interviews for this kind of role usually run over one or two "
    "stages, mixing questions about your background and motivation with role-specific "
    "and behavioural questions.",
    "technical_skills": ["The core tools and knowledge the role advertises"],
    "soft_skills": ["Clear communication", "Working well in a team"],
    "tips": [
        "Prepare two or three concrete examples that show the competencies the role needs.",
    ],
}

_PREPARATION = {
    "summary": "You have a reasonable base for this role, with a few areas to firm up "
    "before the interview.",
    "competencies": [
        {
            "name": "Communication",
            "area": "behavioural",
            "status": "strong",
            "evidence": "Your CV shows experience presenting and working with others.",
        },
        {
            "name": "Role-specific knowledge",
            "area": "technical",
            "status": "partial",
            "evidence": "Some relevant experience; add depth on the specific tools the role needs.",
        },
    ],
    "plan": [
        {
            "focus": "Role-specific knowledge",
            "action": "Revise the key tools named in the job description and prepare a "
            "worked example for each.",
            "priority": "high",
        },
        {
            "focus": "Examples",
            "action": "Write two STAR examples that show the competencies the role asks for.",
            "priority": "medium",
        },
    ],
}

_QUESTIONS = {
    "groups": [
        {
            "category": "Common questions",
            "questions": [
                {"question": "Tell me about yourself.", "rationale": "A standard opener."},
                {"question": "Why do you want this role?", "rationale": "Checks motivation and fit."},
            ],
        },
        {
            "category": "Behavioural and competency",
            "questions": [
                {"question": "Tell me about a time you worked in a team.", "rationale": "Teamwork."},
                {
                    "question": "Describe a challenge you overcame.",
                    "rationale": "Resilience and problem solving.",
                },
            ],
        },
        {
            "category": "Role and technical",
            "questions": [
                {
                    "question": "Walk me through a project relevant to this role.",
                    "rationale": "Role knowledge.",
                },
                {
                    "question": "How do you approach a problem you have not seen before?",
                    "rationale": "Problem solving.",
                },
            ],
        },
        {
            "category": "About your CV",
            "questions": [
                {
                    "question": "Tell me more about your most recent project.",
                    "rationale": "Digs into your experience.",
                },
                {
                    "question": "Which achievement on your CV are you most proud of?",
                    "rationale": "Self-awareness.",
                },
            ],
        },
    ]
}

_COACH_SUMMARY = (
    "You are making steady progress. Your answers are getting clearer, and the main "
    "thing to focus on next is adding specific examples with real outcomes. Keep "
    "practising and you will keep building confidence."
)

_COACH_CHAT = (
    "Good question. Focus on giving a specific example: say what the situation was, what "
    "you did, and what the result was. Would you like to practise an answer to that?"
)


def _interview_question(messages: list[dict]) -> str:
    asked = sum(1 for m in messages if m.get("role") == "assistant")
    return _INTERVIEW_QUESTIONS[min(asked, len(_INTERVIEW_QUESTIONS) - 1)]


def reply(messages: list[dict]) -> str:
    """A deterministic canned reply matching the prompt the app sent."""
    system = str(messages[0].get("content", "")) if messages else ""
    last = str(messages[-1].get("content", "")) if messages else ""
    text = "\n".join(str(m.get("content", "")) for m in messages)

    if '"allowed"' in text:  # a moderation rubric
        return json.dumps({"allowed": True, "category": "ok", "reason": "ok"})
    if "Transcript:" in last:  # the feedback prompt
        return json.dumps(_FEEDBACK)
    if "supportive interview coach" in text:  # the progress coach summary
        return _COACH_SUMMARY
    if "identify the company name and the role title" in text:
        return json.dumps({"company": "", "role": ""})
    if "You are briefing a candidate who is about to interview" in text:
        return json.dumps(_RESEARCH)
    if "competency gap analysis" in text:
        return json.dumps(_PREPARATION)
    if "grouped by category" in text:
        return json.dumps(_QUESTIONS)
    if "conducting a realistic mock interview" in system:
        return _interview_question(messages)
    return _COACH_CHAT
