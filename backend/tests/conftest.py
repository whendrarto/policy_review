import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def static_dir(tmp_path):
    root = tmp_path / "static"
    (root / "nda").mkdir(parents=True)
    (root / "fonts").mkdir()
    (root / "index.html").write_text("<p>login page</p>")
    (root / "nda" / "index.html").write_text("<p>nda page</p>")
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
