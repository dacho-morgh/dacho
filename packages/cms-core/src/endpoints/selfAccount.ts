import crypto from 'node:crypto'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { commitTransaction, initTransaction, type Endpoint, type PayloadRequest } from 'payload'

import { isActiveAccount } from '@cms-core/access/roles'
import { IRANIAN_MOBILE_RE, normalizeDigits } from '@cms-core/auth/self-signup'

/**
 * T58 (#220, slice S4 #242): every person edits their own name, mobile and
 * email, and changes their own password with the current one. The target is
 * always the session's user, never an id from the request. Role, position,
 * assignment and identity fields are not accepted here.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
export const MIN_PASSWORD_LENGTH = 8
export const ACCOUNT_UPDATE_TITLE = 'ویرایش اطلاعات کاربری'
export const PASSWORD_CHANGE_TITLE = 'تغییر رمز عبور'
const FIELD_LABELS = { name: 'نام', phone: 'شماره همراه', email: 'ایمیل' } as const

type AccountField = keyof typeof FIELD_LABELS
type SessionUser = { id: number | string; isActive?: boolean | null; backendService?: boolean | null; _sid?: string }

const json = (body: unknown, status = 200) => Response.json(body, { status })

function sessionUser(req: PayloadRequest): SessionUser | null {
  const user = req.user as SessionUser | null
  if (!user || !isActiveAccount(user) || user.backendService) return null
  return user
}

async function readBody(req: PayloadRequest): Promise<Record<string, unknown> | null> {
  const body = await req.json?.().catch(() => null)
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
}

/** Runs `work` on one transaction and returns its response; any throw rolls back. */
async function inTransaction(
  req: PayloadRequest,
  work: (db: PostgresAdapter['drizzle']) => Promise<{ response: Response; commit: boolean }>,
): Promise<Response> {
  await initTransaction(req)
  const transactionID = await req.transactionID
  // Never fall back to the pool: the row lock and Payload hooks must share a session.
  const db = transactionID == null ? undefined : (req.payload.db as unknown as PostgresAdapter).sessions[transactionID]?.db
  if (transactionID == null || !db) throw new Error('Account commands require a database transaction.')
  try {
    const { response, commit } = await work(db as PostgresAdapter['drizzle'])
    if (commit) await commitTransaction(req)
    else {
      await req.payload.db.rollbackTransaction(transactionID)
      delete req.transactionID
    }
    return response
  } catch (error) {
    if (req.transactionID != null) {
      await req.payload.db.rollbackTransaction(await req.transactionID)
      delete req.transactionID
    }
    throw error
  }
}

/** Payload's local strategy hash (pbkdf2, 25000 rounds, 512 bytes, sha256). */
function passwordMatches(password: string, salt: unknown, hash: unknown): Promise<boolean> {
  if (typeof salt !== 'string' || typeof hash !== 'string') return Promise.resolve(false)
  return new Promise((resolve) => {
    crypto.pbkdf2(password, salt, 25000, 512, 'sha256', (error, derived) => {
      const stored = Buffer.from(hash, 'hex')
      resolve(!error && derived.length === stored.length && crypto.timingSafeEqual(derived, stored))
    })
  })
}

/** Records the change in the person's dashboard history when the backend schema exists. */
async function recordHistory(db: PostgresAdapter['drizzle'], userId: string, title: string, description: string | null) {
  const tables = await db.execute(sql`SELECT to_regclass('dashboard.activities') AS activities`)
  if (!tables.rows[0]?.activities) return
  await db.execute(sql`
    INSERT INTO dashboard.activities (owner_id, type, title, description, actor_id)
    VALUES (${userId}, 'account', ${title}, ${description}, ${userId})
  `)
}

