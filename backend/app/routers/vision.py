from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import settings
from app.models.user import User
from app.ratelimit import limiter
from app.schemas.interview import AnalyseRequest, NonverbalMetrics
from app.security import get_current_user
from app.services import vision

router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/analyse", response_model=NonverbalMetrics)
@limiter.limit(settings.vision_rate_limit)
def analyse(
    request: Request,
    data: AnalyseRequest,
    current_user: User = Depends(get_current_user),
) -> NonverbalMetrics:
    """Aggregate webcam samples into nonverbal metrics. No image data is received."""
    if not settings.nonverbal_enabled:
        raise HTTPException(status_code=503, detail="Nonverbal analysis is disabled")
    samples = data.samples[: settings.nonverbal_max_samples]
    return vision.nonverbal_metrics(samples)
