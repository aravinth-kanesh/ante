import json
from datetime import datetime, timezone

from app.models.session import InterviewSession, Turn
from app.services import interview, progress
from app.services.moderation import Verdict

VOICE = {
    "duration_sec": 30.0,
    "word_count": 90,
    "wpm": 150,
    "pause_count": 1,
    "long_pause_count": 0,
    "total_pause_sec": 1.0,
    "filler_count": 3,
    "fillers": {"um": 3},
}
NONVERBAL = {
    "frames_analysed": 100,
    "face_detected": True,
    "eye_contact_pct": 78,
    "head_steadiness": 82,
    "steadiness_label": "steady",
    "smile_pct": 40,
    "posture_pct": 85,
}


def _feedback(strong=0, adequate=0, weak=0, strengths=None, improvements=None):
    notes = (
        [{"question": "Q", "verdict": "strong", "comment": "c"} for _ in range(strong)]
        + [{"question": "Q", "verdict": "adequate", "comment": "c"} for _ in range(adequate)]
        + [{"question": "Q", "verdict": "weak", "comment": "c"} for _ in range(weak)]
    )
    return json.dumps(
        {
            "summary": "ok",
            "strengths": strengths or [],
            "improvements": improvements or [],
            "answer_notes": notes,
            "delivery": "",
        }
    )


def make_session(sid, day, answers, feedback=None, status="finished"):
    """answers: list of dicts with optional 'metrics'/'nonverbal'."""
    turns, idx = [], 0
    for ans in answers:
        turns.append(Turn(index=idx, role="interviewer", kind="question", content="Q"))
        idx += 1
        turns.append(
            Turn(
                index=idx,
                role="candidate",
                kind="answer",
                content="an answer",
                metrics=json.dumps(ans["metrics"]) if ans.get("metrics") else None,
                nonverbal=json.dumps(ans["nonverbal"]) if ans.get("nonverbal") else None,
            )
        )
        idx += 1
    if feedback is not None:
        turns.append(Turn(index=idx, role="interviewer", kind="feedback", content=feedback))
    return InterviewSession(
        id=sid,
        company="Acme",
        role="Analyst",
        interview_type="behavioural",
        created_at=datetime(2026, 1, day, tzinfo=timezone.utc),
        status=status,
        turns=turns,
    )


def test_session_stats_aggregates_voice_and_verdicts():
    session = make_session(
        1, 1, [{"metrics": VOICE, "nonverbal": NONVERBAL}], _feedback(strong=2, weak=1)
    )
    stats = progress.session_stats(session)
    assert stats.answered_count == 1
    assert stats.avg_wpm == 150
    assert stats.filler_per_min == 6.0  # 3 fillers over 0.5 minutes
    assert stats.eye_contact_pct == 78 and stats.head_steadiness == 82
    assert stats.verdicts.strong == 2 and stats.verdicts.weak == 1
    assert stats.strong_rate == 0.67  # 2 of 3
    assert stats.has_delivery and stats.has_nonverbal


def test_session_stats_text_only_has_quality_but_no_delivery():
    session = make_session(1, 1, [{}, {}], _feedback(strong=1, adequate=1))
    stats = progress.session_stats(session)
    assert stats.answered_count == 2
    assert stats.strong_rate == 0.5  # answer quality still works for typed interviews
    assert stats.avg_wpm is None and stats.filler_per_min is None
    assert stats.eye_contact_pct is None
    assert stats.has_delivery is False and stats.has_nonverbal is False


def test_build_report_deltas_and_totals():
    worse = make_session(
        1, 1, [{"metrics": {**VOICE, "filler_count": 10}}], _feedback(strong=1, weak=1,
        improvements=["Give a concrete example"]),
    )
    better = make_session(
        2, 2, [{"metrics": {**VOICE, "filler_count": 1}}], _feedback(strong=2,
        strengths=["Clear structure"], improvements=["Give a concrete example"]),
    )
    report = progress.build_report([worse, better])

    assert report.totals.interviews == 2
    assert report.totals.questions_answered == 2
    assert report.totals.minutes_practised == 1  # 30s + 30s

    by = {d.metric: d for d in report.deltas}
    assert by["strong_rate"].direction == "improved"  # 0.5 -> 1.0
    assert by["filler_per_min"].direction == "improved"  # 20 -> 2, lower is better
    assert by["filler_per_min"].lower_is_better is True
    assert by["wpm"].direction == "steady"  # unchanged
    assert by["strong_rate"].good_low == 0.5

    # recurring feedback is deduplicated across sessions
    assert report.focus_areas == ["Give a concrete example"]
    assert report.strengths == ["Clear structure"]


