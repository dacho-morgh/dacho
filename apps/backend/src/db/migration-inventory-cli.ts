import { Client } from 'pg'
import { collectMigrationInventory } from './migration-inventory.js'

// Aggregate table counts only; `pnpm reconciliation` reports role and case dispositions.
if (!process.env.DATABASE_URL || process.env.INVENTORY_ACK !== 'read-only-inventory') {
  console.error('DATABASE_URL and INVENTORY_ACK=read-only-inventory are required; use a sanitized disposable copy and a least-privilege read-only account.')
  process.exitCode = 1
} else {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 })
  try {
    await client.connect()
    console.log(JSON.stringify(await collectMigrationInventory(client), null, 2))
  } catch {
    console.error('Inventory failed; no complete report produced. Check database access and schema permissions.')
    process.exitCode = 1
  } finally {
    await client.end()
  }
}
