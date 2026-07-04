from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "model": settings.llm_model}
