import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# The project root .env, for local runs. In Docker, compose supplies the environment instead.
ROOT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
# The repo's templates/ when run locally; the Docker image copies it to the same place.
DEFAULT_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"

SESSION_COOKIE = "prelegal_session"
SESSION_DAYS = 7


@dataclass(frozen=True)
class Settings:
    database_path: Path
    # The statically exported frontend (frontend/out). None serves the API only.
    static_dir: Path | None
    # None disables the AI chat endpoint (it answers 503).
    openrouter_api_key: str | None = None
    # Origins allowed to call the API cross-origin, e.g. `next dev` on http://localhost:3000.
    cors_origins: tuple[str, ...] = ()
    # catalog.json, documents.json and the legal text.
    templates_dir: Path = DEFAULT_TEMPLATES_DIR
    # Send the session cookie over HTTPS only. Off by default, because the Docker app is plain HTTP.
    cookie_secure: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        # Variables already in the environment win over the file.
        load_dotenv(ROOT_ENV_FILE)
        static_dir = os.getenv("STATIC_DIR")
        cors_origins = os.getenv("CORS_ORIGINS", "")
        templates_dir = os.getenv("TEMPLATES_DIR")
        return cls(
            database_path=Path(os.getenv("DATABASE_PATH", "data/prelegal.db")),
            static_dir=Path(static_dir) if static_dir else None,
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY") or None,
            cors_origins=tuple(origin.strip() for origin in cors_origins.split(",") if origin.strip()),
            templates_dir=Path(templates_dir) if templates_dir else DEFAULT_TEMPLATES_DIR,
            cookie_secure=os.getenv("COOKIE_SECURE", "").strip().lower() in ("1", "true", "yes"),
        )
