#!/bin/sh
set -e

echo "Running database migrations..."
pnpm payload migrate || echo "Migration skipped (already applied or no changes)"

echo "Starting application..."
exec node server.js
