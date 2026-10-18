import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_path: Path
    # The statically exported frontend (frontend/out). None serves the API only.
    static_dir: Path | None

    @classmethod
    def from_env(cls) -> "Settings":
        static_dir = os.getenv("STATIC_DIR")
        return cls(
            database_path=Path(os.getenv("DATABASE_PATH", "data/prelegal.db")),
            static_dir=Path(static_dir) if static_dir else None,
        )
