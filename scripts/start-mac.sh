#!/usr/bin/env bash
# Build and start Prelegal in Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d --build
echo "Prelegal is running at http://localhost:8000"
