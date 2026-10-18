"""The user's saved documents. The frontend saves the whole draft after each chat reply: the
document type, its form (as the chat API takes it) and the conversation, so it can be reopened
and continued. Every query is limited to the signed-in user; anyone else's document is a 404."""

import json
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError

from .chat import ChatMessage
from .db import now
from .deps import User, current_user, get_db, get_registry
from .documents import DocumentDef, Registry

router = APIRouter(prefix="/api/documents")

# Enough for long conversations; the chat itself only sends the latest 40 messages.
MAX_SAVED_MESSAGES = 500


class DocumentSnapshot(BaseModel):
    documentType: str
    form: dict
    messages: list[ChatMessage] = Field(max_length=MAX_SAVED_MESSAGES)


class DocumentSummary(BaseModel):
    id: int
    documentType: str
    title: str
    createdAt: str
    updatedAt: str


class SavedDocument(DocumentSummary):
    form: dict
    messages: list[ChatMessage]


def _title(doc: DocumentDef, form: dict) -> str:
    """The document's name and its parties' companies (or signers), e.g. "Pilot Agreement - Acme / Globex"."""
    parties = [form[key]["company"] or form[key]["name"] for key in ("party1", "party2")]
    names = " / ".join(name for name in parties if name)
    return f"{doc.name} - {names}" if names else doc.name


def _checked(snapshot: DocumentSnapshot, registry: Registry) -> tuple[DocumentDef, dict]:
    """The snapshot's document and its form with the document's defaults filled in; 422 if it doesn't fit."""
    doc = registry.get(snapshot.documentType)
    if not doc:
        raise HTTPException(422, f"unknown documentType: {snapshot.documentType}")
    try:
        return doc, registry.form_model(doc).model_validate(snapshot.form).model_dump()
    except ValidationError as exc:
        raise HTTPException(422, str(exc)) from exc


def _messages_json(snapshot: DocumentSnapshot) -> str:
    return json.dumps([message.model_dump() for message in snapshot.messages])


def _summary(row: sqlite3.Row) -> DocumentSummary:
    return DocumentSummary(
        id=row["id"], documentType=row["document_type"], title=row["title"], createdAt=row["created_at"], updatedAt=row["updated_at"]
    )


def _saved(row: sqlite3.Row) -> SavedDocument:
    return SavedDocument(
        **_summary(row).model_dump(), form=json.loads(row["form_json"]), messages=json.loads(row["messages_json"])
    )


def _get_row(conn: sqlite3.Connection, user: User, document_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)).fetchone()
    if not row:
        raise HTTPException(404, "Document not found.")
    return row


@router.get("")
def list_documents(user: User = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)) -> list[DocumentSummary]:
    rows = conn.execute(
        "SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC, id DESC", (user.id,)
    ).fetchall()
    return [_summary(row) for row in rows]


@router.post("", status_code=201)
def create_document(
    snapshot: DocumentSnapshot,
    user: User = Depends(current_user),
    conn: sqlite3.Connection = Depends(get_db),
    registry: Registry = Depends(get_registry),
) -> SavedDocument:
    doc, form = _checked(snapshot, registry)
    timestamp = now()
    with conn:
        cursor = conn.execute(
            """INSERT INTO documents (user_id, document_type, title, form_json, messages_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user.id, doc.id, _title(doc, form), json.dumps(form), _messages_json(snapshot), timestamp, timestamp),
        )
    return _saved(_get_row(conn, user, cursor.lastrowid))


@router.get("/{document_id}")
def get_document(document_id: int, user: User = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)) -> SavedDocument:
    return _saved(_get_row(conn, user, document_id))


@router.put("/{document_id}")
def update_document(
    document_id: int,
    snapshot: DocumentSnapshot,
    user: User = Depends(current_user),
    conn: sqlite3.Connection = Depends(get_db),
    registry: Registry = Depends(get_registry),
) -> SavedDocument:
    # The whole draft replaces the saved one, including its type when the user switched documents.
    doc, form = _checked(snapshot, registry)
    with conn:
        cursor = conn.execute(
            """UPDATE documents SET document_type = ?, title = ?, form_json = ?, messages_json = ?, updated_at = ?
               WHERE id = ? AND user_id = ?""",
            (doc.id, _title(doc, form), json.dumps(form), _messages_json(snapshot), now(), document_id, user.id),
        )
    if not cursor.rowcount:
        raise HTTPException(404, "Document not found.")
    return _saved(_get_row(conn, user, document_id))


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, user: User = Depends(current_user), conn: sqlite3.Connection = Depends(get_db)) -> None:
    with conn:
        cursor = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id))
    if not cursor.rowcount:
        raise HTTPException(404, "Document not found.")
