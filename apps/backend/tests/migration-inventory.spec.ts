import type { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { collectMigrationInventory } from '../src/db/migration-inventory.js'

describe('read-only migration inventory', () => {
  it('counts only application tables in one read-only snapshot without returning row data', async () => {
    const queries: string[] = []
    const client = {
      async query(sql: string) {
        queries.push(sql)
        if (sql.includes('information_schema.tables')) return { rows: [
          { table_schema: 'public', table_name: 'users' },
          { table_schema: 'dashboard', table_name: 'requests' },
          { table_schema: 'public', table_name: 'odd"name' },
        ] }
        if (sql.startsWith('SELECT count')) return { rows: [{ count: '12' }] }
        return { rows: [] }
      },
    }
    const report = await collectMigrationInventory(client as unknown as Client)
    expect(queries[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    expect(queries.at(-1)).toBe('COMMIT')
    expect(queries).toContain('SELECT count(*)::text AS count FROM "public"."odd""name"')
    expect(report).toEqual({ tables: [
      { schema: 'public', table: 'users', rows: '12' },
      { schema: 'dashboard', table: 'requests', rows: '12' },
      { schema: 'public', table: 'odd"name', rows: '12' },
    ] })
    expect(queries.find(q => q.includes('information_schema.tables'))).toContain("table_schema IN ('public', 'dashboard')")
  })

  it('rolls back and rejects incomplete inventories rather than publishing partial counts', async () => {
    const queries: string[] = []
    const failure = new Error('permission denied')
    const client = { async query(sql: string) {
      queries.push(sql)
      if (sql.includes('information_schema.tables')) throw failure
      return { rows: [] }
    } }
    await expect(collectMigrationInventory(client as unknown as Client)).rejects.toBe(failure)
    expect(queries.at(-1)).toBe('ROLLBACK')
    expect(queries).not.toContain('COMMIT')
  })
})
