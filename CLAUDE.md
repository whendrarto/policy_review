# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports only the Mutual NDA, filled in via AI chat, behind a fake login. See "Implementation status" below.

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

Done (KAN-5, KAN-6, KAN-7):
- **Docker**: a multi-stage `Dockerfile` builds the Next.js frontend as a static export (`frontend/out`), which FastAPI serves at `/`. `docker-compose.yml` runs it on port 8000 and loads `.env`. The start/stop scripts in `scripts/` wrap `docker compose`.
- **Backend** (`backend/app/`): FastAPI app factory (`main.py:create_app`) with `GET /api/health` and `POST /api/chat`. `db.py` deletes and recreates the SQLite database (`users` table) on every startup. Config (`config.py`) comes from env vars `DATABASE_PATH`, `STATIC_DIR`, `OPENROUTER_API_KEY` and `CORS_ORIGINS`; local runs also load the root `.env`. Tests use pytest (`uv run pytest`).
- **AI chat** (`backend/app/chat.py`): stateless. Each request sends the chat history, the current NDA and today's date. The model (LiteLLM, OpenRouter, Cerebras, Structured Outputs) returns a reply plus the fields it learned (null means unchanged). The backend validates those fields and returns only the ones that changed. A missing key gives 503 and an LLM failure gives 502. Tests swap the model through the `get_chat_model` dependency.
- **Frontend** (`frontend/`): Next.js with Tailwind and vitest (`npm test`).
  - `/` is the login page. The login is fake: name and email are stored in sessionStorage (`lib/auth/session.ts`), and no backend call is made. `AuthGate` redirects users who aren't signed in back to `/`.
  - `/nda` is the Mutual NDA creator: an AI chat (`components/ChatPanel.tsx`, a generic chat UI), a live preview, and a PDF download via `@react-pdf/renderer`. `NdaCreator` holds the chat and the form state, `lib/chat/client.ts` calls the API, and `lib/nda/chat.ts` merges the AI's updates into the form. The conversation is kept in memory only. The legal text comes from `templates/`.

Not yet implemented:
- The other 10 document types.
- Real sign up and sign in (`users.password_hash` is unused; there are no auth API endpoints).
- Saving documents.
