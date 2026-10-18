import pytest

from app.config import DEFAULT_TEMPLATES_DIR
from app.documents import load_registry
from app.sanitize import carry_over, merge_updates, sanitize_updates

REGISTRY = load_registry(DEFAULT_TEMPLATES_DIR)
NDA = REGISTRY.get("mutual-nda")
CSA = REGISTRY.get("cloud-service-agreement")
SLA = REGISTRY.get("service-level-agreement")


def update(doc=NDA, **fields):
    """The model's updates for `doc`, null for anything not given."""
    model = REGISTRY.turn_model(doc).model_fields["updates"].annotation
    return model(**{**dict.fromkeys(model.model_fields), **fields})


def party(**fields):
    return {"name": None, "title": None, "company": None, "noticeAddress": None, **fields}


# sanitize_updates


def test_sanitize_drops_unchanged_fields():
    assert sanitize_updates(NDA, update()) == {}
    assert sanitize_updates(NDA, update(party1=party())) == {}


@pytest.mark.parametrize("years", [0, 100, -1])
def test_sanitize_drops_out_of_range_years(years):
    assert sanitize_updates(NDA, update(mndaTermYears=years, confidentialityYears=years)) == {}


@pytest.mark.parametrize("years", [1, 99])
def test_sanitize_keeps_valid_years(years):
    assert sanitize_updates(NDA, update(mndaTermYears=years)) == {"mndaTermYears": years}


@pytest.mark.parametrize("value", ["2026-02-30", "10/18/2026", "2026-1-5", "next Monday", ""])
def test_sanitize_drops_invalid_dates(value):
    assert sanitize_updates(NDA, update(effectiveDate=value)) == {}


def test_sanitize_keeps_valid_dates():
    assert sanitize_updates(NDA, update(effectiveDate="2028-02-29")) == {"effectiveDate": "2028-02-29"}


def test_sanitize_keeps_choices():
    assert sanitize_updates(NDA, update(mndaTerm="untilTerminated")) == {"mndaTerm": "untilTerminated"}


def test_sanitize_trims_and_caps_text_and_keeps_clears():
    result = sanitize_updates(NDA, update(purpose="  Hiring  ", governingLaw="x" * 3000, modifications=""))
    assert result == {"purpose": "Hiring", "governingLaw": "x" * 2000, "modifications": ""}


def test_sanitize_uses_plain_hyphens_and_spaces():
    result = sanitize_updates(NDA, update(chosenCourts="courts in New Castle, DE", purpose="a‑b‐c"))
    assert result == {"chosenCourts": "courts in New Castle, DE", "purpose": "a-b-c"}


def test_sanitize_keeps_only_named_party_fields():
    result = sanitize_updates(NDA, update(party2=party(name="Bob", noticeAddress="bob@globex.com")))
    assert result == {"party2": {"name": "Bob", "noticeAddress": "bob@globex.com"}}


def test_sanitize_handles_any_document():
    result = sanitize_updates(CSA, update(CSA, subscriptionPeriod=" 1 year ", chosenCourts="courts in Wilmington, DE"))
    assert result == {"subscriptionPeriod": "1 year", "chosenCourts": "courts in Wilmington, DE"}


# carry_over


def form(doc, **values):
    return REGISTRY.form_model(doc).model_validate(values)


def test_carry_over_keeps_parties_date_law_and_courts():
    nda = form(
        NDA,
        purpose="Hiring",
        effectiveDate="2026-11-01",
        mndaTermYears=3,
        governingLaw="Delaware",
        chosenCourts="courts located in New Castle, DE",
        party1={"company": "Acme", "name": "Jane"},
        party2={"company": "Globex"},
    )
    assert carry_over(NDA, CSA, nda) == {
        "effectiveDate": "2026-11-01",
        "governingLaw": "Delaware",
        "chosenCourts": "courts located in New Castle, DE",
        "party1": {"company": "Acme", "name": "Jane"},
        "party2": {"company": "Globex"},
    }


def test_carry_over_works_back_to_the_nda():
    csa = form(CSA, governingLaw="New York", chosenCourts="courts in New York, NY", subscriptionPeriod="1 year")
    assert carry_over(CSA, NDA, csa) == {"governingLaw": "New York", "chosenCourts": "courts in New York, NY"}


def test_carry_over_skips_blanks_and_fields_the_target_lacks():
    csa = form(CSA, governingLaw="Delaware", party1={"company": "Acme"})
    # The SLA has no date, law or courts; a blank date keeps following today.
    assert carry_over(CSA, SLA, csa) == {"party1": {"company": "Acme"}}
    assert carry_over(NDA, CSA, form(NDA)) == {}


def test_merge_updates_merges_parties():
    merged = merge_updates({"party1": {"company": "Acme"}, "governingLaw": "Delaware"}, {"party1": {"name": "Jane"}, "governingLaw": "Ohio"})
    assert merged == {"party1": {"company": "Acme", "name": "Jane"}, "governingLaw": "Ohio"}
