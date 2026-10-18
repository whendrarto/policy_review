from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_settings_from_env(monkeypatch):
    monkeypatch.setattr("app.config.load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("OPENROUTER_API_KEY", "abc")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, http://127.0.0.1:3000")
    settings = Settings.from_env()
    assert settings.openrouter_api_key == "abc"
    assert settings.cors_origins == ("http://localhost:3000", "http://127.0.0.1:3000")


def test_settings_from_env_defaults(monkeypatch):
    monkeypatch.setattr("app.config.load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    settings = Settings.from_env()
    assert settings.openrouter_api_key is None
    assert settings.cors_origins == ()


def test_cors_allows_only_configured_origins(tmp_path):
    settings = Settings(database_path=tmp_path / "prelegal.db", static_dir=None, cors_origins=("http://localhost:3000",))
    preflight = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}
    with TestClient(create_app(settings)) as client:
        allowed = client.options("/api/chat", headers={"Origin": "http://localhost:3000", **preflight})
        other = client.options("/api/chat", headers={"Origin": "http://evil.example", **preflight})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-origin" not in other.headers


def test_no_cors_by_default(client):
    response = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert "access-control-allow-origin" not in response.headers
