from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import api, auth_api, documents_api
from .config import Settings
from .db import init_db
from .documents import load_registry


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(settings.database_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings
    # Read up front, so a broken templates/ stops the app from starting.
    app.state.registry = load_registry(settings.templates_dir)
    # Only needed when the frontend is served from another origin (next dev); Docker is same-origin.
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["Content-Type"],
            # The session is a cookie, which cross-origin requests only send with credentials.
            allow_credentials=True,
        )
    app.include_router(api.router)
    app.include_router(auth_api.router)
    app.include_router(documents_api.router)
    # Mounted last so it never shadows the API. html=True serves dir/index.html, which
    # matches the frontend's static export (trailingSlash: true).
    if settings.static_dir and settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="static")
    return app
