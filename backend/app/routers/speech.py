from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.models.user import User
from app.schemas.interview import TranscribeResponse
from app.security import get_current_user
from app.services import speech

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
