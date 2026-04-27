#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="deploy@inter"
REMOTE_DIR="/home/deploy/interface"

echo "==> Deploying to $SSH_HOST..."

ssh -i ~/.ssh/interface_deploy_key "$SSH_HOST" bash << EOF
  set -euo pipefail
  cd "$REMOTE_DIR"

  echo "==> Pulling latest code..."
  git pull origin main

  echo "==> Building images..."
  docker compose -f docker-compose.prod.yml build

  echo "==> Running database migrations..."
  docker compose -f docker-compose.prod.yml run --rm api node apps/api/dist/db/migrate.js

  echo "==> Restarting services..."
  docker compose -f docker-compose.prod.yml up -d

  echo "==> Removing dangling images..."
  docker image prune -f

  echo "==> Done."
  docker compose -f docker-compose.prod.yml ps
EOF
