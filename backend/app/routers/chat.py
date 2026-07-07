from fastapi import APIRouter, Depends, HTTPException

from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse
from app.security import get_current_user
from app.services import llm

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, current_user: User = Depends(get_current_user)) -> ChatResponse:
    messages = [m.model_dump() for m in request.messages]
    try:
        reply = llm.chat(messages)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {exc}") from exc
    return ChatResponse(reply=reply)
