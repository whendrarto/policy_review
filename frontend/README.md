# Mutual NDA Creator

Prototype web app (Jira KAN-5) for creating a Mutual Non-Disclosure Agreement.
The user fills in the key terms in a form, sees the
[Common Paper Mutual NDA](https://commonpaper.com/standards/mutual-nda/1.0)
with those terms filled in as they type, and downloads the completed document
as a PDF.

## Running it

Requires Node.js 22.12 or newer (the tests use Vitest 5).

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run lint
npm run build
```

## How it works

- **Legal text** — the Standard Terms are read from
  `../templates/mutual-nda/standard-terms.md` (the KAN-4 dataset) at build
  time, so `templates/` remains the single source of truth. The app must be
  built from inside the repository.
- **Cover Page** — `lib/nda/document.ts` builds it from the form, following
  `templates/mutual-nda/cover-page.md`. Blank fields keep the template's
  bracketed placeholder (for example `[Fill in state]`), which is highlighted
  in the preview, and the header shows how many are left.
- **Document model** — the Cover Page and Standard Terms become a list of
  blocks (`lib/nda/types.ts`), which are rendered twice: as HTML for the live
  preview (`components/NdaPreview.tsx`) and as a PDF
  (`components/NdaPdf.tsx`, using `@react-pdf/renderer`). The PDF is generated
  in the browser, so nothing the user types leaves their machine.
- Signature and date lines are left blank so the parties can sign.

## Attribution

The Mutual NDA is Common Paper's Mutual Non-Disclosure Agreement Version 1.0,
used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The
generated document keeps Common Paper's attribution lines.
