# Prelegal

A platform for drafting common legal agreements from standard templates.

A FastAPI backend serves a statically exported Next.js frontend, in one Docker container. The
user chats with an AI assistant, which works out which of the 11 Common Paper agreements in
`templates/` they need (KAN-8), then fills in the document as they answer (KAN-7). Asked for
a document it can't draft, it says so and suggests the closest one it can. Users sign up and
sign in, and every document they draft is saved as they go, so they can come back to it, carry
on, download it again or delete it (KAN-9). Each document carries a notice that it is a draft
subject to legal review.

## Running it

Requires Docker with Docker Compose 2.24 or newer. Put `OPENROUTER_API_KEY` in a `.env` file in the
project root. Without it the app runs, but the AI chat answers that it isn't configured.

| | Start | Stop |
|---|---|---|
| macOS | `scripts/start-mac.sh` | `scripts/stop-mac.sh` |
| Linux | `scripts/start-linux.sh` | `scripts/stop-linux.sh` |
| Windows | `.\scripts\start-windows.ps1` | `.\scripts\stop-windows.ps1` |

The app is then at http://localhost:8000. The SQLite database lives inside the container,
so it is created from scratch every time the app starts: accounts and saved documents last only
until the next restart, which also signs everyone out.

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
| `/` | Landing page |
| `/signup/`, `/signin/` | Create an account, sign in |
| `/documents/` | My documents: the user's saved documents |
| `/editor/` | Document editor (AI chat and live preview); `/editor/?id=N` reopens saved document N |
| `/api/health` | Health check: `{"status": "ok", "db": "ok"}`, or 503 if the database is unavailable |
| `/api/auth/signup` | `POST {name, email, password}` creates an account and signs in (201, with the session cookie); 409 if the email is taken, 422 for invalid input |
| `/api/auth/signin` | `POST {email, password}` signs in; 401 "Incorrect email or password." |
| `/api/auth/signout` | `POST` ends the session (204) |
| `/api/auth/me` | `GET` the signed-in user `{id, name, email}`, or 401 |
| `/api/documents` | The user's saved documents: `GET` lists them (newest first), `POST {documentType, form, messages}` saves a new one; `GET`, `PUT` and `DELETE /api/documents/{id}` read, replace and delete one. Other users' documents are 404, and a form that doesn't fit its document is 422 |
| `/api/chat` | `POST {messages, documentType, form, today}` returns `{reply, documentType, updates}`: the assistant's next message, the document if it changed, and the fields it filled in. 422 for an unknown document or a form that doesn't fit it, 503 without an API key, 502 if the AI call fails |

Everything under `/api/` except health and the sign-up, sign-in and sign-out calls needs a signed-in
user (401 otherwise).

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
`OPENROUTER_API_KEY` from the root `.env`. Sessions last 7 days, in an HttpOnly, SameSite=Lax
cookie; set `COOKIE_SECURE=true` when the app is served over HTTPS so the cookie is only sent
over HTTPS (it is off by default, since the Docker app is plain HTTP).

To use the chat from `next dev`, let the frontend call the backend across origins: start the
backend with `CORS_ORIGINS=http://localhost:3000`, and the frontend with
`NEXT_PUBLIC_API_BASE=http://localhost:8000`. The frontend sends its requests with credentials and
the backend allows them from those origins, so the session cookie works across the two ports.

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

- Passwords are stored as scrypt hashes and sessions as SHA-256 hashes of their tokens. The pages
  themselves are public static files that check the session in the browser; the API enforces it
  for every piece of data.
- Generated documents are drafts and are not legal advice; each one says so under its title.
- Templates in `templates/` are Common Paper standard agreements, used under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See
  [templates/README.md](templates/README.md).
