# Stage 1: build the frontend as a static site. It imports the legal text from templates/,
# so the repository layout (frontend/ next to templates/) is kept.
FROM node:24-slim AS frontend
WORKDIR /repo/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY templates/ /repo/templates/
COPY frontend/ ./
RUN npm run build

# Stage 2: the FastAPI backend, which serves the API and the static site.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.10.8 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock backend/.python-version ./
RUN uv sync --locked --no-dev --no-install-project
COPY backend/app ./app
# The documents the AI chat drafts (catalog.json, documents.json); found at /app/templates by default.
COPY templates/ /app/templates/
COPY --from=frontend /repo/frontend/out /app/static

# The database lives inside the container, so it starts from scratch on every `up`.
ENV PATH="/app/backend/.venv/bin:$PATH" \
    STATIC_DIR=/app/static \
    DATABASE_PATH=/app/data/prelegal.db
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
