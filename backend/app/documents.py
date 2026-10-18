"""The documents the AI chat can draft, read from templates/documents.json and catalog.json.

documents.json describes each document's fields; from it the registry builds, per document, the
model that checks the form the frontend sends and the Structured Outputs model the LLM answers in.
"""

import json
from pathlib import Path
from typing import Literal, NamedTuple

from pydantic import BaseModel, ConfigDict, Field, create_model, model_validator

MIN_YEARS = 1
MAX_YEARS = 99
MAX_TEXT_LENGTH = 2000

FieldKind = Literal["text", "date", "years", "choice"]


class FieldDef(BaseModel):
    key: str = Field(pattern=r"^[a-z][A-Za-z0-9]*$")
    label: str
    kind: FieldKind
    description: str
    placeholder: str | None = None
    group: str | None = None
    # A blank optional field reads "None." on the cover page rather than counting as missing.
    optional: bool = False
    default: str | int | None = None
    # Kept when the user switches to another document with a field of the same key.
    carry: bool = False
    options: list[str] = []

    @model_validator(mode="after")
    def check_kind(self) -> "FieldDef":
        if self.kind == "choice":
            if not self.options:
                raise ValueError(f"{self.key}: a choice needs options")
            if self.default is not None and self.default not in self.options:
                raise ValueError(f"{self.key}: the default must be one of the options")
        elif self.options:
            raise ValueError(f"{self.key}: only a choice has options")
        if self.kind == "years" and not (isinstance(self.default, int) and MIN_YEARS <= self.default <= MAX_YEARS):
            raise ValueError(f"{self.key}: years need a default from {MIN_YEARS} to {MAX_YEARS}")
        if self.kind in ("text", "date") and not isinstance(self.default, str | None):
            raise ValueError(f"{self.key}: the default must be text")
        return self

    @property
    def initial(self) -> str | int:
        """The value of a new document."""
        if self.default is not None:
            return self.default
        return self.options[0] if self.kind == "choice" else ""


class DocumentDef(BaseModel):
    id: str
    shortName: str
    partyRoles: tuple[str, str]
    fields: list[FieldDef]
    # From catalog.json.
    name: str
    description: str
    version: str

    @model_validator(mode="after")
    def check_keys(self) -> "DocumentDef":
        keys = [field.key for field in self.fields]
        if len(set(keys)) != len(keys):
            raise ValueError(f"{self.id}: field keys must be unique")
        if {"party1", "party2"} & set(keys):
            raise ValueError(f"{self.id}: party1 and party2 are reserved")
        return self


# Parties are the same in every document: party1 and party2 take the document's partyRoles in order.
class Party(BaseModel):
    name: str = Field("", max_length=MAX_TEXT_LENGTH)
    title: str = Field("", max_length=MAX_TEXT_LENGTH)
    company: str = Field("", max_length=MAX_TEXT_LENGTH)
    noticeAddress: str = Field("", max_length=MAX_TEXT_LENGTH)


# Structured Outputs: every field is required but nullable, because strict JSON schemas need all
# properties listed; null means "leave unchanged".
class PartyUpdate(BaseModel):
    name: str | None
    title: str | None
    company: str | None
    noticeAddress: str | None


def _value_type(field: FieldDef) -> type:
    if field.kind == "years":
        return int
    if field.kind == "choice":
        return Literal[tuple(field.options)]
    return str


class DocumentModels(NamedTuple):
    # Checks the form the frontend sends; missing fields take the document's defaults.
    form: type[BaseModel]
    # The model's answer while drafting the document: a reply, the document and the updates.
    turn: type[BaseModel]


def _document_models(doc: DocumentDef, document_type: type) -> DocumentModels:
    name = "".join(part.title() for part in doc.id.split("-"))
    form_fields = {}
    for field in doc.fields:
        constraint = Field(field.initial, max_length=MAX_TEXT_LENGTH) if field.kind == "text" else field.initial
        form_fields[field.key] = (_value_type(field), constraint)
    form = create_model(
        f"{name}Form",
        **form_fields,
        party1=(Party, Field(default_factory=Party)),
        party2=(Party, Field(default_factory=Party)),
    )
    update = create_model(
        f"{name}Update",
        __config__=ConfigDict(extra="forbid"),
        **{field.key: (_value_type(field) | None, ...) for field in doc.fields},
        party1=(PartyUpdate | None, ...),
        party2=(PartyUpdate | None, ...),
    )
    # documentType comes before updates so the model settles the document first.
    turn = create_model(
        f"{name}Turn",
        __config__=ConfigDict(extra="forbid"),
        reply=(str, ...),
        documentType=(document_type | None, ...),
        updates=(update, ...),
    )
    return DocumentModels(form, turn)


class Registry:
    def __init__(self, documents: list[DocumentDef]):
        self.documents = {doc.id: doc for doc in documents}
        document_type = Literal[tuple(self.documents)]
        self._models = {doc.id: _document_models(doc, document_type) for doc in documents}
        # The model's answer while no document is chosen yet.
        self._selection_model = create_model(
            "SelectionTurn",
            __config__=ConfigDict(extra="forbid"),
            reply=(str, ...),
            documentType=(document_type | None, ...),
        )

    def get(self, document_id: str | None) -> DocumentDef | None:
        return self.documents.get(document_id)

    def form_model(self, doc: DocumentDef) -> type[BaseModel]:
        return self._models[doc.id].form

    def turn_model(self, doc: DocumentDef | None) -> type[BaseModel]:
        return self._models[doc.id].turn if doc else self._selection_model


def load_registry(templates_dir: Path) -> Registry:
    """Reads documents.json and catalog.json; raises ValueError if they don't match."""
    catalog = json.loads((templates_dir / "catalog.json").read_text(encoding="utf-8"))
    entries = {entry["id"]: entry for entry in catalog["templates"]}
    data = json.loads((templates_dir / "documents.json").read_text(encoding="utf-8"))
    if data.get("schema_version") != 1:
        raise ValueError("documents.json must have schema_version 1")
    if [doc["id"] for doc in data["documents"]] != list(entries):
        raise ValueError("documents.json must list the catalog's documents, in catalog order")
    return Registry(
        [
            DocumentDef.model_validate({**doc, **{key: entries[doc["id"]][key] for key in ("name", "description", "version")}})
            for doc in data["documents"]
        ]
    )
