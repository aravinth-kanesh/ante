"""Neural text to speech for the interviewer's voice, run locally with Kokoro.

Kokoro is a small open-weight model (Apache 2.0) that runs on CPU, so questions
are synthesised on this machine: no API key, no cost, and the question text (which
is derived from the candidate's CV) never leaves the server. The model files are
downloaded by `scripts/fetch_tts_model.py`; if they are missing the app falls back
to the browser's own voices.
"""

import io
import wave
from pathlib import Path

from app.config import settings

# Kokoro voice ids encode accent and gender: the first letter is the accent
# (a = American, b = British) and the second is the gender.
ACCENTS = {"a": "American", "b": "British"}
GENDERS = {"f": "female", "m": "male"}

_model = None


def _paths() -> tuple[Path, Path]:
    return Path(settings.tts_model_path), Path(settings.tts_voices_path)


def available() -> bool:
    """True when TTS is enabled and the model files are present."""
    if not settings.tts_enabled:
        return False
    model, voices = _paths()
    return model.is_file() and voices.is_file()


def _get_model():
    global _model
    if _model is None:
        from kokoro_onnx import Kokoro

        model, voices = _paths()
        _model = Kokoro(str(model), str(voices))
    return _model


def describe(voice_id: str) -> str:
    """'bf_emma' -> 'Emma (British, female)'."""
    accent = ACCENTS.get(voice_id[:1], "")
    gender = GENDERS.get(voice_id[1:2], "")
    name = voice_id.split("_", 1)[-1].replace("_", " ").title()
    if accent and gender:
        return f"{name} ({accent}, {gender})"
    return name


def voices() -> list[dict]:
    """The English voices on offer, British first (this is a UK-focused tool)."""
    if not available():
        return []
    default = settings.tts_voice
    english = [v for v in _get_model().get_voices() if v[:1] in ACCENTS]
    # default voice first, then British, then alphabetical
    english.sort(key=lambda v: (v != default, v[:1] != "b", v))
    return [{"id": v, "label": describe(v)} for v in english]


def _wav_bytes(samples, sample_rate: int) -> bytes:
    import numpy as np

    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(sample_rate)
        out.writeframes(pcm.tobytes())
    return buffer.getvalue()


def synthesize(text: str, voice: str = "") -> bytes:
    """Synthesise `text` and return WAV audio."""
    voice = voice or settings.tts_voice
    samples, sample_rate = _get_model().create(
        text[: settings.tts_max_chars],
        voice=voice,
        speed=settings.tts_speed,
        lang="en-gb" if voice.startswith("b") else "en-us",
    )
    return _wav_bytes(samples, sample_rate)
