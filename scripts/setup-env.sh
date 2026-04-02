#!/usr/bin/env bash
# Copies .env.example → .env for all apps (skips if .env already exists)

set -e

APPS=("apps/api" "apps/web" "apps/mobile")
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for app in "${APPS[@]}"; do
  src="$ROOT/$app/.env.example"
  dest="$ROOT/$app/.env"

  if [ ! -f "$src" ]; then
    echo "⚠️  No .env.example found in $app — skipping"
    continue
  fi

  if [ -f "$dest" ]; then
    echo "✓  $app/.env already exists — skipping (delete it to reset)"
  else
    cp "$src" "$dest"
    echo "✓  Created $app/.env from .env.example"
  fi
done

echo ""
echo "Done. Fill in the secret values in each app/.env before starting the servers."
echo "  Required secrets: CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET, STRIPE_SECRET_KEY,"
echo "  STRIPE_WEBHOOK_SECRET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
