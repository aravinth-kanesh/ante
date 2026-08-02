from app.services import interview, research
from app.services.moderation import Verdict


def auth_cookies(client, email="iv@example.com"):
    res = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    )
    client.cookies.clear()  # keep the jar empty so per-request cookies are unambiguous
    return {"access_token": res.cookies["access_token"]}


def save_cv(client, cookies):
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": ""})


def mock_llm(monkeypatch):
    monkeypatch.setattr(interview.llm, "chat", lambda *a, **k: "Tell me about a project.")
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))


def test_requires_auth(client):
    assert client.post("/api/interview/start").status_code == 401


def test_start_requires_cv(client, monkeypatch):
    mock_llm(monkeypatch)
    assert client.post("/api/interview/start", cookies=auth_cookies(client)).status_code == 400


def test_interview_type_defaults_to_general(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    assert client.post("/api/interview/start", cookies=cookies).json()["interview_type"] == "general"


def test_interview_type_shapes_the_prompt(client, monkeypatch):
    captured = {}

    def fake_chat(messages, *args, **kwargs):
        captured["system"] = messages[0]["content"]
        return "Tell me about a time when you led a team."

    monkeypatch.setattr(interview.llm, "chat", fake_chat)
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))
    cookies = auth_cookies(client)
    save_cv(client, cookies)

    res = client.post(
        "/api/interview/start", cookies=cookies, json={"interview_type": "competency"}
    ).json()
    assert res["interview_type"] == "competency"
    assert "competency-based interview" in captured["system"]
    # every type must forbid questions the candidate cannot answer out loud
    assert "write or run code" in captured["system"]


def test_interview_type_rejects_unknown(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    res = client.post("/api/interview/start", cookies=cookies, json={"interview_type": "coding"})
    assert res.status_code == 422


def test_start_and_answer_flow(client, monkeypatch):
    mock_llm(monkeypatch)
    monkeypatch.setattr(interview.settings, "interview_max_questions", 2)
    cookies = auth_cookies(client)
    save_cv(client, cookies)

    started = client.post("/api/interview/start", cookies=cookies).json()
    sid = started["session_id"]
    assert started["question"]

    first = client.post(
        f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "I built X."}
    ).json()
    assert first["done"] is False and first["question"]

    second = client.post(
        f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "And Y."}
    ).json()
    assert second["done"] is True and second["question"] is None


def test_finish_and_locks_session(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]

    feedback = client.post(f"/api/interview/{sid}/finish", cookies=cookies).json()
    assert feedback["feedback"]

    later = client.post(f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "x"})
    assert later.status_code == 400


def test_ownership(client, monkeypatch):
    mock_llm(monkeypatch)
    owner = auth_cookies(client, "owner@example.com")
    save_cv(client, owner)
    sid = client.post("/api/interview/start", cookies=owner).json()["session_id"]

    intruder = auth_cookies(client, "intruder@example.com")
    assert client.get(f"/api/interview/{sid}", cookies=intruder).status_code == 404
    assert (
        client.post(
            f"/api/interview/{sid}/answer", cookies=intruder, json={"answer": "x"}
        ).status_code
        == 404
    )


def test_start_defaults_to_text_mode(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)

    started = client.post("/api/interview/start", cookies=cookies).json()
    assert started["mode"] == "text"


def test_start_records_voice_mode(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)

    started = client.post("/api/interview/start", cookies=cookies, json={"mode": "voice"}).json()
    assert started["mode"] == "voice"

    transcript = client.get(f"/api/interview/{started['session_id']}", cookies=cookies).json()
    assert transcript["mode"] == "voice"


def test_start_rejects_unknown_mode(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)

    res = client.post("/api/interview/start", cookies=cookies, json={"mode": "telepathy"})
    assert res.status_code == 422


VOICE_METRICS = {
    "duration_sec": 20.0,
    "word_count": 60,
    "wpm": 180,
    "pause_count": 2,
    "long_pause_count": 1,
    "total_pause_sec": 3.0,
    "filler_count": 3,
    "fillers": {"like": 2, "um": 1},
}


def _capture_prompts(monkeypatch):
    """Mock the LLM to record the last user prompt of each call."""
    prompts: list[str] = []

    def fake_chat(messages, *args, **kwargs):
        prompts.append(messages[-1]["content"])
        return "Tell me about a project."

    monkeypatch.setattr(interview.llm, "chat", fake_chat)
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))
    return prompts


