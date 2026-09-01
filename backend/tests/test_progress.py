import json
from datetime import datetime, timedelta, timezone

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


def make_session(sid, day, answers, feedback=None, status="finished", answer_secs=None):
    """answers: list of dicts with optional 'metrics'/'nonverbal'. answer_secs optionally
    gives the wall-clock seconds between each question and its answer (default 60)."""
    base = datetime(2026, 1, day, 9, 0, tzinfo=timezone.utc)
    turns, idx = [], 0
    clock = base
    for a_i, ans in enumerate(answers):
        turns.append(Turn(index=idx, role="interviewer", kind="question", content="Q", created_at=clock))
        idx += 1
        clock += timedelta(seconds=answer_secs[a_i] if answer_secs else 60)
        turns.append(
            Turn(
                index=idx,
                role="candidate",
                kind="answer",
                content="an answer",
                metrics=json.dumps(ans["metrics"]) if ans.get("metrics") else None,
                nonverbal=json.dumps(ans["nonverbal"]) if ans.get("nonverbal") else None,
                created_at=clock,
            )
        )
        idx += 1
        clock += timedelta(seconds=3)  # short model pause before the next question
    if feedback is not None:
        turns.append(Turn(index=idx, role="interviewer", kind="feedback", content=feedback, created_at=clock))
    return InterviewSession(
        id=sid,
        company="Acme",
        role="Analyst",
        interview_type="behavioural",
        created_at=base,
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


def test_minutes_practised_is_wall_clock_including_thinking():
    # Practice time is the gap from each question to its answer, so thinking time counts,
    # the same way for voice and text.
    voice = make_session(1, 1, [{"metrics": VOICE}, {"metrics": VOICE}], _feedback(strong=2),
                         answer_secs=[120, 150])  # 4.5 minutes of answering
    text = make_session(2, 2, [{}], _feedback(strong=1), answer_secs=[90])  # 1.5 minutes
    report = progress.build_report([voice, text])
    assert report.totals.minutes_practised == 6  # 270s + 90s = 360s


def test_minutes_practised_caps_a_long_idle_gap():
    # An interview left open (or resumed much later) must not inflate the total: each
    # answer's time is capped.
    session = make_session(1, 1, [{}], _feedback(strong=1), answer_secs=[3600])  # an hour idle
    report = progress.build_report([session])
    assert report.totals.minutes_practised == 10  # capped at the 10-minute per-answer limit


def test_wpm_trend_is_measured_against_the_good_range():
    # Speaking pace is two-sided (110 to 160 is comfortable), so slowing from too fast into
    # the range is an improvement, and speeding up out of it is a slip.
    assert progress._direction("wpm", 185.0, 140.0) == "improved"  # too fast -> in range
    assert progress._direction("wpm", 90.0, 130.0) == "improved"  # too slow -> in range
    assert progress._direction("wpm", 140.0, 185.0) == "slipped"  # in range -> too fast
    assert progress._direction("wpm", 130.0, 150.0) == "steady"  # both comfortable
    # filler words stay one-sided: fewer is always better
    assert progress._direction("filler_per_min", 8.0, 2.0) == "improved"


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
    assert report.totals.minutes_practised == 2  # 60s + 60s of wall-clock answering

    by = {d.metric: d for d in report.deltas}
    assert by["strong_rate"].direction == "improved"  # 0.5 -> 1.0
    assert by["filler_per_min"].direction == "improved"  # 20 -> 2, lower is better
    assert by["filler_per_min"].lower_is_better is True
    assert by["wpm"].direction == "steady"  # unchanged
    assert by["strong_rate"].good_low == 0.5

    # focus and strengths are derived from the metrics; the latest interview is in range
    assert report.focus_areas == []
    assert "A good share of your answers are landing as strong." in report.strengths


def test_progress_focus_is_general_and_metric_driven():
    # Weak answers and heavy fillers produce general, transferable coaching drawn from the
    # metrics, never company- or role-specific text (make_session uses company "Acme").
    session = make_session(
        1, 1, [{"metrics": {**VOICE, "filler_count": 20}}], _feedback(strong=0, weak=2)
    )
    report = progress.build_report([session])
    assert report.focus_areas  # not empty
    assert any("strong" in f.lower() for f in report.focus_areas)  # answer-quality coaching
    assert any("filler" in f.lower() for f in report.focus_areas)  # delivery coaching
    assert not any("Acme" in f for f in report.focus_areas)  # never company-specific


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
    # focus is metric-driven: fillers were 6/min (VOICE), which is above the good range
    assert any("filler" in f.lower() for f in report["focus_areas"])


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
    summary = client.post("/api/progress/summary", cookies=cookies).json()["summary"]
    assert "stronger answers" in summary


def test_coach_summary_without_interviews_is_a_prompt_to_start(client):
    res = client.post("/api/auth/signup", json={"email": "noprog@example.com", "password": "password123"})
    client.cookies.clear()
    cookies = {"access_token": res.cookies["access_token"]}
    summary = client.post("/api/progress/summary", cookies=cookies).json()["summary"]
    assert "not done any interviews" in summary
