# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the templates/catalog.json file, included here:

@templates/catalog.json

The fields the user fills in for each document are defined in templates/documents.json.

The current implementation supports all 11 documents, chosen and filled in via AI chat, with real sign up and sign in and saved documents. See "Implementation status" below.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `openrouter/openai/gpt-oss-120b` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/  
The database should use SQLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
Consider statically building the frontend and serving it via FastAPI, if that will work.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Implementation status

Done (KAN-5, KAN-6, KAN-7, KAN-8, KAN-9):
- **Docker**: a multi-stage `Dockerfile` builds the Next.js frontend as a static export (`frontend/out`), which FastAPI serves at `/`, and copies `templates/` into the backend image. `docker-compose.yml` runs it on port 8000 and loads `.env`. The start/stop scripts in `scripts/` wrap `docker compose`.
- **Backend** (`backend/app/`): FastAPI app factory (`main.py:create_app`) with `GET /api/health`, `POST /api/chat`, the auth API and the documents API. `db.py` deletes and recreates the SQLite database (`users`, `sessions`, `documents`) on every startup, so a restart signs everyone out and loses saved documents. Config (`config.py`) comes from env vars `DATABASE_PATH`, `STATIC_DIR`, `OPENROUTER_API_KEY`, `CORS_ORIGINS` (also allows credentials), `TEMPLATES_DIR` (defaults to the repo's `templates/`) and `COOKIE_SECURE` (off by default; Docker is plain HTTP); local runs also load the root `.env`. `deps.py` has the shared dependencies: a per-request connection (`get_db`) and the signed-in user (`current_user`, 401 otherwise). Tests use pytest (`uv run pytest`); `conftest.py` has `sign_up`, `signed_in_client` and `make_client` (a second browser).
- **Auth** (`auth_api.py`, `security.py`): `POST /api/auth/signup|signin|signout`, `GET /api/auth/me`. Passwords are stdlib scrypt hashes; emails are lowercased. A session is a random token in an HttpOnly, SameSite=Lax, 7-day cookie, stored as its SHA-256 in `sessions`. Unknown emails are checked against a dummy hash so failed sign-ins look and take the same; a taken email gives 409.
- **Saved documents** (`documents_api.py`): `/api/documents` CRUD, always limited to the signed-in user (others' documents are 404). A saved document is the whole draft: its type, its form (validated against the document's form model, with defaults filled in), the conversation, and a title derived from the parties ("Pilot Agreement - Acme / Globex").
- **Documents** (`backend/app/documents.py`): the registry, loaded at startup from `templates/documents.json` and `catalog.json` (a mismatch stops the app). Fields have a kind (text, date, years, choice) and may be optional or carried over on a switch. For each document it builds, with `pydantic.create_model`, the model that checks the form and the strict Structured Outputs model the LLM answers in; a selection-only model is used before a document is chosen. party1/party2 take each document's two `partyRoles`.
- **AI chat** (`chat.py`, `prompt.py`, `sanitize.py`): stateless. Each request sends the chat history, `documentType` (a catalog id or null), the form and today's date. The model (LiteLLM, OpenRouter, Cerebras, Structured Outputs, reasoning effort medium) returns a reply, a `documentType` (null unless choosing or switching) and the fields it learned (null means unchanged). The prompt lists the catalog; for an unsupported document the model explains and suggests the closest one. When the document changes, the backend carries the parties and carried fields (effective date, governing law, courts) over by key and asks the model again with the new document's schema, then returns the new `documentType`. The backend validates fields per kind and returns only the ones that changed. An unknown document or bad form gives 422, a missing key 503, an LLM failure 502, and a signed-out request 401. Tests swap the model through the `get_chat_model` dependency.
- **Frontend** (`frontend/`): Next.js with Tailwind and vitest (`npm test`). Route groups: `app/(marketing)` (`/`, the landing page), `app/(auth)` (`/signin/`, `/signup/`, behind `GuestGate`) and `app/(app)` (`/documents/`, `/editor/`, behind `AuthGate` with `AppHeader`). Shared UI is in `components/ui/` (Button, Field, Alert, Spinner, Logo).
  - Accounts: `lib/auth/AuthProvider.tsx` asks `GET /api/auth/me` who is signed in and signs users up, in and out; every API call goes through `lib/api.ts` (credentials included), where a 401 means the session ended and the user is sent to `/signin/`. `AuthForm` validates with `lib/auth/validate.ts`.
  - `/documents/` is My documents (`DocumentsDashboard`): continue, download the PDF (`lib/documents/pdf.tsx`) or delete each saved document.
  - `/editor/` is the editor (`EditorScreen` around `DocumentCreator`); `/editor/?id=N` reopens a saved document, since the site is static. It has an AI chat (`components/ChatPanel.tsx`), a live preview (a list of the documents until one is chosen) and a PDF download via `@react-pdf/renderer`. `DocumentCreator` holds the chat and the draft (`{doc, form}` or null), `lib/chat/client.ts` calls the API, and `lib/documents/chat.ts` applies the reply (starting afresh on a document switch) and restores saved drafts (`restoreDraft`). After every reply `lib/documents/autosave.ts` saves the draft and the conversation (`lib/documents/saved.ts`); the first save puts the id in the URL without reloading the editor. `lib/documents/registry.ts` reads `documents.json` and `catalog.json`; `coverPage.ts` builds the NDA's cover page from its template and a generated Key Terms page for the other 10, each with the "DRAFT - SUBJECT TO LEGAL REVIEW" notice (`DRAFT_NOTICE`) under the title; `parse.ts` parses the nested numbered Standard Terms, which `terms.ts` loads per document on demand. Blank dates follow today. The legal text comes from `templates/`.

Not yet implemented:
- Persistent storage: the database is recreated on every start, by design for now.
- Password reset, email verification and rate limiting of sign-in.