def test_feedback_includes_delivery_when_metrics_present(client, monkeypatch):
    prompts = _capture_prompts(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post(
        "/api/interview/start", cookies=cookies, json={"mode": "voice"}
    ).json()["session_id"]

    client.post(
        f"/api/interview/{sid}/answer",
        cookies=cookies,
        json={"answer": "I built X.", "metrics": VOICE_METRICS},
    )
    client.post(f"/api/interview/{sid}/finish", cookies=cookies)

    feedback_prompt = prompts[-1]
    assert "speaking pace, pauses and filler words" in feedback_prompt
    assert "180 words per minute" in feedback_prompt


NONVERBAL_METRICS = {
    "frames_analysed": 100,
    "face_detected": True,
    "eye_contact_pct": 78,
    "head_steadiness": 82,
    "steadiness_label": "steady",
    "smile_pct": 40,
    "posture_pct": 85,
}


def test_feedback_includes_nonverbal_when_present(client, monkeypatch):
    prompts = _capture_prompts(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post(
        "/api/interview/start", cookies=cookies, json={"mode": "voice"}
    ).json()["session_id"]

    client.post(
        f"/api/interview/{sid}/answer",
        cookies=cookies,
        json={"answer": "I led the team.", "metrics": VOICE_METRICS, "nonverbal": NONVERBAL_METRICS},
    )
    client.post(f"/api/interview/{sid}/finish", cookies=cookies)

    prompt = prompts[-1]
    assert "eye contact, composure and posture" in prompt
    assert "look at the camera about 78%" in prompt
    assert "diagnose emotion" in prompt


def test_feedback_is_structured_and_plain_text(client, monkeypatch):
    reply = (
        '{"summary": "### **Weak** overall.", "strengths": [], '
        '"improvements": ["Give a **specific** example."], '
        '"answer_notes": [{"question": "About you", "verdict": "weak", "comment": "Too vague."}], '
        '"delivery": "Slow pace."}'
    )
    monkeypatch.setattr(interview.llm, "chat", lambda *a, **k: reply)
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]

    report = client.post(f"/api/interview/{sid}/finish", cookies=cookies).json()["feedback"]
    assert report["summary"] == "Weak overall."  # markdown stripped
    assert report["strengths"] == []  # not padded with faint praise
    assert report["improvements"] == ["Give a specific example."]
    assert report["answer_notes"][0]["verdict"] == "weak"

    # the stored transcript exposes the same structured report
    detail = client.get(f"/api/interview/{sid}", cookies=cookies).json()
    assert detail["feedback"]["summary"] == "Weak overall."


def test_regenerate_upgrades_legacy_feedback(client, monkeypatch):
    # finish once with the old plain-text style stored directly on the turn
    mock_llm(monkeypatch)
    cookies = auth_cookies(client, "regen@example.com")
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]
    client.post(f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "an answer"})
    client.post(f"/api/interview/{sid}/finish", cookies=cookies)

    # now the model returns a structured assessment; regenerate should adopt it
    structured = '{"summary": "Solid.", "strengths": ["Clear example"], "improvements": []}'
    monkeypatch.setattr(interview.llm, "chat", lambda *a, **k: structured)
    report = client.post(f"/api/interview/{sid}/feedback", cookies=cookies).json()["feedback"]
    assert report["summary"] == "Solid."
    assert report["strengths"] == ["Clear example"]

    # the transcript exposes the upgraded feedback and only one feedback turn exists
    detail = client.get(f"/api/interview/{sid}", cookies=cookies).json()
    assert detail["feedback"]["strengths"] == ["Clear example"]
    assert sum(1 for t in detail["turns"] if t["kind"] == "feedback") == 1


def test_regenerate_requires_answers(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client, "regen-empty@example.com")
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]
    assert client.post(f"/api/interview/{sid}/feedback", cookies=cookies).status_code == 400


def test_parse_feedback_falls_back_to_prose():
    report = interview.parse_feedback("Just some prose, no JSON here.")
    assert report.summary == "Just some prose, no JSON here."
    assert report.strengths == [] and report.improvements == []


def test_feedback_has_no_delivery_block_for_typed_answers(client, monkeypatch):
    prompts = _capture_prompts(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]

    client.post(f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "I built X."})
    client.post(f"/api/interview/{sid}/finish", cookies=cookies)

    assert "was measured during the interview" not in prompts[-1]


def test_transcript_exposes_metrics(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post(
        "/api/interview/start", cookies=cookies, json={"mode": "voice"}
    ).json()["session_id"]
    client.post(
        f"/api/interview/{sid}/answer",
        cookies=cookies,
        json={"answer": "spoken", "metrics": VOICE_METRICS, "nonverbal": NONVERBAL_METRICS},
    )

    turns = client.get(f"/api/interview/{sid}", cookies=cookies).json()["turns"]
    answer_turn = next(t for t in turns if t["kind"] == "answer")
    assert answer_turn["metrics"]["wpm"] == 180
    assert answer_turn["nonverbal"]["eye_contact_pct"] == 78
    question_turn = next(t for t in turns if t["kind"] == "question")
    assert question_turn["metrics"] is None and question_turn["nonverbal"] is None


def test_transcript_null_metrics_for_typed_answer(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]
    client.post(f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "typed"})

    turns = client.get(f"/api/interview/{sid}", cookies=cookies).json()["turns"]
    answer_turn = next(t for t in turns if t["kind"] == "answer")
    assert answer_turn["metrics"] is None and answer_turn["nonverbal"] is None


