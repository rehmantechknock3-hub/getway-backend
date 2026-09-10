#!/bin/sh
# Xcode Cloud hook, run right after it clones the repo and before any build/archive action.
#
# Xcode Cloud only knows about apps/mobile/ios/Marketplace.xcworkspace, but this is a pnpm
# monorepo — the mobile app imports shared workspace packages (@repo/schemas etc.) that need
# node_modules installed and @repo/schemas built first, same as render.yaml / apps/api/Dockerfile /
# apps/web/Dockerfile already do for the other two apps.
set -e

REPO_ROOT="${CI_WORKSPACE:-$(cd "$(dirname "$0")/../../.." && pwd)}"
cd "$REPO_ROOT"

echo "Repo root: $REPO_ROOT"
echo "Node: $(node --version 2>&1 || echo 'not found')"

echo "Enabling corepack + pnpm 9.15.0..."
corepack enable
corepack prepare pnpm@9.15.0 --activate

echo "Installing workspace dependencies..."
pnpm install --frozen-lockfile

echo "Building @repo/schemas (apps/mobile imports its compiled dist)..."
pnpm --filter @repo/schemas build

echo "ci_post_clone.sh done."
