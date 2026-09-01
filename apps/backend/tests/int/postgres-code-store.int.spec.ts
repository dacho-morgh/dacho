import { afterAll, beforeAll } from 'vitest'
import { Pool } from 'pg'

import { ensureOtpCodesTable, PostgresCodeStore } from '../../src/otp/postgres-code-store.js'
import { describeCodeStore } from '../code-store.shared.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString })

beforeAll(async () => {
  await ensureOtpCodesTable(pool)
})

afterAll(async () => {
  await pool.end()
})

describeCodeStore('PostgresCodeStore', (opts) => new PostgresCodeStore(pool, opts), async () => {
  await pool.query('DELETE FROM dashboard.otp_codes')
})
