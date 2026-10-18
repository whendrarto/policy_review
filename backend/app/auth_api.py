"""Sign up, sign in and sign out. A session is a random token in an HttpOnly cookie, kept (hashed)
in the sessions table; the database is recreated on every start, which signs everyone out."""

import sqlite3
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator

from .config import SESSION_COOKIE, SESSION_DAYS, Settings
from .db import now
from .deps import User, current_user, get_db, get_settings
from .security import DUMMY_HASH, hash_password, hash_token, new_token, verify_password

router = APIRouter(prefix="/api/auth")

EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
MIN_PASSWORD = 8
MAX_PASSWORD = 128


def _normalize_email(email: str) -> str:
    return email.strip().lower()


class SignUpRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=MIN_PASSWORD, max_length=MAX_PASSWORD)

    @field_validator("name", "email", mode="before")
    @classmethod
    def strip(cls, value):
        return value.strip() if isinstance(value, str) else value


class SignInRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD)


class UserOut(BaseModel):
    id: int
    name: str
    email: str


def _start_session(conn: sqlite3.Connection, user_id: int, response: Response, settings: Settings) -> None:
    token = new_token()
    created = datetime.now(UTC)
    with conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?", (user_id, created.isoformat()))
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (hash_token(token), user_id, created.isoformat(), (created + timedelta(days=SESSION_DAYS)).isoformat()),
        )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


@router.post("/signup", status_code=201)
def sign_up(
    body: SignUpRequest,
    response: Response,
    conn: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UserOut:
    email = _normalize_email(body.email)
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (email, body.name, hash_password(body.password), now()),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists.")
    _start_session(conn, cursor.lastrowid, response, settings)
    return UserOut(id=cursor.lastrowid, name=body.name, email=email)


@router.post("/signin")
def sign_in(
    body: SignInRequest,
    response: Response,
    conn: sqlite3.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UserOut:
    row = conn.execute("SELECT id, name, email, password_hash FROM users WHERE email = ?", (_normalize_email(body.email),)).fetchone()
    # The password is checked even for an unknown email (against a dummy hash), so both failures
    # take as long and look the same.
    password_ok = verify_password(body.password, row["password_hash"] if row else DUMMY_HASH)
    if not row or not password_ok:
        raise HTTPException(401, "Incorrect email or password.")
    _start_session(conn, row["id"], response, settings)
    return UserOut(id=row["id"], name=row["name"], email=row["email"])


@router.post("/signout", status_code=204)
def sign_out(request: Request, response: Response, conn: sqlite3.Connection = Depends(get_db)) -> None:
    if token := request.cookies.get(SESSION_COOKIE):
        with conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me")
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut(id=user.id, name=user.name, email=user.email)
