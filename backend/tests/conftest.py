import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

PAGES = ("documents", "editor", "signin", "signup")


@pytest.fixture
def static_dir(tmp_path):
    root = tmp_path / "static"
    (root / "fonts").mkdir(parents=True)
    (root / "index.html").write_text("<p>landing page</p>")
    for page in PAGES:
        (root / page).mkdir()
        (root / page / "index.html").write_text(f"<p>{page} page</p>")
    (root / "fonts" / "Tinos-Regular.ttf").write_bytes(b"font")
    return root


@pytest.fixture
def settings(tmp_path, static_dir):
    return Settings(database_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def client(settings):
    # The context manager runs the lifespan, which creates the database.
    with TestClient(create_app(settings)) as client:
        yield client


def sign_up(client, email="ann@example.com", name="Ann Lee", password="correct horse"):
    response = client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})
    assert response.status_code == 201, response.text
    return response


@pytest.fixture
def signed_in_client(client):
    """The client after signing up; its cookie jar holds the session."""
    sign_up(client)
    return client


@pytest.fixture
def make_client(client):
    """Another browser on the same app (and database), with its own cookies."""
    clients = []

    def make():
        other = TestClient(client.app)
        clients.append(other)
        return other

    yield make
    for other in clients:
        other.close()
