import json

from app.services import prepare
from app.services.moderation import Verdict

RESEARCH_JSON = json.dumps(
    {
        "overview": "Acme builds things.",
        "interview_process": "Online test, then interviews.",
        "technical_skills": ["Python"],
        "soft_skills": ["Teamwork"],
        "tips": ["Prepare examples."],
    }
)
QUESTIONS_JSON = json.dumps(
    {"groups": [{"category": "Common", "questions": [{"question": "Tell me about yourself.", "rationale": "opener"}]}]}
)
REPORT_JSON = json.dumps(
    {
        "summary": "Solid technical fit.",
        "competencies": [{"name": "Python", "area": "technical", "status": "strong", "evidence": "A project."}],
        "plan": [{"focus": "Leadership", "action": "Prepare a STAR story.", "priority": "high"}],
    }
)


def _cookies(client, email):
    res = client.post("/api/auth/signup", json={"email": email, "password": "password123"})
    client.cookies.clear()
    return {"access_token": res.cookies["access_token"]}


def _mock(monkeypatch):
    # research, prepare and preparation all import the one shared llm and moderation
    # modules, so a single prompt-aware stub covers every generation.
    def fake_chat(messages, *a, **k):
        prompt = messages[-1]["content"]
        if "identify the company name" in prompt:
            return '{"company": "Acme", "role": "Engineer"}'
        if '"interview_process"' in prompt:
            return RESEARCH_JSON
        if '"competencies"' in prompt:
            return REPORT_JSON
        return QUESTIONS_JSON

    monkeypatch.setattr(prepare.llm, "chat", fake_chat)
    monkeypatch.setattr(prepare.moderation, "moderate_output", lambda t: Verdict(allowed=True))


def _setup(client, monkeypatch, email):
    _mock(monkeypatch)
    cookies = _cookies(client, email)
    client.post("/api/cv", cookies=cookies, json={"label": "CV", "text": "python and react projects"})
    client.put("/api/profile", cookies=cookies, json={"jd_text": "Engineer at Acme. Step 1: online test."})
    client.post("/api/profile/research", cookies=cookies)
    client.post("/api/prepare/questions", cookies=cookies)
    client.post("/api/prepare/plan", cookies=cookies)
    return cookies


def _has_research(client, cookies):
    return client.get("/api/profile/research", cookies=cookies).json()["research"] is not None


def _has_questions(client, cookies):
    return bool(client.get("/api/prepare/questions", cookies=cookies).json()["groups"])


def _has_plan(client, cookies):
    plan = client.get("/api/prepare/plan", cookies=cookies).json()
    return bool(plan["competencies"] or plan["plan"])


def test_changing_the_jd_clears_every_tailored_section(client, monkeypatch):
    cookies = _setup(client, monkeypatch, "jdinval@example.com")
    assert _has_research(client, cookies) and _has_questions(client, cookies) and _has_plan(client, cookies)

    client.put("/api/profile", cookies=cookies, json={"jd_text": "A different role at a different company."})
    assert not _has_research(client, cookies)
    assert not _has_questions(client, cookies)
    assert not _has_plan(client, cookies)


def test_changing_the_cv_clears_cv_sections_but_keeps_research(client, monkeypatch):
    cookies = _setup(client, monkeypatch, "cvinval@example.com")
    # a new CV becomes active and changes the active CV text
    client.post("/api/cv", cookies=cookies, json={"label": "CV2", "text": "a totally different background"})
    assert _has_research(client, cookies)  # research does not depend on the CV
    assert not _has_questions(client, cookies)
    assert not _has_plan(client, cookies)
