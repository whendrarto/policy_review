#!/usr/bin/env bash
# Stop Prelegal. The database is discarded with the container.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down
