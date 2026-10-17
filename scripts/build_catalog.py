"""Build templates/catalog.json from the legal document templates in templates/.

The catalog lists every template, where it came from, and the Variables it
contains. A Variable is a term in the Standard Terms whose value is supplied by
the user on a companion document (Cover Page, Key Terms, Order Form, Business
Terms or Statement of Work). In the Common Paper markdown these are marked up as
<span class="<kind>_link">Name</span>, which is what the system will later fill
in or modify for the user.

Usage:
    python scripts/build_catalog.py           # rewrite templates/catalog.json
    python scripts/build_catalog.py --check   # fail if catalog.json is stale
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = ROOT / "templates"
CATALOG_PATH = TEMPLATES_DIR / "catalog.json"

LICENSE = {
    "name": "CC BY 4.0",
    "url": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Common Paper (https://commonpaper.com)",
}

# Companion document that supplies the value of each Variable kind.
VARIABLE_SOURCES = {
    "coverpage": "Cover Page",
    "keyterms": "Key Terms",
    "orderform": "Order Form",
    "businessterms": "Business Terms",
    "sow": "Statement of Work",
}

TEMPLATES = [
    {
        "id": "mutual-nda",
        "name": "Mutual Non-Disclosure Agreement",
        "category": "confidentiality",
        "description": "Mutual NDA letting both parties share confidential information while evaluating a business relationship.",
        "version": "1.0",
        "canonical_url": "https://commonpaper.com/standards/mutual-nda/1.0",
        "repo": "CommonPaper/Mutual-NDA",
        "commit": "2a3068b6c0ab6015c440f541d5b215bc3ac2f4cb",
        "files": {"cover_page": "cover-page.md", "standard_terms": "standard-terms.md"},
    },
    {
        "id": "cloud-service-agreement",
        "name": "Cloud Service Agreement",
        "category": "commercial",
        "description": "SaaS subscription agreement between a cloud service provider and a customer.",
        "version": "3.0",
        "canonical_url": "https://commonpaper.com/standards/cloud-service-agreement/3.0",
        "repo": "CommonPaper/CSA",
        "commit": "3efceb01e3c8bfb7b302a5f34975aa2b084026a3",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "software-license-agreement",
        "name": "Software License Agreement",
        "category": "commercial",
        "description": "License for software the customer installs and runs itself (on-premise or self-hosted).",
        "version": "1.1",
        "canonical_url": "https://commonpaper.com/standards/software-license-agreement/1.1",
        "repo": "CommonPaper/Software-License-Agreement",
        "commit": "8ea7de38148a8a0c235b7aaf31487028c2e519ca",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "professional-services-agreement",
        "name": "Professional Services Agreement",
        "category": "commercial",
        "description": "Agreement for services delivered under one or more Statements of Work.",
        "version": "1.0",
        "canonical_url": "https://commonpaper.com/standards/professional-services-agreement/1.0",
        "repo": "CommonPaper/PSA",
        "commit": "3fb650a72d229f6d6e6d64abebae5e83c6699535",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "pilot-agreement",
        "name": "Pilot Agreement",
        "category": "commercial",
        "description": "Short-term trial or evaluation of a product before a full commercial agreement.",
        "version": "1.1",
        "canonical_url": "https://commonpaper.com/standards/pilot-agreement/1.1",
        "repo": "CommonPaper/Pilot-Agreement",
        "commit": "5e7cdd4678cd9d6b3178872cce4a01d632f41f14",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "design-partner-agreement",
        "name": "Design Partner Agreement",
        "category": "commercial",
        "description": "Early-access program where a partner gives product feedback to the provider.",
        "version": "1.0",
        "canonical_url": "https://commonpaper.com/standards/design-partner-agreement/1.0",
        "repo": "CommonPaper/Design-Partner-Agreement",
        "commit": "94a1cf8f326bc623b8122dc3b7ffbbcea0d010ca",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "partnership-agreement",
        "name": "Partnership Agreement",
        "category": "commercial",
        "description": "Business partnership such as referral, reseller or co-marketing arrangements.",
        "version": "1.0",
        "canonical_url": "https://commonpaper.com/standards/partnership-agreement/1.0",
        "repo": "CommonPaper/Partnership-Agreement",
        "commit": "6edeb5a285206893cfd0ac482267db44d90f317c",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "service-level-agreement",
        "name": "Service Level Agreement",
        "category": "addendum",
        "description": "Uptime and support response commitments with service credits, attached to an Order Form.",
        "version": "2.0",
        "canonical_url": "https://commonpaper.com/standards/service-level-agreement/2.0",
        "repo": "CommonPaper/SLA",
        "commit": "5b0e6336f058a66c4976d70ecabf1f5fb9ef3af4",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "ai-addendum",
        "name": "AI Addendum",
        "category": "addendum",
        "description": "Terms governing AI services, including use of customer data for model training.",
        "version": "1.0",
        "canonical_url": "https://commonpaper.com/standards/ai-addendum/1.0",
        "repo": "CommonPaper/AI-Addendum",
        "commit": "6d9b044df73a2477c177e5989fca7f8d27df9387",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "data-processing-agreement",
        "name": "Data Processing Agreement",
        "category": "privacy",
        "description": "GDPR/UK GDPR data processing terms between a controller customer and a processor provider.",
        "version": "1.0",
        "canonical_url": "https://commonpaper.com/standards/data-processing-agreement/1.0",
        "repo": "CommonPaper/DPA",
        "commit": "9f1c40d3fb0bb900397a919d058a9c0870f6b0f0",
        "files": {"standard_terms": "standard-terms.md"},
    },
    {
        "id": "business-associate-agreement",
        "name": "Business Associate Agreement",
        "category": "privacy",
        "description": "HIPAA business associate terms for handling protected health information.",
        "version": "1.0",
        "canonical_url": "https://commonpaper.com/standards/business-associate-agreement/1.0",
        "repo": "CommonPaper/BAA",
        "commit": "5f1fd992df1d0c78bf69997e1881e4107fa75695",
        "files": {"standard_terms": "standard-terms.md"},
    },
]

VARIABLE_RE = re.compile(r'<span class="([a-z]+)_link">([^<]+)</span>')
POSSESSIVE_RE = re.compile(r"[’']s$")
# Cover page placeholders look like "[Fill in state]"; skip markdown links and checkboxes.
PLACEHOLDER_RE = re.compile(r"(?<!\])\[([^\]\[]{2,})\](?!\()")


def extract_variables(text):
    """Return Variables in the Standard Terms, grouped by name with usage counts."""
    counts = Counter()
    for kind, name in VARIABLE_RE.findall(text):
        name = POSSESSIVE_RE.sub("", name.strip())
        counts[(kind, name)] += 1

    # Fold plurals ("Subscription Periods") into their singular when both appear.
    names = {name for _, name in counts}
    merged = Counter()
    for (kind, name), n in counts.items():
        if name.endswith("s") and name[:-1] in names:
            name = name[:-1]
        merged[(kind, name)] += n

    return [
        {
            "name": name,
            "source": VARIABLE_SOURCES.get(kind, kind),
            "occurrences": n,
        }
        for (kind, name), n in sorted(merged.items(), key=lambda item: item[0][1].lower())
    ]


def extract_placeholders(text):
    return sorted(set(PLACEHOLDER_RE.findall(text)))


def build_catalog():
    entries = []
    for meta in TEMPLATES:
        folder = TEMPLATES_DIR / meta["id"]
        files = {key: f"{meta['id']}/{name}" for key, name in meta["files"].items()}
        for path in files.values():
            if not (TEMPLATES_DIR / path).is_file():
                raise FileNotFoundError(f"Missing template file: templates/{path}")

        entry = {
            "id": meta["id"],
            "name": meta["name"],
            "category": meta["category"],
            "description": meta["description"],
            "version": meta["version"],
            "publisher": "Common Paper",
            "canonical_url": meta["canonical_url"],
            "source": {
                "repo": f"https://github.com/{meta['repo']}",
                "commit": meta["commit"],
            },
            "license": LICENSE["name"],
            "files": files,
            "variables": extract_variables((folder / meta["files"]["standard_terms"]).read_text(encoding="utf-8")),
        }
        if "cover_page" in meta["files"]:
            cover = (folder / meta["files"]["cover_page"]).read_text(encoding="utf-8")
            entry["cover_page_placeholders"] = extract_placeholders(cover)
        entries.append(entry)

    return {"schema_version": 1, "license": LICENSE, "templates": entries}


def render(catalog):
    return json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="exit non-zero if catalog.json is out of date")
    args = parser.parse_args()

    output = render(build_catalog())
    if args.check:
        current = CATALOG_PATH.read_text(encoding="utf-8") if CATALOG_PATH.exists() else ""
        if current != output:
            print("templates/catalog.json is out of date; run python scripts/build_catalog.py", file=sys.stderr)
            return 1
        print("templates/catalog.json is up to date")
        return 0

    CATALOG_PATH.write_text(output, encoding="utf-8", newline="\n")
    print(f"Wrote {CATALOG_PATH.relative_to(ROOT)} ({len(TEMPLATES)} templates)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
