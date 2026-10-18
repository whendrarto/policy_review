# Prelegal

A platform for drafting common legal agreements from standard templates.

A FastAPI backend serves a statically exported Next.js frontend, in one Docker container. The
user chats with an AI assistant, which works out which of the 11 Common Paper agreements in
`templates/` they need (KAN-8), then fills in the document as they answer (KAN-7). Asked for
a document it can't draft, it says so and suggests the closest one it can. Sign-in is a
placeholder for now: any name and email bring the user into the platform.

## Running it

Requires Docker with Docker Compose 2.24 or newer. Put `OPENROUTER_API_KEY` in a `.env` file in the
project root. Without it the app runs, but the AI chat answers that it isn't configured.

| | Start | Stop |
|---|---|---|
| macOS | `scripts/start-mac.sh` | `scripts/stop-mac.sh` |
| Linux | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows | `.\scripts\start-windows.ps1` | `.\scripts\stop-windows.ps1` |

The app is then at http://localhost:8000. The SQLite database lives inside the container,
so it is created from scratch every time the app starts.

## Project structure

```
backend/     FastAPI app (uv project): the API, the database and the static frontend
frontend/    Next.js app, exported as static files to frontend/out
templates/   Legal agreement templates (Common Paper, CC BY 4.0), indexed in catalog.json,
             with each document's fillable fields in documents.json
scripts/     Start/stop scripts, plus build_catalog.py for templates/catalog.json
```

| Path | |
|---|---|
| `/` | Sign-in page |
| `/documents/` | Document creator (AI chat and live preview) |
| `/api/health` | Health check: `{"status": "ok", "db": "ok"}`, or 503 if the database is unavailable |
| `/api/chat` | `POST {messages, documentType, form, today}` returns `{reply, documentType, updates}`: the assistant's next message, the document if it changed, and the fields it filled in. 422 for an unknown document or a form that doesn't fit it, 503 without an API key, 502 if the AI call fails |

## Development

Backend (http://localhost:8000):

```bash
cd backend
uv sync
uv run pytest
STATIC_DIR=../frontend/out uv run uvicorn app.main:create_app --factory --reload
```

`STATIC_DIR` is optional; without it only the API is served. The database defaults to
`backend/data/prelegal.db` (set `DATABASE_PATH` to change it), and the documents are read from
the repository's `templates/` (set `TEMPLATES_DIR` to change it). The backend reads
`OPENROUTER_API_KEY` from the root `.env`.

To use the chat from `next dev`, let the frontend call the backend across origins: start the
backend with `CORS_ORIGINS=http://localhost:3000`, and the frontend with
`NEXT_PUBLIC_API_BASE=http://localhost:8000`.

Frontend (http://localhost:3000, see [frontend/README.md](frontend/README.md)):

```bash
cd frontend
npm install
npm run dev
npm test
npm run lint
npm run build   # static site in frontend/out
```

## Notes

- The sign-in is not authentication. The name and email are kept in the browser tab's
  `sessionStorage`, and the pages are public static files. The `users` table is created
  but not used yet.
- Templates in `templates/` are Common Paper standard agreements, used under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See
  [templates/README.md](templates/README.md).
