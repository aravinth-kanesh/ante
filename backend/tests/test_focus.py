import json

from app.routers import interview as interview_router
from app.routers import prepare as prepare_router
from app.schemas.preparation import Competency, PreparationReport
from app.services import interview, preparation
from app.services.moderation import Verdict


def auth(client, email="focus@example.com"):
    res = client.post("/api/auth/signup", json={"email": email, "password": "password123"})
    client.cookies.clear()
    return {"access_token": res.cookies["access_token"]}


# --- focus_brief unit tests ---


def test_focus_brief_gaps_lists_weak_competencies():
    prep = PreparationReport(
        competencies=[
            Competency(name="Leadership", status="gap"),
            Competency(name="Stakeholder management", status="partial"),
            Competency(name="Python", status="strong"),
        ]
    ).model_dump_json()
    code, text = interview.focus_brief(prep, "", "gaps")
    assert code == "gaps"
    assert "Leadership" in text and "Stakeholder management" in text
    assert "Python" not in text  # strong competencies are not weak spots


def test_focus_brief_questions_lists_questions():
    questions = json.dumps(
        {"groups": [{"category": "Behavioural", "questions": [{"question": "Tell me about a conflict."}]}]}
    )
    code, text = interview.focus_brief("", questions, "questions")
    assert code == "questions"
    assert "Tell me about a conflict." in text


def test_focus_brief_falls_back_when_absent():
    assert interview.focus_brief("", "", "gaps") == ("", "")
    assert interview.focus_brief("", "", "questions") == ("", "")
    assert interview.focus_brief("x", "y", "balanced") == ("", "")
    all_strong = PreparationReport(competencies=[Competency(name="Python", status="strong")]).model_dump_json()
    assert interview.focus_brief(all_strong, "", "gaps") == ("", "")


# --- integration ---


def _capture_system(monkeypatch):
    """Record the system prompt of each interviewer call, and stop research/LLM calls."""
    systems: list[str] = []

    def fake_chat(messages, *args, **kwargs):
        systems.append(messages[0]["content"])
        return "Tell me about a project."

    monkeypatch.setattr(interview.llm, "chat", fake_chat)
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))
    monkeypatch.setattr(interview_router, "run_research", lambda db, profile: None)
    return systems


def _store_gap_analysis(client, cookies, monkeypatch):
    report = PreparationReport(
        summary="s",
        competencies=[
            Competency(name="Leadership", status="gap", evidence="none on the CV"),
            Competency(name="Stakeholder management", status="partial", evidence="thin"),
        ],
    )
    monkeypatch.setattr(preparation, "analyse", lambda *a, **k: report)
    monkeypatch.setattr(prepare_router, "run_research", lambda db, profile: None)
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": "a role"})
    assert client.post("/api/prepare/plan", cookies=cookies).status_code == 200


def test_start_with_gaps_focus_steers_and_records(client, monkeypatch):
    cookies = auth(client)
    _store_gap_analysis(client, cookies, monkeypatch)
    systems = _capture_system(monkeypatch)

    started = client.post("/api/interview/start", cookies=cookies, json={"focus": "gaps"}).json()
    assert "Leadership" in systems[-1]  # the interviewer prompt was steered at the weak spot

    detail = client.get(f"/api/interview/{started['session_id']}", cookies=cookies).json()
    assert detail["focus"] == "gaps"
    listing = client.get("/api/interview", cookies=cookies).json()
    assert "(weak spots)" in listing[0]["title"]


def test_start_gaps_focus_without_prep_falls_back(client, monkeypatch):
    cookies = auth(client, "focus2@example.com")
    _capture_system(monkeypatch)
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": ""})

    started = client.post("/api/interview/start", cookies=cookies, json={"focus": "gaps"})
    assert started.status_code == 200  # no prep data does not error
    detail = client.get(f"/api/interview/{started.json()['session_id']}", cookies=cookies).json()
    assert detail["focus"] == ""  # fell back to a balanced interview
