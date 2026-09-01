import path from 'path'
import { fileURLToPath } from 'url'

import { runner } from 'node-pg-migrate'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Runs pending node-pg-migrate migrations (the `migrations/` dir next to src).
export async function runMigrations(databaseUrl: string): Promise<void> {
  await runner({
    databaseUrl,
    dir: path.resolve(dirname, '../../migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    // Backend tables + the migration bookkeeping live in `dashboard`, away from
    // Payload's `public` schema (which Payload would otherwise try to drop).
    schema: 'dashboard',
    count: Infinity,
    // Multiple app instances (or test files) may run migrations concurrently;
    // block on the advisory lock instead of failing, then no-op once applied.
    advisoryLockMode: 'wait',
    log: () => undefined,
  })
}
