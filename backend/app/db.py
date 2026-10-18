import sqlite3
from contextlib import closing
from pathlib import Path

# password_hash stays nullable until real authentication replaces the fake login.
SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(path: Path) -> None:
    """Create the database from scratch, discarding any previous file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    for suffix in ("", "-wal", "-shm", "-journal"):
        Path(f"{path}{suffix}").unlink(missing_ok=True)
    with closing(connect(path)) as conn:
        conn.executescript(SCHEMA)


def check_db(path: Path) -> bool:
    """True when the database file exists and has the expected schema."""
    if not path.is_file():
        return False
    try:
        with closing(connect(path)) as conn:
            conn.execute("SELECT COUNT(*) FROM users").fetchone()
        return True
    except sqlite3.Error:
        return False
