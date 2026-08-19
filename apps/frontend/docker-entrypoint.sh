#!/bin/sh
set -e

echo "Running database migrations..."
pnpm --filter @dacho/frontend payload migrate || echo "Migration skipped (already applied or no changes)"

echo "Starting application..."
cd /repo/standalone
exec node server.js
