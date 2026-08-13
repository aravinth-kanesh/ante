from app.config import settings
from app.services import research, websearch


def auth_cookies(client, email="research@example.com"):
    res = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    )
    client.cookies.clear()  # keep the jar empty so per-request cookies are unambiguous
    return {"access_token": res.cookies["access_token"]}


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


def test_research_output_is_structured_and_plain(monkeypatch):
    reply = (
        '{"overview": "## Culture\\n**Acme** values craft.", '
        '"interview_process": "Two `stages`.", "skills": ["*Python*", "  "], "tips": []}'
    )
    monkeypatch.setattr(research.llm, "chat", lambda *a, **k: reply)
    report = research.research_company("Acme", "Engineer")
    assert "*" not in report.overview and "#" not in report.overview
    assert "`" not in report.interview_process
    assert "Acme values craft." in report.overview
    assert report.skills == ["Python"]  # blank dropped, markdown stripped


def test_web_search_is_off_by_default():
    # The self-contained default makes no external search call and no grounding.
    assert settings.web_search_enabled is False
    assert websearch.search("Acme") == []


def test_research_is_ungrounded_when_web_search_off(monkeypatch):
    prompts = []
    monkeypatch.setattr(research.llm, "chat", lambda messages, *a, **k: prompts.append(messages[-1]["content"]) or "{}")
    research.research_company("Acme", "Engineer")
    assert "web search results" not in prompts[-1]


def test_research_is_grounded_when_web_search_returns_snippets(monkeypatch):
    monkeypatch.setattr(settings, "web_search_enabled", True)
    monkeypatch.setattr(
        research.websearch, "search", lambda q, *a, **k: ["Acme Ltd makes climbing gear."]
    )
    prompts = []
    monkeypatch.setattr(research.llm, "chat", lambda messages, *a, **k: prompts.append(messages[-1]["content"]) or "{}")
    research.research_company("Acme", "Engineer")
    assert "Acme Ltd makes climbing gear." in prompts[-1]
    assert "web search results" in prompts[-1]


def test_render_flattens_structured_research():
    from app.schemas.profile import CompanyResearch

    text = research.render(
        CompanyResearch(overview="Acme.", interview_process="Two stages.", skills=["Python", "SQL"])
    )
    assert "Acme." in text and "Interview process: Two stages." in text
    assert "Key skills: Python, SQL" in text


def test_research_endpoint_requires_jd(client):
    res = client.post("/api/profile/research", cookies=auth_cookies(client))
    assert res.status_code == 400


def test_research_endpoint_persists_and_reads_back(client, monkeypatch):
    from app.schemas.profile import CompanyResearch

    report = CompanyResearch(
        overview="Acme values craft.", interview_process="Two stages.", skills=["Python"]
    )
    monkeypatch.setattr(research, "extract_company_role", lambda jd: ("Acme", "Engineer"))
    monkeypatch.setattr(research, "research_company", lambda c, r: report)

    cookies = auth_cookies(client)
    client.put("/api/profile", cookies=cookies, json={"cv_text": "cv", "jd_text": "Acme role"})
    body = client.post("/api/profile/research", cookies=cookies).json()
    assert body["company"] == "Acme" and body["role"] == "Engineer"
    assert body["research"]["overview"] == "Acme values craft."
    assert body["research"]["skills"] == ["Python"]

    # the stored research can be read back on load
    got = client.get("/api/profile/research", cookies=cookies).json()
    assert got["research"]["interview_process"] == "Two stages."


def test_read_research_empty_when_none(client):
    got = client.get("/api/profile/research", cookies=auth_cookies(client, "noresearch@example.com"))
    assert got.json()["research"] is None


def test_questions_autoresearch_grounds_on_company(client, monkeypatch):
    from app.schemas.profile import CompanyResearch
    from app.services import prepare
    from app.services.moderation import Verdict

    seen = {}
    monkeypatch.setattr(research, "extract_company_role", lambda jd: ("Acme", "Engineer"))
    monkeypatch.setattr(
        research, "research_company", lambda c, r: CompanyResearch(overview="Acme values craftsmanship.")
    )

    def fake_generate(cv, jd, context=""):
        seen["context"] = context
        return [{"category": "Common questions", "questions": [{"question": "Q", "rationale": "r"}]}]

    monkeypatch.setattr(prepare, "generate_questions", fake_generate)
    monkeypatch.setattr(prepare.moderation, "moderate_output", lambda t: Verdict(allowed=True))

    cookies = auth_cookies(client, "research2@example.com")
    client.put("/api/profile", cookies=cookies, json={"cv_text": "cv", "jd_text": "Acme role"})
    res = client.post("/api/prepare/questions", cookies=cookies)

    assert res.status_code == 200
    assert seen["context"] == "Acme values craftsmanship."  # research fed into generation
