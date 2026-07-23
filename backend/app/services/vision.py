"""Nonverbal analysis of a spoken answer from webcam signals.

The browser samples the webcam with MediaPipe and sends a compact array of
per-frame signals (head angles, eyes-open flag, smile score, shoulder tilt). No
image or video ever leaves the browser. This module aggregates those samples into
nonverbal metrics: eye contact, head steadiness, facial expression and posture.

`nonverbal_metrics` is pure and deterministic, so it is unit-tested without any
camera or model. Eye contact here is a head-orientation proxy (whether the
candidate appears to face the camera), not true gaze tracking.
"""

import statistics

from app.config import settings
from app.schemas.interview import NonverbalMetrics, NonverbalSample

_LEVEL_SHOULDER_DEG = 6.0  # shoulders within this of level count as level posture


def _steadiness_label(score: int) -> str:
    if score >= 75:
        return "steady"
    if score >= 50:
        return "mostly steady"
    return "restless"


def nonverbal_metrics(samples: list[NonverbalSample]) -> NonverbalMetrics:
    """Aggregate per-frame webcam samples into nonverbal metrics. Pure."""
    face = [s for s in samples if s.face_detected]
    if not face:
        return NonverbalMetrics(
            frames_analysed=len(samples),
            face_detected=False,
            eye_contact_pct=0,
            head_steadiness=0,
            steadiness_label="unknown",
        )

    looking = sum(
        1
        for s in face
        if s.eyes_open
        and abs(s.yaw) <= settings.eye_contact_yaw_deg
        and abs(s.pitch) <= settings.eye_contact_pitch_deg
    )
    eye_contact_pct = round(100 * looking / len(face))

    spread = (statistics.pstdev([s.yaw for s in face]) + statistics.pstdev([s.pitch for s in face])) / 2
    head_steadiness = round(max(0.0, 100.0 - 4.0 * spread))

    smile_pct: int | None = None
    if settings.expression_enabled:
        smiling = sum(1 for s in face if s.smile >= settings.smile_threshold)
        smile_pct = round(100 * smiling / len(face))

    posture_pct: int | None = None
    pose = [s for s in samples if s.pose_detected and s.shoulder_tilt is not None]
    if pose:
        level = sum(1 for s in pose if abs(s.shoulder_tilt) <= _LEVEL_SHOULDER_DEG)
        posture_pct = round(100 * level / len(pose))

    return NonverbalMetrics(
        frames_analysed=len(samples),
        face_detected=True,
        eye_contact_pct=eye_contact_pct,
        head_steadiness=head_steadiness,
        steadiness_label=_steadiness_label(head_steadiness),
        smile_pct=smile_pct,
        posture_pct=posture_pct,
    )
