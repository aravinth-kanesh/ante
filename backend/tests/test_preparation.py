import json

from app.services import preparation
from app.services.moderation import Verdict

REPORT_JSON = json.dumps(
    {
        "summary": "A solid fit for the technical side, with a gap on leadership.",
        "competencies": [
            {
                "name": "Python",
                "area": "technical",
                "status": "strong",
                "evidence": "CV shows a Python API project.",
            },
            {
                "name": "Leadership",
                "area": "behavioural",
                "status": "gap",
                "evidence": "No evidence of leading a team.",
            },
        ],
        "plan": [
            {
                "focus": "Leadership",
                "action": "Prepare a STAR story about taking initiative.",
                "priority": "high",
            }
        ],
    }
)


def auth_header(client, email="plan@example.com"):
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def setup_profile(client, headers):
    client.post("/api/cv", headers=headers, json={"label": "CV", "text": "Built a Python API."})
    client.put("/api/profile", headers=headers, json={"jd_text": "Graduate engineer, Python."})


def mock_llm(monkeypatch):
    monkeypatch.setattr(preparation.llm, "chat", lambda *a, **k: REPORT_JSON)
    monkeypatch.setattr(preparation.moderation, "moderate_output", lambda t: Verdict(allowed=True))
    # skip live company research when grounding
    monkeypatch.setattr("app.routers.prepare.run_research", lambda db, profile: None)


def test_plan_requires_auth(client):
    assert client.post("/api/prepare/plan").status_code == 401
    assert client.get("/api/prepare/plan").status_code == 401


def test_plan_requires_cv_and_jd(client, monkeypatch):
    mock_llm(monkeypatch)
    headers = auth_header(client, "plan-empty@example.com")
    assert client.post("/api/prepare/plan", headers=headers).status_code == 400  # no CV
    client.post("/api/cv", headers=headers, json={"label": "CV", "text": "cv"})
    assert client.post("/api/prepare/plan", headers=headers).status_code == 400  # no JD


def test_plan_is_structured_and_persisted(client, monkeypatch):
    mock_llm(monkeypatch)
    headers = auth_header(client)
    setup_profile(client, headers)

    report = client.post("/api/prepare/plan", headers=headers).json()
    assert "gap on leadership" in report["summary"]
    statuses = {c["name"]: c["status"] for c in report["competencies"]}
    assert statuses == {"Python": "strong", "Leadership": "gap"}
    assert report["plan"][0]["priority"] == "high"

    # persisted: reading it back returns the same report (survives a reload)
    got = client.get("/api/prepare/plan", headers=headers).json()
    assert got["competencies"][1]["name"] == "Leadership"


def test_stored_plan_empty_by_default(client):
    got = client.get("/api/prepare/plan", headers=auth_header(client, "noplan@example.com"))
    assert got.json() == {"summary": "", "competencies": [], "plan": []}


def test_analyse_survives_a_moderation_false_block(monkeypatch):
    calls = {"n": 0}

    def flaky(text):
        calls["n"] += 1
        return Verdict(allowed=calls["n"] > 1)  # first block, then allow

    monkeypatch.setattr(preparation.llm, "chat", lambda *a, **k: REPORT_JSON)
    monkeypatch.setattr(preparation.moderation, "moderate_output", flaky)
    report = preparation.analyse("cv", "jd", "context")
    assert len(report.competencies) == 2  # not hard-failed


def test_analyse_markdown_is_stripped(monkeypatch):
    reply = json.dumps(
        {
            "summary": "## Strong **fit**.",
            "competencies": [
                {"name": "*Python*", "area": "technical", "status": "strong", "evidence": "`code`"}
            ],
            "plan": [{"focus": "x", "action": "**Practise**", "priority": "high"}],
        }
    )
    monkeypatch.setattr(preparation.llm, "chat", lambda *a, **k: reply)
    monkeypatch.setattr(preparation.moderation, "moderate_output", lambda t: Verdict(allowed=True))
    report = preparation.analyse("cv", "jd")
    assert report.summary == "Strong fit." and report.competencies[0].name == "Python"
    assert report.plan[0].action == "Practise"
