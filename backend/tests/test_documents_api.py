from contextlib import closing

import pytest
from conftest import sign_up

from app.db import connect

MESSAGES = [
    {"role": "assistant", "content": "What would you like to draft?"},
    {"role": "user", "content": "A pilot agreement between Acme and Globex."},
    {"role": "assistant", "content": "How long is the pilot?"},
]


def snapshot(**overrides) -> dict:
    return {
        "documentType": "pilot-agreement",
        "form": {"pilotPeriod": "90 days", "party1": {"company": "Acme"}, "party2": {"name": "Gina Globex"}},
        "messages": MESSAGES,
        **overrides,
    }


def test_documents_need_signing_in(client):
    for method, path in [("get", "/api/documents"), ("post", "/api/documents"), ("get", "/api/documents/1"), ("put", "/api/documents/1"), ("delete", "/api/documents/1")]:
        assert getattr(client, method)(path, **({"json": snapshot()} if method in ("post", "put") else {})).status_code == 401


def test_save_reopen_update_and_delete(signed_in_client):
    client = signed_in_client
    assert client.get("/api/documents").json() == []

    created = client.post("/api/documents", json=snapshot())
    assert created.status_code == 201
    saved = created.json()
    assert saved["documentType"] == "pilot-agreement"
    assert saved["title"] == "Pilot Agreement - Acme / Gina Globex"
    assert saved["messages"] == MESSAGES
    # The form comes back complete, with the document's defaults filled in.
    assert saved["form"]["pilotPeriod"] == "90 days"
    assert saved["form"]["governingLaw"] == ""
    assert saved["form"]["party1"] == {"name": "", "title": "", "company": "Acme", "noticeAddress": ""}
    assert client.get(f"/api/documents/{saved['id']}").json() == saved

    # Switching documents replaces the saved draft, type included.
    messages = [*MESSAGES, {"role": "user", "content": "Make it an NDA."}, {"role": "assistant", "content": "Done."}]
    updated = client.put(f"/api/documents/{saved['id']}", json=snapshot(documentType="mutual-nda", form={"party1": {"company": "Acme"}}, messages=messages))
    assert updated.status_code == 200
    assert updated.json()["documentType"] == "mutual-nda"
    assert updated.json()["title"] == "Mutual Non-Disclosure Agreement - Acme"
    assert updated.json()["messages"] == messages
    assert updated.json()["createdAt"] == saved["createdAt"]
    assert updated.json()["updatedAt"] >= saved["updatedAt"]

    [summary] = client.get("/api/documents").json()
    assert summary == {key: updated.json()[key] for key in ("id", "documentType", "title", "createdAt", "updatedAt")}

    assert client.delete(f"/api/documents/{saved['id']}").status_code == 204
    assert client.get(f"/api/documents/{saved['id']}").status_code == 404
    assert client.delete(f"/api/documents/{saved['id']}").status_code == 404
    assert client.get("/api/documents").json() == []


def test_title_without_parties_is_the_document_name(signed_in_client):
    saved = signed_in_client.post("/api/documents", json=snapshot(form={})).json()
    assert saved["title"] == "Pilot Agreement"


def test_documents_are_listed_newest_first(signed_in_client, settings):
    client = signed_in_client
    first = client.post("/api/documents", json=snapshot()).json()["id"]
    second = client.post("/api/documents", json=snapshot(documentType="ai-addendum", form={})).json()["id"]
    with closing(connect(settings.database_path)) as conn, conn:
        conn.execute("UPDATE documents SET updated_at = '2000-01-01T00:00:00+00:00' WHERE id = ?", (second,))
    assert [doc["id"] for doc in client.get("/api/documents").json()] == [first, second]
    client.put(f"/api/documents/{second}", json=snapshot(documentType="ai-addendum", form={}))
    assert [doc["id"] for doc in client.get("/api/documents").json()] == [second, first]


def test_users_only_see_their_own_documents(signed_in_client, make_client):
    mine = signed_in_client.post("/api/documents", json=snapshot()).json()["id"]
    other = make_client()
    sign_up(other, email="bob@example.com", name="Bob")
    assert other.get("/api/documents").json() == []
    assert other.get(f"/api/documents/{mine}").status_code == 404
    assert other.put(f"/api/documents/{mine}", json=snapshot()).status_code == 404
    assert other.delete(f"/api/documents/{mine}").status_code == 404
    assert signed_in_client.get(f"/api/documents/{mine}").status_code == 200


@pytest.mark.parametrize(
    "overrides",
    [
        {"documentType": "employment-contract"},
        {"form": {"pilotPeriod": "x" * 2001}},
        {"documentType": "mutual-nda", "form": {"mndaTerm": "forever"}},
        {"messages": [{"role": "system", "content": "hi"}]},
        {"messages": [{"role": "user", "content": ""}]},
        {"messages": [{"role": "user", "content": "hi"}] * 501},
    ],
)
def test_saved_drafts_must_fit_their_document(signed_in_client, overrides):
    assert signed_in_client.post("/api/documents", json=snapshot(**overrides)).status_code == 422
    assert signed_in_client.get("/api/documents").json() == []
