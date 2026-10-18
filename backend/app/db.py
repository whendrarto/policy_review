import sqlite3
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

# Times are ISO 8601 strings in UTC written by now(), so they also compare correctly as text.
SCHEMA = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- token_hash is the SHA-256 of the cookie's token, so the database never holds a usable token.
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- form_json is the document's form as the chat API takes it; messages_json the conversation.
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    form_json TEXT NOT NULL,
    messages_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_documents_user ON documents(user_id, updated_at DESC);
"""


def now() -> str:
    return datetime.now(UTC).isoformat()


def connect(path: Path) -> sqlite3.Connection:
    # FastAPI may run a request's dependency and its endpoint on different threadpool threads;
    # each connection still serves one request at a time.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
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
            for table in ("users", "sessions", "documents"):
                conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
        return True
    except sqlite3.Error:
        return False
