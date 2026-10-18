import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# The project root .env, for local runs. In Docker, compose supplies the environment instead.
ROOT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


@dataclass(frozen=True)
class Settings:
    database_path: Path
    # The statically exported frontend (frontend/out). None serves the API only.
    static_dir: Path | None
    # None disables the AI chat endpoint (it answers 503).
    openrouter_api_key: str | None = None
    # Origins allowed to call the API cross-origin, e.g. `next dev` on http://localhost:3000.
    cors_origins: tuple[str, ...] = ()

    @classmethod
    def from_env(cls) -> "Settings":
        # Variables already in the environment win over the file.
        load_dotenv(ROOT_ENV_FILE)
        static_dir = os.getenv("STATIC_DIR")
        cors_origins = os.getenv("CORS_ORIGINS", "")
        return cls(
            database_path=Path(os.getenv("DATABASE_PATH", "data/prelegal.db")),
            static_dir=Path(static_dir) if static_dir else None,
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY") or None,
            cors_origins=tuple(origin.strip() for origin in cors_origins.split(",") if origin.strip()),
        )
