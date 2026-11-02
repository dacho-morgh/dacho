import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { collectMigrationReconciliation } from '../src/db/migration-reconciliation.js'

describe('read-only migration reconciliation', () => {
  it('reports pending human decisions from one read-only snapshot', async () => {
    const queries: string[] = []
    const client = { async query(sql: string) {
      queries.push(sql)
      if (sql.includes("'mapped_role'")) return { rows: [
        { key: 'mapped_role', count: 3 },
        { key: 'review_legacy_admin', count: 2 },
        { key: 'review_no_role', count: 1 },
      ] }
      if (sql.includes("'company_linked'")) return { rows: [
        { key: 'company_linked', count: 4 },
        { key: 'review_unknown_owner', count: 5 },
      ] }
      if (sql.includes('operational_role::text')) return { rows: [{ key: 'representative', count: 3 }] }
      return { rows: [{}] }
    } }
    const report = await collectMigrationReconciliation(client as unknown as Client)
    expect(queries[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    expect(queries.at(-1)).toBe('COMMIT')
    expect(queries.every((sql) => !/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i.test(sql))).toBe(true)
    expect(report.pending).toEqual({ accounts: 3, requests: 5, systemOwnerMissing: true })
  })

  it('stops reporting a missing owner only when an active one exists', async () => {
    const client = { async query(sql: string) {
      if (sql.includes('operational_role::text')) return { rows: [{ key: 'system-owner', count: 1 }] }
      return { rows: [{}] }
    } }
    const report = await collectMigrationReconciliation(client as unknown as Client)
    expect(report.pending.systemOwnerMissing).toBe(false)
  })

  it('rolls back and rejects rather than publishing a partial report', async () => {
    const queries: string[] = []
    const failure = new Error('permission denied')
    const client = { async query(sql: string) {
      queries.push(sql)
      if (sql.includes('dashboard.requests')) throw failure
      return { rows: [] }
    } }
    await expect(collectMigrationReconciliation(client as unknown as Client)).rejects.toBe(failure)
    expect(queries.at(-1)).toBe('ROLLBACK')
    expect(queries).not.toContain('COMMIT')
  })
})