/** `PATCH /api/users/me/account` — `{ name?, phone?, email?, expectedUpdatedAt }`. */
export const updateOwnAccount: Endpoint = {
  path: '/me/account',
  method: 'patch',
  handler: async (req) => {
    const user = sessionUser(req)
    if (!user) return json({ error: 'unauthorized' }, 401)
    const body = await readBody(req)
    if (!body || typeof body.expectedUpdatedAt !== 'string' || !ISO_TIMESTAMP_RE.test(body.expectedUpdatedAt))
      return json({ error: 'invalid_account' }, 400)

    const data: Partial<Record<AccountField, string | null>> = {}
    const errors: { field: AccountField; code: string }[] = []
    for (const field of Object.keys(FIELD_LABELS) as AccountField[]) {
      if (!(field in body)) continue
      const raw = body[field]
      if (field === 'email' && (raw === null || raw === '')) {
        data.email = null
        continue
      }
      if (typeof raw !== 'string') {
        errors.push({ field, code: 'invalid' })
        continue
      }
      const value = field === 'phone' ? normalizeDigits(raw.trim()) : field === 'email' ? raw.trim().toLowerCase() : raw.trim()
      if (field === 'name' && (value === '' || value.length > 120)) errors.push({ field, code: 'invalid' })
      else if (field === 'phone' && !IRANIAN_MOBILE_RE.test(value)) errors.push({ field, code: 'invalid' })
      else if (field === 'email' && !EMAIL_RE.test(value)) errors.push({ field, code: 'invalid' })
      else data[field] = value
    }
    if (errors.length > 0) return json({ error: 'invalid_account', errors }, 400)

    const id = Number(user.id)
    return inTransaction(req, async (db) => {
      const locked = await db.execute(sql`
        SELECT id, name, phone, email, updated_at FROM public.users WHERE id = ${id} FOR UPDATE
      `)
      const current = locked.rows[0] as
        | { name: string | null; phone: string; email: string | null; updated_at: string | Date }
        | undefined
      if (!current) return { response: json({ error: 'unauthorized' }, 401), commit: false }
      if (new Date(current.updated_at).toISOString() !== body.expectedUpdatedAt)
        return { response: json({ error: 'stale_account' }, 409), commit: false }

      const changed = (Object.keys(data) as AccountField[]).filter((field) => (current[field] ?? null) !== data[field])
      if (data.phone && changed.includes('phone')) {
        const taken = await db.execute(sql`
          SELECT 1 FROM public.users WHERE (phone = ${data.phone} OR username = ${data.phone}) AND id <> ${id} LIMIT 1
        `)
        if (taken.rows.length > 0) errors.push({ field: 'phone', code: 'taken' })
      }
      if (data.email && changed.includes('email')) {
        const taken = await db.execute(sql`
          SELECT 1 FROM public.users WHERE lower(email) = ${data.email} AND id <> ${id} LIMIT 1
        `)
        if (taken.rows.length > 0) errors.push({ field: 'email', code: 'taken' })
      }
      if (errors.length > 0) return { response: json({ error: 'account_conflict', errors }, 409), commit: false }

      if (changed.length > 0) {
        await req.payload.update({
          collection: 'users',
          id,
          data: Object.fromEntries(changed.map((field) => [field, data[field]])),
          overrideAccess: false,
          depth: 0,
          req,
        })
        // Payload uses wall time; keep the CAS token moving even within one millisecond.
        await db.execute(sql`
          UPDATE public.users
          SET updated_at = GREATEST(updated_at, ${body.expectedUpdatedAt}::timestamptz + interval '1 millisecond')
          WHERE id = ${id}
        `)
        await recordHistory(
          db, String(id), ACCOUNT_UPDATE_TITLE,
          changed.map((field) => FIELD_LABELS[field]).join('، '),
        )
      }
      const saved = await db.execute(sql`SELECT name, phone, email, updated_at FROM public.users WHERE id = ${id}`)
      const row = saved.rows[0] as { name: string | null; phone: string; email: string | null; updated_at: string | Date }
      return {
        response: json({
          doc: { id, name: row.name ?? '', phone: row.phone, email: row.email ?? '', updatedAt: new Date(row.updated_at).toISOString() },
        }),
        commit: true,
      }
    })
  },
}

/**
 * `POST /api/users/me/password` — `{ currentPassword, newPassword }`.
 * Policy: the session that changed the password stays signed in; every other
 * Payload session of the person is revoked. Backend-issued OTP tokens are
 * stateless and expire on their own TTL.
 */
export const changeOwnPassword: Endpoint = {
  path: '/me/password',
  method: 'post',
  handler: async (req) => {
    const user = sessionUser(req)
    if (!user) return json({ error: 'unauthorized' }, 401)
    const body = await readBody(req)
    if (!body || typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string')
      return json({ error: 'invalid_password_change' }, 400)
    const { currentPassword, newPassword } = body as { currentPassword: string; newPassword: string }
    if (newPassword.length < MIN_PASSWORD_LENGTH)
      return json({ error: 'weak_password', errors: [{ field: 'newPassword', code: 'too_short' }] }, 400)
    if (newPassword === currentPassword)
      return json({ error: 'same_password', errors: [{ field: 'newPassword', code: 'same' }] }, 400)

    const id = Number(user.id)
    return inTransaction(req, async (db) => {
      const locked = await db.execute(sql`SELECT salt, hash FROM public.users WHERE id = ${id} FOR UPDATE`)
      const current = locked.rows[0] as { salt: unknown; hash: unknown } | undefined
      if (!current || !(await passwordMatches(currentPassword, current.salt, current.hash)))
        return {
          response: json({ error: 'invalid_current_password', errors: [{ field: 'currentPassword', code: 'invalid' }] }, 403),
          commit: false,
        }
      await req.payload.update({
        collection: 'users',
        id,
        data: { password: newPassword },
        overrideAccess: false,
        depth: 0,
        req,
      })
      const sessions = await db.execute(sql`SELECT to_regclass('public.users_sessions') AS sessions`)
      if (sessions.rows[0]?.sessions) {
        if (user._sid) await db.execute(sql`DELETE FROM public.users_sessions WHERE _parent_id = ${id} AND id <> ${user._sid}`)
        else await db.execute(sql`DELETE FROM public.users_sessions WHERE _parent_id = ${id}`)
      }
      await recordHistory(db, String(id), PASSWORD_CHANGE_TITLE, null)
      return { response: new Response(null, { status: 204 }), commit: true }
    })
  },
}
