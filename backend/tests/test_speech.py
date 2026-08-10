from app.services import speech
from app.services.speech import Word, delivery_metrics


def auth_cookies(client, email="speech@example.com"):
    res = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    )
    client.cookies.clear()  # keep the jar empty so per-request cookies are unambiguous
    return {"access_token": res.cookies["access_token"]}


def audio_file(data=b"fake-audio-bytes"):
    return {"audio": ("answer.webm", data, "audio/webm")}


def words(pairs):
    """Build timed words from (text, start, end) tuples."""
    return [Word(text=t, start=s, end=e) for t, s, e in pairs]


def test_no_speech_is_zeroed():
    metrics = delivery_metrics([], duration=0.0)
    assert metrics.word_count == 0
    assert metrics.wpm == 0
    assert metrics.filler_count == 0
    assert metrics.summary() == "No speech was detected in this answer."


def test_speaking_pace():
    # 3 words spoken over 2 seconds -> 90 words per minute.
    spoken = words([("I", 0.0, 0.3), ("built", 0.4, 0.8), ("this", 0.9, 2.0)])
    metrics = delivery_metrics(spoken, duration=2.0)
    assert metrics.word_count == 3
    assert metrics.wpm == 90


def test_pauses_counted_with_long_flag():
    # gaps: 0.6s (pause), 2.0s (long pause), 0.1s (ignored)
    spoken = words(
        [
            ("one", 0.0, 0.5),
            ("two", 1.1, 1.5),  # gap 0.6
            ("three", 3.5, 3.9),  # gap 2.0
            ("four", 4.0, 4.4),  # gap 0.1
        ]
    )
    metrics = delivery_metrics(spoken, duration=4.4)
    assert metrics.pause_count == 2
    assert metrics.long_pause_count == 1
    assert round(metrics.total_pause_sec, 1) == 2.6


def test_filler_words_and_bigrams():
    spoken = words(
        [
            ("Um,", 0.0, 0.3),
            ("I", 0.4, 0.5),
            ("like", 0.6, 0.9),
            ("you", 1.0, 1.2),
            ("know", 1.3, 1.5),
            ("built", 1.6, 2.0),
            ("it", 2.1, 2.3),
        ]
    )
    metrics = delivery_metrics(spoken, duration=2.3)
    assert metrics.fillers["um"] == 1
    assert metrics.fillers["like"] == 1
    assert metrics.fillers["you know"] == 1
    assert metrics.filler_count == 3


def test_common_connector_so_is_not_a_filler():
    spoken = words([("So", 0.0, 0.3), ("we", 0.4, 0.6), ("shipped", 0.7, 1.0)])
    metrics = delivery_metrics(spoken, duration=1.0)
    assert metrics.filler_count == 0


def test_time_coded_events_for_the_annotated_replay():
    spoken = words(
        [
            ("So", 0.0, 0.3),
            ("um", 0.4, 0.6),  # a filler at 0.4s
            ("I", 2.2, 2.4),  # a 1.6s gap after "um" -> a long pause
            ("built", 2.5, 3.0),
        ]
    )
    metrics = delivery_metrics(spoken, duration=3.0)

    # the filler is placed at the moment it was said
    assert [(round(e.time, 1), e.text) for e in metrics.filler_events] == [(0.4, "um")]
    # the single long pause spans the gap, and its count still agrees
    assert metrics.pause_count == 1 and metrics.long_pause_count == 1
    assert len(metrics.pauses) == 1
    pause = metrics.pauses[0]
    assert pause.long is True
    assert round(pause.start, 1) == 0.6 and round(pause.end, 1) == 2.2


def test_transcribe_endpoint_returns_transcript_and_metrics(client, monkeypatch):
    spoken = words([("I", 0.0, 0.3), ("um", 0.4, 0.7), ("built", 0.8, 1.2)])
    monkeypatch.setattr(speech, "transcribe", lambda data: ("I um built", spoken, 1.2))

    res = client.post(
        "/api/speech/transcribe", cookies=auth_cookies(client), files=audio_file()
    )
    assert res.status_code == 200
    body = res.json()
    assert body["transcript"] == "I um built"
    assert body["metrics"]["word_count"] == 3
    assert body["metrics"]["filler_count"] == 1


def test_transcribe_requires_auth(client):
    assert client.post("/api/speech/transcribe", files=audio_file()).status_code == 401


def test_transcribe_rejects_empty_audio(client):
    res = client.post(
        "/api/speech/transcribe", cookies=auth_cookies(client), files=audio_file(b"")
    )
    assert res.status_code == 400


def test_summary_reads_naturally():
    spoken = words(
        [
            ("um", 0.0, 0.3),
            ("I", 1.0, 1.2),  # gap 0.7 -> pause
            ("led", 1.3, 1.6),
            ("the", 1.7, 1.9),
            ("team", 2.0, 2.4),
        ]
    )
    metrics = delivery_metrics(spoken, duration=2.4)
    summary = metrics.summary()
    assert summary.startswith("Spoke at about")
    assert "noticeable pause" in summary
    assert "filler word" in summary
    assert summary.endswith(".")
