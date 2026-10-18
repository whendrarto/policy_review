import sqlite3
from contextlib import closing

import pytest

from app.db import check_db, connect, init_db


def test_init_db_creates_users_table(tmp_path):
    path = tmp_path / "nested" / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn:
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
    assert columns == {"id", "email", "name", "password_hash", "created_at"}


def test_init_db_starts_from_scratch(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn, conn:
        conn.execute("INSERT INTO users (email, name) VALUES ('a@example.com', 'A')")
    init_db(path)
    with closing(connect(path)) as conn:
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_user_email_is_unique(tmp_path):
    path = tmp_path / "prelegal.db"
    init_db(path)
    with closing(connect(path)) as conn:
        conn.execute("INSERT INTO users (email, name) VALUES ('a@example.com', 'A')")
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute("INSERT INTO users (email, name) VALUES ('a@example.com', 'B')")


def test_check_db(tmp_path):
    path = tmp_path / "prelegal.db"
    assert not check_db(path)
    assert not path.exists(), "check_db must not create the file"
    init_db(path)
    assert check_db(path)
    with closing(connect(path)) as conn:
        conn.execute("DROP TABLE users")
    assert not check_db(path)
