import { Client } from 'pg'
import { collectMigrationReconciliation } from './migration-reconciliation.js'

if (!process.env.DATABASE_URL || process.env.RECONCILIATION_ACK !== 'read-only-reconciliation') {
  console.error('DATABASE_URL and RECONCILIATION_ACK=read-only-reconciliation are required; use a sanitized disposable copy and a least-privilege read-only account.')
  process.exitCode = 1
} else {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 })
  try {
    await client.connect()
    console.log(JSON.stringify(await collectMigrationReconciliation(client), null, 2))
  } catch {
    console.error('Reconciliation failed; no complete report produced. Check that both migration streams are applied and the account can read them.')
    process.exitCode = 1
  } finally {
    await client.end()
  }
}
