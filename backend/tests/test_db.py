import sqlite3
from contextlib import closing

import pytest

from app.db import check_db, connect, init_db

ADD_USER = "INSERT INTO users (email, name, password_hash) VALUES (?, 'A', 'hash')"


def test_init_db_creates_the_tables(tmp_path):
    path = tmp_path / "nested" / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn:
        columns = {table: {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")} for table in ("users", "sessions", "documents")}
    assert columns == {
        "users": {"id", "email", "name", "password_hash", "created_at"},
        "sessions": {"token_hash", "user_id", "created_at", "expires_at"},
        "documents": {"id", "user_id", "document_type", "title", "form_json", "messages_json", "created_at", "updated_at"},
    }


def test_init_db_starts_from_scratch(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn, conn:
        conn.execute(ADD_USER, ("a@example.com",))
    init_db(path)
    with closing(connect(path)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_user_email_is_unique_and_needs_a_password(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn:
        conn.execute(ADD_USER, ("a@example.com",))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(ADD_USER, ("a@example.com",))
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO users (email, name) VALUES ('b@example.com', 'B')")


def test_deleting_a_user_deletes_their_sessions_and_documents(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn, conn:
        user = conn.execute(ADD_USER, ("a@example.com",)).lastrowid
        conn.execute("INSERT INTO sessions VALUES ('t', ?, 'now', 'later')", (user,))
        conn.execute("INSERT INTO documents (user_id, document_type, title, form_json, messages_json, created_at, updated_at) VALUES (?, 'x', 'x', '{}', '[]', 'now', 'now')", (user,))
        conn.execute("DELETE FROM users")
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0] == 0


def test_check_db(tmp_path):
    path = tmp_path / "prelegal.db"
    assert not check_db(path)
    assert not path.exists(), "check_db must not create the file"
    init_db(path)
    assert check_db(path)
    with closing(connect(path)) as conn:
        conn.execute("DROP TABLE documents")
    assert not check_db(path)
