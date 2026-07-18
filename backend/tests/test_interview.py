from app.services import interview
from app.services.moderation import Verdict


def auth_header(client, email="iv@example.com"):
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def save_cv(client, headers):
    client.put("/api/profile", headers=headers, json={"cv_text": "my cv", "jd_text": ""})


def mock_llm(monkeypatch):
    monkeypatch.setattr(interview.llm, "chat", lambda *a, **k: "Tell me about a project.")
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))


def test_requires_auth(client):
    assert client.post("/api/interview/start").status_code == 401


def test_start_requires_cv(client, monkeypatch):
    mock_llm(monkeypatch)
    assert client.post("/api/interview/start", headers=auth_header(client)).status_code == 400


def test_start_and_answer_flow(client, monkeypatch):
    mock_llm(monkeypatch)
    monkeypatch.setattr(interview.settings, "interview_max_questions", 2)
    headers = auth_header(client)
    save_cv(client, headers)

    started = client.post("/api/interview/start", headers=headers).json()
    sid = started["session_id"]
    assert started["question"]

    first = client.post(
        f"/api/interview/{sid}/answer", headers=headers, json={"answer": "I built X."}
    ).json()
    assert first["done"] is False and first["question"]

    second = client.post(
        f"/api/interview/{sid}/answer", headers=headers, json={"answer": "And Y."}
    ).json()
    assert second["done"] is True and second["question"] is None


def test_finish_and_locks_session(client, monkeypatch):
    mock_llm(monkeypatch)
    headers = auth_header(client)
    save_cv(client, headers)
    sid = client.post("/api/interview/start", headers=headers).json()["session_id"]

    feedback = client.post(f"/api/interview/{sid}/finish", headers=headers).json()
    assert feedback["feedback"]

    later = client.post(f"/api/interview/{sid}/answer", headers=headers, json={"answer": "x"})
    assert later.status_code == 400


def test_ownership(client, monkeypatch):
    mock_llm(monkeypatch)
    owner = auth_header(client, "owner@example.com")
    save_cv(client, owner)
    sid = client.post("/api/interview/start", headers=owner).json()["session_id"]

    intruder = auth_header(client, "intruder@example.com")
    assert client.get(f"/api/interview/{sid}", headers=intruder).status_code == 404
    assert (
        client.post(
            f"/api/interview/{sid}/answer", headers=intruder, json={"answer": "x"}
        ).status_code
        == 404
    )


def test_start_defaults_to_text_mode(client, monkeypatch):
    mock_llm(monkeypatch)
    headers = auth_header(client)
    save_cv(client, headers)

    started = client.post("/api/interview/start", headers=headers).json()
    assert started["mode"] == "text"


def test_start_records_voice_mode(client, monkeypatch):
    mock_llm(monkeypatch)
    headers = auth_header(client)
    save_cv(client, headers)

    started = client.post("/api/interview/start", headers=headers, json={"mode": "voice"}).json()
    assert started["mode"] == "voice"

    transcript = client.get(f"/api/interview/{started['session_id']}", headers=headers).json()
    assert transcript["mode"] == "voice"


def test_start_rejects_unknown_mode(client, monkeypatch):
    mock_llm(monkeypatch)
    headers = auth_header(client)
    save_cv(client, headers)

    res = client.post("/api/interview/start", headers=headers, json={"mode": "telepathy"})
    assert res.status_code == 422


def test_transcript(client, monkeypatch):
    mock_llm(monkeypatch)
    headers = auth_header(client)
    save_cv(client, headers)
    sid = client.post("/api/interview/start", headers=headers).json()["session_id"]
    client.post(f"/api/interview/{sid}/answer", headers=headers, json={"answer": "answer one"})

    transcript = client.get(f"/api/interview/{sid}", headers=headers).json()
    assert transcript["status"] == "active"
    kinds = [t["kind"] for t in transcript["turns"]]
    assert "question" in kinds and "answer" in kinds
