from fastapi import APIRouter, Depends, HTTPException, Request

from app.config import settings
from app.models.user import User
from app.ratelimit import limiter
from app.schemas.chat import ChatRequest, ChatResponse
from app.security import get_current_user
from app.services import coach

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
@limiter.limit(settings.llm_rate_limit)
def chat(request: Request, data: ChatRequest, current_user: User = Depends(get_current_user)) -> ChatResponse:
    messages = [m.model_dump() for m in data.messages]
    try:
        result = coach.respond(messages)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc
    return ChatResponse(reply=result.reply, blocked=result.blocked)
