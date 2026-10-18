# Prelegal frontend

The Prelegal web app. It is exported as a static site (`npm run build` writes
`out/`), which the FastAPI backend serves; see the [root README](../README.md).

- **Sign-in** (`/`) — a placeholder until real authentication: any name and
  email are kept in the tab's `sessionStorage` (`lib/auth/`), and
  `components/AuthGate.tsx` sends signed-out visitors back to it.
- **Document Creator** (`/documents/`), described below.

## Document Creator

The user chats with an AI assistant, which works out which of the 11
[Common Paper](https://commonpaper.com/standards) agreements in `templates/`
fits their deal (or explains that it can't draft what they asked for and
suggests the closest one), then asks about the agreement and fills in its key
terms as they answer. Until a document is chosen, the preview lists what can be
drafted. The document preview updates live, and the completed document
downloads as a PDF.

## Running it

Requires Node.js 22.12 or newer (the tests use Vitest 5).

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run lint
npm run build    # static site in out/
```

## How it works

- **Documents** — `lib/documents/registry.ts` reads `templates/catalog.json`
  and `templates/documents.json` (each document's fields, which the backend
  reads too). The Standard Terms are read from
  `../templates/<id>/standard-terms.md` (the KAN-4 dataset) at build time, one
  chunk per document that downloads when the document is chosen
  (`lib/documents/terms.ts`), so `templates/` remains the single source of
  truth. The app must be built from inside the repository.
- **AI chat** — `components/ChatPanel.tsx` is a generic chat UI.
  `components/DocumentCreator.tsx` sends the history, the chosen document and
  its form to the backend's `POST /api/chat` (`lib/chat/client.ts`).
  `lib/documents/chat.ts` applies the reply: when the AI settles on a new
  document, the draft starts that document afresh with the values the backend
  carried over (parties, effective date, governing law and courts); otherwise
  the fields in the reply are merged into the form. The conversation lives in
  memory only. Under `npm run dev`, set
  `NEXT_PUBLIC_API_BASE=http://localhost:8000` (and
  `CORS_ORIGINS=http://localhost:3000` on the backend).
- **Cover page** — `lib/documents/coverPage.ts` builds it from the form. The
  Mutual NDA follows `templates/mutual-nda/cover-page.md`; the other templates
  have no cover page, so they get a generated Key Terms page in the same style.
  Blank fields show a bracketed placeholder (for example `[Fill in state]`),
  which is highlighted in the preview, and the header shows how many are left.
  Blank dates show today's date until one is chosen.
- **Document model** — the cover page and Standard Terms become a list of
  blocks (`lib/documents/types.ts`; `lib/documents/parse.ts` turns the
  templates' nested, numbered clauses into blocks), which are rendered twice:
  as HTML for the live preview (`components/DocumentPreview.tsx`) and as a PDF
  (`components/DocumentPdf.tsx`, using `@react-pdf/renderer`). The PDF is
  generated in the browser. What the user types in the chat is sent to the AI
  model via the backend.
- Signature and date lines are left blank so the parties can sign.

## Attribution

The documents are Common Paper's standard agreements, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The generated
documents keep Common Paper's attribution lines.
