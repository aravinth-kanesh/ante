import json

from app.services import prepare
from app.services.moderation import Verdict

QUESTIONS_JSON = json.dumps(
    [
        {"question": "Tell me about a project you led.", "rationale": "shows leadership"},
        {"question": "How do you approach debugging a failing test?", "rationale": "technical"},
    ]
)


def auth_header(client, email="prep@example.com"):
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_questions_requires_auth(client):
    assert client.post("/api/prepare/questions").status_code == 401


def test_empty_profile_rejected(client):
    res = client.post("/api/prepare/questions", headers=auth_header(client))
    assert res.status_code == 400


def test_questions_generated(client, monkeypatch):
    monkeypatch.setattr(prepare.llm, "chat", lambda *a, **k: QUESTIONS_JSON)
    monkeypatch.setattr(prepare.moderation, "moderate_output", lambda text: Verdict(allowed=True))

    headers = auth_header(client)
    client.put("/api/profile", headers=headers, json={"cv_text": "my cv", "jd_text": "my jd"})
    res = client.post("/api/prepare/questions", headers=headers)

    assert res.status_code == 200
    questions = res.json()["questions"]
    assert len(questions) == 2
    assert questions[0]["question"] == "Tell me about a project you led."
