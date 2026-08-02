import json

from app.services import prepare
from app.services.moderation import Verdict

QUESTIONS_JSON = json.dumps(
    {
        "groups": [
            {
                "category": "Common questions",
                "questions": [{"question": "Tell me about yourself.", "rationale": "opener"}],
            },
            {
                "category": "Role and technical",
                "questions": [
                    {"question": "How do you approach debugging?", "rationale": "technical"}
                ],
            },
        ]
    }
)


def auth_cookies(client, email="prep@example.com"):
    res = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    )
    client.cookies.clear()  # keep the jar empty so per-request cookies are unambiguous
    return {"access_token": res.cookies["access_token"]}


def test_questions_requires_auth(client):
    assert client.post("/api/prepare/questions").status_code == 401


def test_empty_profile_rejected(client):
    res = client.post("/api/prepare/questions", cookies=auth_cookies(client))
    assert res.status_code == 400


def test_questions_generated(client, monkeypatch):
    monkeypatch.setattr(prepare.llm, "chat", lambda *a, **k: QUESTIONS_JSON)
    monkeypatch.setattr(prepare.moderation, "moderate_output", lambda text: Verdict(allowed=True))

    cookies = auth_cookies(client)
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": "my jd"})
    res = client.post("/api/prepare/questions", cookies=cookies)

    assert res.status_code == 200
    groups = res.json()["groups"]
    assert [g["category"] for g in groups] == ["Common questions", "Role and technical"]
    assert groups[0]["questions"][0]["question"] == "Tell me about yourself."

    # generated questions are persisted and can be read back (survive a reload)
    got = client.get("/api/prepare/questions", cookies=cookies)
    assert got.json()["groups"][0]["questions"][0]["question"] == "Tell me about yourself."


def test_stored_questions_empty_by_default(client):
    got = client.get("/api/prepare/questions", cookies=auth_cookies(client, "empty-q@example.com"))
    assert got.json() == {"groups": []}