def test_focus_areas_collapse_recurring_theme():
    # The same advice reworded across interviews should appear once, not once each.
    s1 = make_session(
        1, 1, [{"metrics": VOICE}],
        _feedback(strong=1, improvements=[
            "Use the STAR structure (Situation, Task, Action, Result) to give concrete detail from your projects."
        ]),
    )
    s2 = make_session(
        2, 2, [{"metrics": VOICE}],
        _feedback(strong=1, improvements=[
            "Use the STAR method (Situation, Task, Action, Result) to structure answers with concrete detail."
        ]),
    )
    report = progress.build_report([s1, s2])
    assert len(report.focus_areas) == 1


def test_build_report_empty():
    report = progress.build_report([])
    assert report.totals.interviews == 0
    assert report.sessions == [] and report.deltas == []


def test_progress_requires_auth(client):
    assert client.get("/api/progress").status_code == 401


def _mock_interview(monkeypatch):
    def fake_chat(messages, *args, **kwargs):
        if "Transcript:" in messages[-1]["content"]:  # the feedback prompt
            return _feedback(strong=1, improvements=["Add more detail"])
        return "Tell me about a project."

    monkeypatch.setattr(interview.llm, "chat", fake_chat)
    monkeypatch.setattr(interview.moderation, "moderate_output", lambda t: Verdict(allowed=True))


def test_progress_endpoint_reflects_a_finished_interview(client, monkeypatch):
    _mock_interview(monkeypatch)
    res = client.post("/api/auth/signup", json={"email": "prog@example.com", "password": "password123"})
    client.cookies.clear()
    cookies = {"access_token": res.cookies["access_token"]}
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": ""})

    sid = client.post("/api/interview/start", cookies=cookies, json={"mode": "voice"}).json()["session_id"]
    client.post(
        f"/api/interview/{sid}/answer",
        cookies=cookies,
        json={"answer": "I built X.", "metrics": VOICE, "nonverbal": NONVERBAL},
    )
    client.post(f"/api/interview/{sid}/finish", cookies=cookies)

    report = client.get("/api/progress", cookies=cookies).json()
    assert report["totals"]["interviews"] == 1
    assert report["totals"]["questions_answered"] == 1
    assert report["sessions"][0]["has_delivery"] is True
    assert report["sessions"][0]["strong_rate"] == 1.0
    assert report["focus_areas"] == ["Add more detail"]


def test_describe_reads_as_plain_text():
    sessions = [
        make_session(1, 1, [{"metrics": VOICE}], _feedback(strong=1, weak=1)),
        make_session(2, 2, [{"metrics": {**VOICE, "wpm": 135}}], _feedback(strong=2)),
    ]
    text = progress.describe(progress.build_report(sessions))
    assert "Interviews completed: 2." in text
    assert "Strong-answer rate:" in text
    assert "Speaking pace:" in text


def test_coach_summary_narrates_the_trends(client, monkeypatch):
    _mock_interview(monkeypatch)
    res = client.post("/api/auth/signup", json={"email": "coach@example.com", "password": "password123"})
    client.cookies.clear()
    cookies = {"access_token": res.cookies["access_token"]}
    client.put("/api/profile", cookies=cookies, json={"cv_text": "my cv", "jd_text": ""})
    sid = client.post("/api/interview/start", cookies=cookies, json={"mode": "voice"}).json()["session_id"]
    client.post(f"/api/interview/{sid}/answer", cookies=cookies, json={"answer": "I built X.", "metrics": VOICE})
    client.post(f"/api/interview/{sid}/finish", cookies=cookies)

    # the summary is its own model call, so mock what the coach returns
    monkeypatch.setattr(
        interview.llm, "chat", lambda *a, **k: "You are giving stronger answers than when you started."
    )
    summary = client.get("/api/progress/summary", cookies=cookies).json()["summary"]
    assert "stronger answers" in summary


def test_coach_summary_without_interviews_is_a_prompt_to_start(client):
    res = client.post("/api/auth/signup", json={"email": "noprog@example.com", "password": "password123"})
    client.cookies.clear()
    cookies = {"access_token": res.cookies["access_token"]}
    summary = client.get("/api/progress/summary", cookies=cookies).json()["summary"]
    assert "not done any interviews" in summary
