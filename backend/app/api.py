import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from .chat import ChatFailed, ChatModel, ChatRequest, ChatResponse, litellm_chat_model, run_chat
from .config import Settings
from .db import check_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_chat_model(settings: Settings = Depends(get_settings)) -> ChatModel:
    if not settings.openrouter_api_key:
        raise HTTPException(503, "AI chat is not configured on this server.")
    return litellm_chat_model(settings.openrouter_api_key)


@router.get("/health")
def health(settings: Settings = Depends(get_settings)):
    if not check_db(settings.database_path):
        return JSONResponse({"status": "error", "db": "unavailable"}, status_code=503)
    return {"status": "ok", "db": "ok"}


# A plain def: the LLM call blocks, so FastAPI runs it in its threadpool.
@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, model: ChatModel = Depends(get_chat_model)):
    try:
        return run_chat(request, model)
    except ChatFailed:
        logger.exception("AI chat failed")
        raise HTTPException(502, "The AI assistant had a problem. Please try again.")
