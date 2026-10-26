import type { Client } from 'pg'

/** Aggregate counts only: no credentials, personal identifiers or row contents. */
export async function collectMigrationInventory(client: Pick<Client, 'query'>) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
    await client.query("SET LOCAL statement_timeout = '30s'")
    const tables = await client.query<{ table_schema: string; table_name: string }>(`
      SELECT table_schema, table_name FROM information_schema.tables
      WHERE table_schema IN ('public', 'dashboard') AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `)
    const inventory = []
    for (const { table_schema: schema, table_name: table } of tables.rows) {
      const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
      const result = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${quote(schema)}.${quote(table)}`,
      )
      inventory.push({ schema, table, rows: result.rows[0]!.count })
    }
    await client.query('COMMIT')
    return { tables: inventory }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}
