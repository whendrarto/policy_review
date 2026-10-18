import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from .chat import ChatFailed, ChatModel, ChatRequest, ChatResponse, InvalidRequest, litellm_chat_model, run_chat
from .config import Settings
from .db import check_db
from .deps import current_user, get_registry, get_settings
from .documents import Registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def get_chat_model(settings: Settings = Depends(get_settings)) -> ChatModel:
    if not settings.openrouter_api_key:
        raise HTTPException(503, "AI chat is not configured on this server.")
    return litellm_chat_model(settings.openrouter_api_key)


@router.get("/health")
def health(settings: Settings = Depends(get_settings)):
    if not check_db(settings.database_path):
        return JSONResponse({"status": "error", "db": "unavailable"}, status_code=503)
    return {"status": "ok", "db": "ok"}


# A plain def: the LLM call blocks, so FastAPI runs it in its threadpool. Only signed-in users may
# chat; that check runs first, so a signed-out request is a 401 even when the AI isn't configured.
@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(current_user)])
def chat(request: ChatRequest, model: ChatModel = Depends(get_chat_model), registry: Registry = Depends(get_registry)):
    try:
        return run_chat(request, model, registry)
    except InvalidRequest as exc:
        raise HTTPException(422, str(exc))
    except ChatFailed:
        logger.exception("AI chat failed")
        raise HTTPException(502, "The AI assistant had a problem. Please try again.")
