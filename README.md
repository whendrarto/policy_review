# Prelegal

A platform for drafting common legal agreements from standard templates.

The V1 foundation (KAN-6) packages the Mutual NDA creator as a FastAPI backend serving a
statically exported Next.js frontend, in one Docker container. The user drafts the NDA by
chatting with an AI assistant (KAN-7), which fills in the document as they answer. Sign-in is a
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
templates/   Legal agreement templates (Common Paper, CC BY 4.0), indexed in catalog.json
scripts/     Start/stop scripts, plus build_catalog.py for templates/catalog.json
```

| Path | |
|---|---|
| `/` | Sign-in page |
| `/nda/` | Mutual NDA creator (AI chat and live preview) |
| `/api/health` | Health check: `{"status": "ok", "db": "ok"}`, or 503 if the database is unavailable |
| `/api/chat` | `POST {messages, form, today}` returns `{reply, updates}`, the assistant's next message and the NDA fields it filled in. 503 without an API key, 502 if the AI call fails |

## Development

Backend (http://localhost:8000):

```bash
cd backend
uv sync
uv run pytest
STATIC_DIR=../frontend/out uv run uvicorn app.main:create_app --factory --reload
```

`STATIC_DIR` is optional; without it only the API is served. The database defaults to
`backend/data/prelegal.db` (set `DATABASE_PATH` to change it). The backend reads
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
