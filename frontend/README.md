# Prelegal frontend

The Prelegal web app. It is exported as a static site (`npm run build` writes
`out/`), which the FastAPI backend serves; see the [root README](../README.md).

- **Sign-in** (`/`) — a placeholder until real authentication: any name and
  email are kept in the tab's `sessionStorage` (`lib/auth/`), and
  `components/AuthGate.tsx` sends signed-out visitors back to it.
- **Mutual NDA Creator** (`/nda/`), described below.

## Mutual NDA Creator

The user chats with an AI assistant, which asks about the agreement and fills in
the key terms of the
[Common Paper Mutual NDA](https://commonpaper.com/standards/mutual-nda/1.0)
as they answer. The document preview updates live, and the completed document
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

- **Legal text** — the Standard Terms are read from
  `../templates/mutual-nda/standard-terms.md` (the KAN-4 dataset) at build
  time, so `templates/` remains the single source of truth. The app must be
  built from inside the repository.
- **AI chat** — `components/ChatPanel.tsx` is a generic chat UI.
  `components/NdaCreator.tsx` sends the history and the current form to the
  backend's `POST /api/chat` (`lib/chat/client.ts`) and merges the fields in
  the reply into the form (`lib/nda/chat.ts`). The conversation lives in memory
  only. Under `npm run dev`, set `NEXT_PUBLIC_API_BASE=http://localhost:8000`
  (and `CORS_ORIGINS=http://localhost:3000` on the backend).
- **Cover Page** — `lib/nda/document.ts` builds it from the form, following
  `templates/mutual-nda/cover-page.md`. Blank fields keep the template's
  bracketed placeholder (for example `[Fill in state]`), which is highlighted
  in the preview, and the header shows how many are left.
- **Document model** — the Cover Page and Standard Terms become a list of
  blocks (`lib/nda/types.ts`), which are rendered twice: as HTML for the live
  preview (`components/NdaPreview.tsx`) and as a PDF
  (`components/NdaPdf.tsx`, using `@react-pdf/renderer`). The PDF is generated
  in the browser. What the user types in the chat is sent to the AI
  model via the backend.
- Signature and date lines are left blank so the parties can sign.

## Attribution

The Mutual NDA is Common Paper's Mutual Non-Disclosure Agreement Version 1.0,
used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The
generated document keeps Common Paper's attribution lines.
