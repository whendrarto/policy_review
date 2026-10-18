"""Checks on the model's updates, and the values that carry over when the user switches documents."""

import re
from datetime import date

from pydantic import BaseModel

from .documents import MAX_TEXT_LENGTH, MAX_YEARS, MIN_YEARS, DocumentDef, FieldDef

ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PARTIES = ("party1", "party2")

# The model likes typographic hyphens and spaces (hyphen, non-breaking hyphen, no-break, narrow
# no-break and thin spaces); plain ones are safe in the PDF's font.
PLAIN_CHARACTERS = str.maketrans({"‐": "-", "‑": "-", " ": " ", " ": " ", " ": " "})


def _clean_text(value: str | None) -> str | None:
    return None if value is None else value.translate(PLAIN_CHARACTERS).strip()[:MAX_TEXT_LENGTH]


def _clean_years(value: int | None) -> int | None:
    return value if value is not None and MIN_YEARS <= value <= MAX_YEARS else None


def _clean_date(value: str | None) -> str | None:
    value = value and value.strip()
    # fromisoformat alone also takes forms like "20261018", which the frontend rejects.
    if not value or not ISO_DATE.match(value):
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def _clean_value(field: FieldDef, value):
    if field.kind == "text":
        return _clean_text(value)
    if field.kind == "date":
        return _clean_date(value)
    if field.kind == "years":
        return _clean_years(value)
    return value if value in field.options else None


def _drop_none(values: dict) -> dict:
    return {key: value for key, value in values.items() if value is not None}


def sanitize_updates(doc: DocumentDef, updates: BaseModel) -> dict:
    """The model's updates as a sparse dict, without values the document can't use."""
    cleaned = _drop_none({field.key: _clean_value(field, getattr(updates, field.key)) for field in doc.fields})
    for key in PARTIES:
        party = getattr(updates, key)
        if party and (fields := _drop_none({name: _clean_text(value) for name, value in party.model_dump().items()})):
            cleaned[key] = fields
    return cleaned


def carry_over(source: DocumentDef, target: DocumentDef, form: BaseModel) -> dict:
    """The values of `form` (a `source` document) that keep their meaning in `target`, as updates.

    Parties keep their position; carried fields move to the field with the same key. Blank values
    are not carried, so a blank date keeps following today.
    """
    carried_keys = {field.key for field in target.fields if field.carry}
    carried = {field.key: getattr(form, field.key) for field in source.fields if field.carry and field.key in carried_keys}
    for key in PARTIES:
        carried[key] = {name: value for name, value in getattr(form, key).model_dump().items() if value}
    return {key: value for key, value in carried.items() if value}


def merge_updates(first: dict, second: dict) -> dict:
    """`second` applied on top of `first`, merging party fields."""
    merged = {**first, **second}
    for key in PARTIES:
        if key in first and key in second:
            merged[key] = {**first[key], **second[key]}
    return merged
