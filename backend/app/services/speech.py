"""Speech delivery analysis for spoken interview answers.

The answer audio is transcribed with faster-whisper (word timestamps), then a
pure function turns those words into delivery metrics: speaking pace, pauses and
filler words. The transcription step is the only part that loads the model; it is
kept thin and lazy so the rest of the app runs without the dependency and the
metric maths can be unit-tested without any audio.

Audio is processed in memory and never written to disk (LSEPI no-storage policy).
"""

import io
import string
from dataclasses import dataclass

from app.config import settings
from app.schemas.interview import DeliveryMetrics, FillerEvent, PauseEvent

# Hesitation sounds are almost always disfluencies; the discourse markers below
# are the crutch words interview coaching flags. "so" is deliberately excluded:
# it is too common as a legitimate connector to count reliably.
FILLERS = {"um", "uh", "er", "erm", "ah", "hmm", "mm", "like", "actually", "basically", "literally"}
FILLER_BIGRAMS = {("you", "know"), ("sort", "of"), ("kind", "of"), ("i", "mean")}


@dataclass
class Word:
    text: str
    start: float
    end: float


_model = None  # cached WhisperModel, loaded on first use


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(settings.whisper_model)
    return _model


def transcribe(audio: bytes) -> tuple[str, list[Word], float]:
    """Transcribe audio bytes to (transcript, words with timings, duration seconds)."""
    model = _get_model()
    segments, info = model.transcribe(io.BytesIO(audio), word_timestamps=True)
    words: list[Word] = []
    texts: list[str] = []
    for segment in segments:
        texts.append(segment.text)
        for word in segment.words or []:
            words.append(Word(text=word.word, start=word.start, end=word.end))
    return "".join(texts).strip(), words, float(info.duration)


def _normalise(text: str) -> str:
    return text.strip().lower().strip(string.punctuation)


def delivery_metrics(words: list[Word], duration: float) -> DeliveryMetrics:
    """Turn timed words into delivery metrics. Pure and deterministic.

    Also emits time-coded pause and filler events (seconds from the start of the
    recording) so the answer can be replayed with these moments highlighted.
    """
    # Normalised words paired with their start time, for the timed filler events.
    timed = [(norm, word.start) for word, norm in ((w, _normalise(w.text)) for w in words) if norm]
    clean = [norm for norm, _ in timed]
    word_count = len(clean)
    wpm = round(word_count / (duration / 60)) if duration > 0 else 0

    pause_count = 0
    long_pause_count = 0
    total_pause = 0.0
    pauses: list[PauseEvent] = []
    for prev, nxt in zip(words, words[1:]):
        gap = nxt.start - prev.end
        if gap >= settings.speech_pause_sec:
            pause_count += 1
            total_pause += gap
            long = gap >= settings.speech_long_pause_sec
            if long:
                long_pause_count += 1
            pauses.append(PauseEvent(start=round(prev.end, 2), end=round(nxt.start, 2), long=long))

    fillers: dict[str, int] = {}
    filler_events: list[FillerEvent] = []
    for token, start in timed:
        if token in FILLERS:
            fillers[token] = fillers.get(token, 0) + 1
            filler_events.append(FillerEvent(time=round(start, 2), text=token))
    for (first, start), (second, _) in zip(timed, timed[1:]):
        if (first, second) in FILLER_BIGRAMS:
            phrase = f"{first} {second}"
            fillers[phrase] = fillers.get(phrase, 0) + 1
            filler_events.append(FillerEvent(time=round(start, 2), text=phrase))
    filler_events.sort(key=lambda event: event.time)

    return DeliveryMetrics(
        duration_sec=round(duration, 1),
        word_count=word_count,
        wpm=wpm,
        pause_count=pause_count,
        long_pause_count=long_pause_count,
        total_pause_sec=round(total_pause, 1),
        filler_count=sum(fillers.values()),
        fillers=fillers,
        pauses=pauses,
        filler_events=filler_events,
    )
