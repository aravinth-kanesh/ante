from app.services import research


def auth_header(client, email="research@example.com"):
    token = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_extract_company_role_parses_json(monkeypatch):
    monkeypatch.setattr(
        research.llm,
        "chat",
        lambda *a, **k: 'here: {"company": "Acme", "role": "Graduate Engineer"}',
    )
    company, role = research.extract_company_role("some jd")
    assert company == "Acme" and role == "Graduate Engineer"


def test_extract_company_role_handles_no_json(monkeypatch):
    monkeypatch.setattr(research.llm, "chat", lambda *a, **k: "sorry, unclear")
    assert research.extract_company_role("jd") == ("", "")


def test_research_endpoint_requires_jd(client):
    res = client.post("/api/profile/research", headers=auth_header(client))
    assert res.status_code == 400


def test_research_endpoint_persists(client, monkeypatch):
    monkeypatch.setattr(research, "extract_company_role", lambda jd: ("Acme", "Engineer"))
    monkeypatch.setattr(research, "research_company", lambda c, r: "Acme values craft.")

    headers = auth_header(client)
    client.put("/api/profile", headers=headers, json={"cv_text": "cv", "jd_text": "Acme role"})
    res = client.post("/api/profile/research", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body == {"company": "Acme", "role": "Engineer", "company_context": "Acme values craft."}


def test_questions_autoresearch_grounds_on_company(client, monkeypatch):
    from app.services import prepare
    from app.services.moderation import Verdict

    seen = {}
    monkeypatch.setattr(research, "extract_company_role", lambda jd: ("Acme", "Engineer"))
    monkeypatch.setattr(research, "research_company", lambda c, r: "Acme values craftsmanship.")

    def fake_generate(cv, jd, context="", n=8):
        seen["context"] = context
        return [{"question": "Q", "rationale": "r"}]

    monkeypatch.setattr(prepare, "generate_questions", fake_generate)
    monkeypatch.setattr(prepare.moderation, "moderate_output", lambda t: Verdict(allowed=True))

    headers = auth_header(client, "research2@example.com")
    client.put("/api/profile", headers=headers, json={"cv_text": "cv", "jd_text": "Acme role"})
    res = client.post("/api/prepare/questions", headers=headers)

    assert res.status_code == 200
    assert seen["context"] == "Acme values craftsmanship."  # research fed into generation
