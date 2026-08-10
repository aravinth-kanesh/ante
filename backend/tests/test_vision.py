from app.config import settings
from app.schemas.interview import NonverbalSample
from app.services.vision import nonverbal_metrics


def auth_cookies(client, email="vision@example.com"):
    res = client.post(
        "/api/auth/signup", json={"email": email, "password": "password123"}
    )
    client.cookies.clear()  # keep the jar empty so per-request cookies are unambiguous
    return {"access_token": res.cookies["access_token"]}


def facing(**kw):
    base = dict(face_detected=True, yaw=0.0, pitch=0.0, eyes_open=True, smile=0.0)
    base.update(kw)
    return NonverbalSample(**base)


def test_no_face_detected():
    metrics = nonverbal_metrics([NonverbalSample(face_detected=False) for _ in range(5)])
    assert metrics.face_detected is False
    assert metrics.eye_contact_pct == 0
    assert metrics.steadiness_label == "unknown"
    assert metrics.summary() == "No face was clearly detected on camera."


def test_eye_contact_proportion():
    samples = [facing()] * 3 + [facing(yaw=40.0)]  # 3 of 4 face the camera
    assert nonverbal_metrics(samples).eye_contact_pct == 75


def test_eyes_closed_is_not_eye_contact():
    samples = [facing(eyes_open=False)] * 4
    assert nonverbal_metrics(samples).eye_contact_pct == 0


def test_steady_head_scores_high():
    metrics = nonverbal_metrics([facing()] * 6)
    assert metrics.head_steadiness == 100
    assert metrics.steadiness_label == "steady"


def test_restless_head_scores_low():
    samples = [facing(yaw=-30.0), facing(yaw=30.0), facing(yaw=-30.0), facing(yaw=30.0)]
    metrics = nonverbal_metrics(samples)
    assert metrics.head_steadiness < 50
    assert metrics.steadiness_label == "restless"


def test_timeline_summarises_eye_contact_per_second():
    samples = (
        [facing(t=0.0), facing(t=0.5)]  # second 0: facing the camera
        + [facing(yaw=40.0, t=1.0), facing(yaw=45.0, t=1.5)]  # second 1: looked away
        + [facing(t=2.0)]  # second 2: facing again
    )
    ticks = nonverbal_metrics(samples).timeline
    assert [tick.t for tick in ticks] == [0.0, 1.0, 2.0]
    assert [tick.eye_contact for tick in ticks] == [True, False, True]


def test_timeline_empty_without_per_frame_timing():
    # Older clients send no timestamps (t defaults to 0), so no overlay is built.
    assert nonverbal_metrics([facing()] * 4).timeline == []


def test_smile_percentage_when_expression_enabled(monkeypatch):
    monkeypatch.setattr(settings, "expression_enabled", True)
    samples = [facing(smile=0.6)] * 3 + [facing(smile=0.0)]  # 3 of 4 smiling
    assert nonverbal_metrics(samples).smile_pct == 75


def test_smile_omitted_when_expression_disabled(monkeypatch):
    monkeypatch.setattr(settings, "expression_enabled", False)
    assert nonverbal_metrics([facing(smile=0.9)] * 4).smile_pct is None


def test_posture_from_shoulder_tilt():
    samples = [
        facing(pose_detected=True, shoulder_tilt=2.0),
        facing(pose_detected=True, shoulder_tilt=1.0),
        facing(pose_detected=True, shoulder_tilt=20.0),
    ]
    assert nonverbal_metrics(samples).posture_pct == 67  # 2 of 3 level


def test_posture_none_without_pose():
    assert nonverbal_metrics([facing()] * 3).posture_pct is None


def test_summary_reads_naturally():
    samples = [facing(smile=0.5, pose_detected=True, shoulder_tilt=1.0)] * 4
    summary = nonverbal_metrics(samples).summary()
    assert summary.startswith("The candidate appeared to look at the camera")
    assert "head position" in summary
    assert summary.endswith(".")


def test_analyse_endpoint_returns_metrics(client):
    samples = [
        {"face_detected": True, "yaw": 0, "pitch": 0, "eyes_open": True, "smile": 0.5},
        {"face_detected": True, "yaw": 2, "pitch": 1, "eyes_open": True, "smile": 0.4},
    ]
    res = client.post(
        "/api/vision/analyse", cookies=auth_cookies(client), json={"samples": samples}
    )
    assert res.status_code == 200
    assert res.json()["eye_contact_pct"] == 100


def test_analyse_requires_auth(client):
    assert client.post("/api/vision/analyse", json={"samples": []}).status_code == 401


def test_analyse_guard_when_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "nonverbal_enabled", False)
    res = client.post("/api/vision/analyse", cookies=auth_cookies(client), json={"samples": []})
    assert res.status_code == 503


def test_analyse_caps_sample_count(client, monkeypatch):
    monkeypatch.setattr(settings, "nonverbal_max_samples", 2)
    samples = [{"face_detected": True, "yaw": 0, "pitch": 0, "eyes_open": True}] * 5
    res = client.post(
        "/api/vision/analyse", cookies=auth_cookies(client), json={"samples": samples}
    )
    assert res.status_code == 200
    assert res.json()["frames_analysed"] == 2
