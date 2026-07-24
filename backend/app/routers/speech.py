from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile

from app.config import settings
from app.models.user import User
from app.schemas.interview import TranscribeResponse
from app.schemas.speech import SayRequest, VoicesResponse
from app.security import get_current_user
from app.services import speech, tts

router = APIRouter(prefix="/speech", tags=["speech"])


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> TranscribeResponse:
    """Transcribe a spoken answer and measure its delivery. Audio stays in memory."""
    if not settings.speech_enabled:
        raise HTTPException(status_code=503, detail="Speech analysis is disabled")
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="No audio was uploaded")
    try:
        transcript, words, duration = speech.transcribe(data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not transcribe audio: {exc}") from exc
    metrics = speech.delivery_metrics(words, duration)
    return TranscribeResponse(transcript=transcript, metrics=metrics)


@router.get("/voices", response_model=VoicesResponse)
def list_voices(current_user: User = Depends(get_current_user)) -> VoicesResponse:
    """The interviewer voices this server can synthesise locally."""
    return VoicesResponse(available=tts.available(), voices=tts.voices())


@router.post("/say")
def say(
    data: SayRequest,
    current_user: User = Depends(get_current_user),
) -> Response:
    """Speak `text` in the interviewer's voice. Returns WAV audio."""
    if not tts.available():
        raise HTTPException(status_code=503, detail="Voice synthesis is not installed")
    if not data.text.strip():
        raise HTTPException(status_code=400, detail="No text to speak")
    try:
        audio = tts.synthesize(data.text, data.voice)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not synthesise speech: {exc}") from exc
    return Response(content=audio, media_type="audio/wav")
