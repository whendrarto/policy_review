# Legal Document Templates

A dataset of standard legal agreements that the system can later fill in and
modify for the user. All templates are the official
[Common Paper](https://commonpaper.com) standard agreements, copied verbatim
from their GitHub repositories.

| ID | Agreement | Version | Category |
|---|---|---|---|
| `mutual-nda` | Mutual Non-Disclosure Agreement (Cover Page + Standard Terms) | 1.0 | confidentiality |
| `cloud-service-agreement` | Cloud Service Agreement | 3.0 | commercial |
| `software-license-agreement` | Software License Agreement | 1.1 | commercial |
| `professional-services-agreement` | Professional Services Agreement | 1.0 | commercial |
| `pilot-agreement` | Pilot Agreement | 1.1 | commercial |
| `design-partner-agreement` | Design Partner Agreement | 1.0 | commercial |
| `partnership-agreement` | Partnership Agreement | 1.0 | commercial |
| `service-level-agreement` | Service Level Agreement | 2.0 | addendum |
| `ai-addendum` | AI Addendum | 1.0 | addendum |
| `data-processing-agreement` | Data Processing Agreement | 1.0 | privacy |
| `business-associate-agreement` | Business Associate Agreement | 1.0 | privacy |

## Layout

```
templates/
  catalog.json              # machine-readable index (generated)
  <template-id>/
    standard-terms.md       # Standard Terms, verbatim from Common Paper
    cover-page.md           # Cover Page, where Common Paper publishes one
```

## How the templates work

Common Paper agreements split into two parts:

- **Standard Terms** – the fixed legal text, which is not edited directly.
- **Cover Page / Key Terms / Order Form / Business Terms / SOW** – the
  deal-specific values, which the user fills in. Changes to the Standard Terms
  are also recorded here, and they take precedence over the Standard Terms.

Inside the Standard Terms, each term whose value comes from a companion document
is marked up as a **Variable**:

```html
<span class="coverpage_link">Governing Law</span>
```

The class prefix tells you where the value is set (`coverpage`, `keyterms`,
`orderform`, `businessterms` or `sow`). The cover page uses `[bracketed text]`
for values the user fills in.

## catalog.json

`catalog.json` lists every template with its metadata, source repository and
commit, file paths, the Variables used in the Standard Terms (with occurrence
counts) and, where there is one, the cover page placeholders. It is generated.
Do not edit it by hand:

```
python scripts/build_catalog.py           # regenerate
python scripts/build_catalog.py --check   # verify it is up to date
```

To add or update a template, copy the markdown into `templates/<id>/`, add or
update its entry in `TEMPLATES` in `scripts/build_catalog.py` (including the
source commit), and regenerate.

## License and attribution

These templates are published by Common Paper and are used under the
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
license. Source repositories: <https://github.com/CommonPaper>. If the system
modifies a template, it must keep the attribution and indicate that changes
were made, as CC BY 4.0 requires.
