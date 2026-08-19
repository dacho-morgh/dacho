#!/bin/sh
set -e

echo "Running database migrations..."
# Feed "n" so a dev-pushed DB (batch=-1) doesn't hang on Payload's interactive
# data-loss prompt; a fresh DB applies migrations without prompting.
echo "n" | pnpm --filter @dacho/frontend payload migrate || echo "Migration skipped (already applied or no changes)"

echo "Starting application..."
cd /repo/apps/frontend
exec pnpm start
