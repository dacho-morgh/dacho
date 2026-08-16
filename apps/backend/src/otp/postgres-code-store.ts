import type { Pool } from 'pg'

import type { CodeStore } from './code-store.js'

export interface PostgresCodeStoreOptions {
  now?: () => number
  maxAttempts?: number
}

/** Creates the backend-owned OTP code table (idempotent). */
export async function ensureOtpCodesTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.otp_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    )
  `)
}

/** Postgres-backed OTP codes: single-use, expiring, attempt-limited. */
export class PostgresCodeStore implements CodeStore {
  private readonly now: () => number
  private readonly maxAttempts: number

  constructor(
    private readonly pool: Pool,
    options: PostgresCodeStoreOptions = {},
  ) {
    this.now = options.now ?? Date.now
    this.maxAttempts = options.maxAttempts ?? 5
  }

  async save(phone: string, code: string, ttlSeconds: number): Promise<void> {
    const expiresAt = this.now() + ttlSeconds * 1000
    await this.pool.query(
      `INSERT INTO public.otp_codes (phone, code, expires_at, attempts)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = $3, attempts = 0`,
      [phone, code, expiresAt],
    )
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        'SELECT code, expires_at, attempts FROM public.otp_codes WHERE phone = $1 FOR UPDATE',
        [phone],
      )
      const row = result.rows[0]
      if (!row) {
        await client.query('ROLLBACK')
        return false
      }

      const expired = this.now() > Number(row.expires_at)
      const attempts = Number(row.attempts) + 1
      const tooMany = attempts > this.maxAttempts

      if (expired || tooMany || row.code !== code) {
        if (expired || tooMany) {
          await client.query('DELETE FROM public.otp_codes WHERE phone = $1', [phone])
        } else {
          await client.query('UPDATE public.otp_codes SET attempts = $1 WHERE phone = $2', [attempts, phone])
        }
        await client.query('COMMIT')
        return false
      }

      await client.query('DELETE FROM public.otp_codes WHERE phone = $1', [phone])
      await client.query('COMMIT')
      return true
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
}
