# Prelegal

A platform for drafting common legal agreements from standard templates.

The V1 foundation (KAN-6) packages the Mutual NDA creator prototype as a FastAPI backend
serving a statically exported Next.js frontend, in one Docker container. Sign-in is a
placeholder for now: any name and email bring the user into the platform.

## Running it

Requires Docker with Docker Compose 2.24 or newer. Put `OPENROUTER_API_KEY` in a `.env` file in the
project root (it is optional until the AI features arrive).

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
| `/nda/` | Mutual NDA creator |
| `/api/health` | Health check: `{"status": "ok", "db": "ok"}`, or 503 if the database is unavailable |

## Development

Backend (http://localhost:8000):

```bash
cd backend
uv sync
uv run pytest
STATIC_DIR=../frontend/out uv run uvicorn app.main:create_app --factory --reload
```

`STATIC_DIR` is optional; without it only the API is served. The database defaults to
`backend/data/prelegal.db` (set `DATABASE_PATH` to change it).

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
