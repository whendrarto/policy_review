from contextlib import closing
from dataclasses import replace

import pytest
from conftest import sign_up
from fastapi.testclient import TestClient

from app.config import SESSION_COOKIE
from app.db import connect
from app.main import create_app


def set_cookie(response) -> str:
    return response.headers["set-cookie"]


def test_sign_up_signs_the_user_in(client):
    response = sign_up(client, email=" Ann@Example.com ", name=" Ann Lee ")
    assert response.json() == {"id": 1, "name": "Ann Lee", "email": "ann@example.com"}
    cookie = set_cookie(response)
    assert f"{SESSION_COOKIE}=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Max-Age=604800" in cookie
    assert "Path=/" in cookie
    assert "Secure" not in cookie
    assert client.get("/api/auth/me").json() == {"id": 1, "name": "Ann Lee", "email": "ann@example.com"}


def test_the_cookie_can_be_https_only(settings):
    with TestClient(create_app(replace(settings, cookie_secure=True))) as client:
        assert "Secure" in set_cookie(sign_up(client))


def test_me_needs_a_session(client):
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set(SESSION_COOKIE, "made-up")
    assert client.get("/api/auth/me").status_code == 401


def test_an_email_has_one_account_whatever_its_case(client):
    sign_up(client)
    response = client.post("/api/auth/signup", json={"name": "Imposter", "email": "ANN@example.com", "password": "something else"})
    assert response.status_code == 409
    assert response.json() == {"detail": "An account with this email already exists."}


@pytest.mark.parametrize(
    "body",
    [
        {"name": "", "email": "ann@example.com", "password": "correct horse"},
        {"name": "   ", "email": "ann@example.com", "password": "correct horse"},
        {"name": "Ann", "email": "not-an-email", "password": "correct horse"},
        {"name": "Ann", "email": "ann@example.com", "password": "short"},
        {"name": "Ann", "email": "ann@example.com", "password": "x" * 129},
        {"name": "Ann", "email": "ann@example.com"},
    ],
)
def test_sign_up_checks_its_input(client, body):
    assert client.post("/api/auth/signup", json=body).status_code == 422


def test_sign_in_and_out(client, make_client):
    sign_up(client)
    browser = make_client()
    response = browser.post("/api/auth/signin", json={"email": "ANN@example.com", "password": "correct horse"})
    assert response.status_code == 200
    assert response.json()["email"] == "ann@example.com"
    assert browser.get("/api/auth/me").status_code == 200

    old_cookie = browser.cookies.get(SESSION_COOKIE)
    response = browser.post("/api/auth/signout")
    assert response.status_code == 204
    assert f'{SESSION_COOKIE}=""' in set_cookie(response)
    assert browser.get("/api/auth/me").status_code == 401
    # The session is gone on the server too, so the old cookie no longer works.
    browser.cookies.set(SESSION_COOKIE, old_cookie)
    assert browser.get("/api/auth/me").status_code == 401
    # The other browser is still signed in.
    assert client.get("/api/auth/me").status_code == 200


def test_signing_out_twice_is_harmless(client):
    assert client.post("/api/auth/signout").status_code == 204


@pytest.mark.parametrize("email, password", [("ann@example.com", "wrong password"), ("bob@example.com", "correct horse")])
def test_failed_sign_in_does_not_say_which_part_was_wrong(client, make_client, email, password):
    sign_up(client)
    response = make_client().post("/api/auth/signin", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}
    assert "set-cookie" not in response.headers


def test_the_database_keeps_only_hashes(client, settings):
    response = sign_up(client)
    token = client.cookies.get(SESSION_COOKIE)
    with closing(connect(settings.database_path)) as conn:
        user = conn.execute("SELECT * FROM users").fetchone()
        session = conn.execute("SELECT * FROM sessions").fetchone()
    assert user["password_hash"].startswith("scrypt$")
    assert "correct horse" not in user["password_hash"]
    assert session["token_hash"] != token
    assert "password" not in response.text


def test_expired_sessions_are_refused(client, settings):
    sign_up(client)
    with closing(connect(settings.database_path)) as conn, conn:
        conn.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00+00:00'")
    assert client.get("/api/auth/me").status_code == 401


def test_restarting_the_server_signs_everyone_out(settings):
    with TestClient(create_app(settings)) as client:
        sign_up(client)
        cookie = client.cookies.get(SESSION_COOKIE)
    with TestClient(create_app(settings)) as client:
        client.cookies.set(SESSION_COOKIE, cookie)
        assert client.get("/api/auth/me").status_code == 401
