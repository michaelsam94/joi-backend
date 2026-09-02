#!/usr/bin/env bash
# Run this ON THE VPS, from inside the joi-backend folder (e.g. /opt/joi-backend).
# Usage: ./deploy.sh
set -euo pipefail

echo "==> Checking for Docker..."
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version &>/dev/null; then
  echo "ERROR: docker compose plugin not found even after install. Aborting." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "==> No .env found — copying from .env.production.example."
  echo "    EDIT .env NOW (JWT_SECRET, POSTGRES_PASSWORD, TELEGRAM_BOT_TOKEN, etc.) then re-run ./deploy.sh"
  cp .env.production.example .env
  exit 1
fi

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Waiting for the backend container to come up..."
sleep 5

echo "==> Applying database schema..."
docker compose exec -T backend node dist/db/migrate.js

echo "==> Seeding first moderator account (no-op if it already exists)..."
docker compose exec -T backend node dist/db/seed.js

echo "==> Done. Backend should be reachable at http://$(curl -s -4 ifconfig.me 2>/dev/null || echo '<your-vps-ip>'):3000"
echo "==> Check logs any time with: docker compose logs -f backend"
