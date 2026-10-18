"""Dependencies the API routes share: settings, the document registry, the database and the user."""

import sqlite3
from collections.abc import Iterator
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request

from .config import SESSION_COOKIE, Settings
from .db import connect, now
from .documents import Registry
from .security import hash_token


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_registry(request: Request) -> Registry:
    return request.app.state.registry


def get_db(settings: Settings = Depends(get_settings)) -> Iterator[sqlite3.Connection]:
    """A connection for one request; handlers commit with `with conn:`."""
    conn = connect(settings.database_path)
    try:
        yield conn
    finally:
        conn.close()


@dataclass(frozen=True)
class User:
    id: int
    name: str
    email: str


def current_user(request: Request, conn: sqlite3.Connection = Depends(get_db)) -> User:
    """The signed-in user, from the session cookie; 401 otherwise."""
    token = request.cookies.get(SESSION_COOKIE)
    row = token and conn.execute(
        """SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id
           WHERE sessions.token_hash = ? AND sessions.expires_at > ?""",
        (hash_token(token), now()),
    ).fetchone()
    if not row:
        raise HTTPException(401, "Not signed in.")
    return User(row["id"], row["name"], row["email"])
