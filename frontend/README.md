# Prelegal frontend

The Prelegal web app. It is exported as a static site (`npm run build` writes
`out/`), which the FastAPI backend serves; see the [root README](../README.md).

- **Landing page** (`/`, `app/(marketing)`) — what Prelegal does and the
  documents it can draft.
- **Sign up and sign in** (`/signup/`, `/signin/`, `app/(auth)`) — one form,
  `components/AuthForm.tsx`.
- **My documents** (`/documents/`) — the user's saved documents
  (`components/DocumentsDashboard.tsx`): continue, download the PDF or delete.
- **Editor** (`/editor/`), described below; `/editor/?id=N` reopens a saved
  document. The site is static, so the id is a query parameter.

The signed-in pages share `app/(app)/layout.tsx`: `components/AuthGate.tsx`
sends signed-out visitors to `/signin/` (and `GuestGate` sends signed-in ones
from the sign-in pages to `/documents/`), and `components/AppHeader.tsx` is the
navigation. Shared building blocks are in `components/ui/`.

## Accounts

The session is an HttpOnly cookie the page can't read, so
`lib/auth/AuthProvider.tsx` asks the backend who is signed in
(`GET /api/auth/me`) when the app loads, and signs users up, in and out
(`lib/auth/api.ts`). Every call goes through `lib/api.ts`, which sends the
cookie; a 401 from any call means the session has ended (for example because the
server restarted, which resets its database), and the user is sent to sign in.
`lib/auth/validate.ts` checks the forms before they are sent, with the backend's
rules.

## Editor

The user chats with an AI assistant, which works out which of the 11
[Common Paper](https://commonpaper.com/standards) agreements in `templates/`
fits their deal (or explains that it can't draft what they asked for and
suggests the closest one), then asks about the agreement and fills in its key
terms as they answer. Until a document is chosen, the preview lists what can be
drafted; picking one asks the assistant for it. The document preview updates
live, and the document downloads as a PDF. Once a document is chosen, it is
saved after every reply, with the conversation, so it can be reopened and
continued.

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
  the fields in the reply are merged into the form. Under `npm run dev`, set
  `NEXT_PUBLIC_API_BASE=http://localhost:8000` (and
  `CORS_ORIGINS=http://localhost:3000` on the backend).
- **Saving** — `lib/documents/autosave.ts` saves the draft and the conversation
  after each reply (`lib/documents/saved.ts` calls `/api/documents`): the first
  save creates the document, and the editor (`components/EditorScreen.tsx`) then
  puts its id in the URL without reloading. Reopening rebuilds the draft with
  `restoreDraft` in `lib/documents/chat.ts`. The header shows whether the draft
  is saved, with a Retry if a save failed.
- **Cover page** — `lib/documents/coverPage.ts` builds it from the form. The
  Mutual NDA follows `templates/mutual-nda/cover-page.md`; the other templates
  have no cover page, so they get a generated Key Terms page in the same style.
  Blank fields show a bracketed placeholder (for example `[Fill in state]`),
  which is highlighted in the preview, and the header shows how many are left.
  Blank dates show today's date until one is chosen. Every cover page has a
  "DRAFT - SUBJECT TO LEGAL REVIEW" notice under its title (`DRAFT_NOTICE`), so
  the preview and the PDF both say the document is a draft and not legal advice.
- **Document model** — the cover page and Standard Terms become a list of
  blocks (`lib/documents/types.ts`; `lib/documents/parse.ts` turns the
  templates' nested, numbered clauses into blocks), which are rendered twice:
  as HTML for the live preview (`components/DocumentPreview.tsx`) and as a PDF
  (`components/DocumentPdf.tsx`, using `@react-pdf/renderer`). The PDF is
  generated in the browser (`lib/documents/pdf.tsx`), from the editor or straight
  from My documents. What the user types in the chat is sent to the AI
  model via the backend.
- Signature and date lines are left blank so the parties can sign.

## Attribution

The documents are Common Paper's standard agreements, used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The generated
documents keep Common Paper's attribution lines.