def test_list_sessions_newest_first_and_scoped(client, monkeypatch):
    mock_llm(monkeypatch)
    owner = auth_cookies(client, "hist-owner@example.com")
    save_cv(client, owner)
    sid1 = client.post("/api/interview/start", cookies=owner).json()["session_id"]
    sid2 = client.post("/api/interview/start", cookies=owner).json()["session_id"]

    other = auth_cookies(client, "hist-other@example.com")
    save_cv(client, other)
    client.post("/api/interview/start", cookies=other)

    listing = client.get("/api/interview", cookies=owner).json()
    assert [s["id"] for s in listing] == [sid2, sid1]  # newest first, owner's only
    assert listing[0]["question_count"] == 1
    assert listing[0]["preview"]


def test_list_sessions_requires_auth(client):
    assert client.get("/api/interview").status_code == 401


def test_list_backfills_company_for_older_sessions(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client, "backfill@example.com")
    save_cv(client, cookies)
    client.put("/api/profile", cookies=cookies, json={"jd_text": "Ciena engineer role"})

    from app.schemas.profile import CompanyResearch

    # the first run could not identify the company, so the session recorded none
    monkeypatch.setattr(research, "extract_company_role", lambda jd: ("", ""))
    monkeypatch.setattr(research, "research_company", lambda c, r: CompanyResearch())
    client.post("/api/interview/start", cookies=cookies)
    assert client.get("/api/interview", cookies=cookies).json()[0]["title"] == "General Interview"

    # research later identifies the company for the same job description
    monkeypatch.setattr(research, "extract_company_role", lambda jd: ("Ciena", "Engineer"))
    monkeypatch.setattr(research, "research_company", lambda c, r: CompanyResearch(overview="ctx"))
    client.post("/api/profile/research", cookies=cookies)

    titles = [s["title"] for s in client.get("/api/interview", cookies=cookies).json()]
    assert titles == ["Ciena - General Interview for Engineer"]


def test_session_title_formats():
    assert (
        interview.session_title("Cognizant", "Software Engineer Intern", "behavioural")
        == "Cognizant - Behavioural Interview for Software Engineer Intern"
    )
    # repeats of the same kind are numbered, the first is not
    assert (
        interview.session_title("Cognizant", "Software Engineer Intern", "behavioural", 2)
        == "Cognizant - Behavioural Interview for Software Engineer Intern 2"
    )
    # graceful when the company or role is unknown
    assert interview.session_title("", "", "technical") == "Technical Interview"
    assert interview.session_title("", "Analyst", "general") == "General Interview for Analyst"


def test_list_sessions_titles_number_repeats(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client, "titles@example.com")
    save_cv(client, cookies)
    # research fills company/role on the profile, which the session snapshots
    from app.schemas.profile import CompanyResearch

    monkeypatch.setattr(research, "extract_company_role", lambda jd: ("Cognizant", "Analyst"))
    monkeypatch.setattr(research, "research_company", lambda c, r: CompanyResearch(overview="ctx"))
    client.put("/api/profile", cookies=cookies, json={"jd_text": "Cognizant analyst role"})

    for _ in range(2):
        client.post("/api/interview/start", cookies=cookies, json={"interview_type": "behavioural"})

    titles = [s["title"] for s in client.get("/api/interview", cookies=cookies).json()]
    # newest first, so the second (numbered) session comes first
    assert titles == [
        "Cognizant - Behavioural Interview for Analyst 2",
        "Cognizant - Behavioural Interview for Analyst",
    ]


def test_delete_session(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]

    assert client.delete(f"/api/interview/{sid}", cookies=cookies).status_code == 200
    assert client.get(f"/api/interview/{sid}", cookies=cookies).status_code == 404
    assert client.get("/api/interview", cookies=cookies).json() == []


def test_delete_session_ownership(client, monkeypatch):
    mock_llm(monkeypatch)
    owner = auth_cookies(client, "del-owner@example.com")
    save_cv(client, owner)
    sid = client.post("/api/interview/start", cookies=owner).json()["session_id"]

    intruder = auth_cookies(client, "del-intruder@example.com")
    assert client.delete(f"/api/interview/{sid}", cookies=intruder).status_code == 404
    # still there for the owner
    assert client.get(f"/api/interview/{sid}", cookies=owner).status_code == 200


def test_transcript(client, monkeypatch):
    mock_llm(monkeypatch)
    cookies = auth_cookies(client)
    save_cv(client, cookies)
    sid = client.post("/api/interview/start", cookies=cookies).json()["session_id"]
    client.post(f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "answer one"})

    transcript = client.get(f"/api/interview/{sid}", cookies=cookies).json()
    assert transcript["status"] == "active"
    kinds = [t["kind"] for t in transcript["turns"]]
    assert "question" in kinds and "answer" in kinds
