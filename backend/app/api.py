from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from .config import Settings
from .db import check_db

router = APIRouter(prefix="/api")


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/health")
def health(settings: Settings = Depends(get_settings)):
    if not check_db(settings.database_path):
        return JSONResponse({"status": "error", "db": "unavailable"}, status_code=503)
    return {"status": "ok", "db": "ok"}
