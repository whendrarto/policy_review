# Build and start Prelegal in Docker.
Set-Location (Join-Path $PSScriptRoot "..")
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Prelegal is running at http://localhost:8000"
