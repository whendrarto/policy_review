import json
import shutil

import pytest
from litellm.utils import type_to_response_format_param
from pydantic import ValidationError

from app.config import DEFAULT_TEMPLATES_DIR
from app.documents import FieldDef, load_registry

REGISTRY = load_registry(DEFAULT_TEMPLATES_DIR)
CATALOG = json.loads((DEFAULT_TEMPLATES_DIR / "catalog.json").read_text(encoding="utf-8"))
NON_NDA = [entry for entry in CATALOG["templates"] if entry["id"] != "mutual-nda"]


def test_registry_lists_every_catalog_document_with_its_catalog_details():
    assert list(REGISTRY.documents) == [entry["id"] for entry in CATALOG["templates"]]
    pilot = REGISTRY.get("pilot-agreement")
    assert (pilot.name, pilot.version, pilot.partyRoles) == ("Pilot Agreement", "1.1", ("Provider", "Customer"))
    assert REGISTRY.get(None) is None
    assert REGISTRY.get("employment-contract") is None


@pytest.mark.parametrize("entry", NON_NDA, ids=lambda entry: entry["id"])
def test_every_catalog_variable_is_a_field_a_party_or_covered_elsewhere(entry):
    doc = REGISTRY.get(entry["id"])
    # "Agreement" is the contract the document attaches to, and the signature table has a
    # notice address row for each party.
    covered = {field.label for field in doc.fields} | set(doc.partyRoles) | {"Agreement", "Notice Address"}
    variables = {variable["name"] for variable in entry["variables"]}
    assert variables <= covered
    assert {field.label for field in doc.fields} <= variables


def test_a_key_means_the_same_in_every_document():
    # Carry-over moves values between fields of the same key, and the frontend relies on keys too.
    seen = {}
    for doc in REGISTRY.documents.values():
        for field in doc.fields:
            kind = (field.kind, field.carry, tuple(field.options))
            assert seen.setdefault(field.key, kind) == kind, f"{doc.id}.{field.key}"
    assert {key for key, (_, carry, _) in seen.items() if carry} == {"effectiveDate", "governingLaw", "chosenCourts"}


@pytest.mark.parametrize("doc_id", list(REGISTRY.documents))
def test_turn_schemas_are_strict(doc_id):
    doc = REGISTRY.get(doc_id)
    schema = type_to_response_format_param(REGISTRY.turn_model(doc))["json_schema"]["schema"]
    for model in [schema, *schema["$defs"].values()]:
        assert model["additionalProperties"] is False
        assert set(model["required"]) == set(model["properties"])
    update_model = REGISTRY.turn_model(doc).model_fields["updates"].annotation
    assert set(schema["$defs"][update_model.__name__]["properties"]) == {
        *(field.key for field in doc.fields),
        "party1",
        "party2",
    }
    assert {"type": "null"} in schema["properties"]["documentType"]["anyOf"]


def test_selection_schema_has_only_a_reply_and_the_document():
    schema = REGISTRY.turn_model(None).model_json_schema()
    assert set(schema["properties"]) == {"reply", "documentType"}
    assert schema["properties"]["documentType"]["anyOf"][0]["enum"] == list(REGISTRY.documents)


def test_form_model_fills_in_defaults_and_checks_values():
    nda = REGISTRY.form_model(REGISTRY.get("mutual-nda"))
    form = nda.model_validate({"governingLaw": "Delaware", "unknown": "ignored"})
    assert (form.mndaTerm, form.mndaTermYears, form.governingLaw, form.party1.company) == ("expires", 1, "Delaware", "")
    with pytest.raises(ValidationError):
        nda.model_validate({"mndaTerm": "forever"})
    with pytest.raises(ValidationError):
        nda.model_validate({"purpose": "x" * 2001})


@pytest.mark.parametrize(
    "field",
    [
        {"key": "term", "kind": "choice"},
        {"key": "term", "kind": "choice", "options": ["a"], "default": "b"},
        {"key": "term", "kind": "text", "options": ["a"]},
        {"key": "years", "kind": "years"},
        {"key": "years", "kind": "years", "default": 100},
        {"key": "Bad-Key", "kind": "text"},
    ],
)
def test_field_definitions_are_checked(field):
    with pytest.raises(ValidationError):
        FieldDef(label="Label", description="Description", **field)


def test_documents_json_must_match_the_catalog(tmp_path):
    for name in ("catalog.json", "documents.json"):
        shutil.copy(DEFAULT_TEMPLATES_DIR / name, tmp_path / name)
    documents = json.loads((tmp_path / "documents.json").read_text(encoding="utf-8"))
    documents["documents"].pop()
    (tmp_path / "documents.json").write_text(json.dumps(documents), encoding="utf-8")
    with pytest.raises(ValueError, match="catalog"):
        load_registry(tmp_path)
