from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_health_reports_missing_database(client, settings):
    settings.database_path.unlink()
    response = client.get("/api/health")
    assert response.status_code == 503
    assert response.json()["status"] == "error"


def test_startup_creates_fresh_database(settings):
    settings.database_path.parent.mkdir(parents=True)
    settings.database_path.write_bytes(b"not a database")
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200


def test_serves_login_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "login page" in response.text


def test_serves_nda_page_with_and_without_trailing_slash(client):
    assert "nda page" in client.get("/nda/").text
    response = client.get("/nda")
    assert response.status_code == 200
    assert "nda page" in response.text


def test_serves_pdf_fonts(client):
    response = client.get("/fonts/Tinos-Regular.ttf")
    assert response.status_code == 200
    assert response.content == b"font"


def test_unknown_path_is_404(client):
    assert client.get("/no-such-page").status_code == 404


def test_api_only_without_static_dir(tmp_path):
    settings = Settings(database_path=tmp_path / "prelegal.db", static_dir=None)
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
