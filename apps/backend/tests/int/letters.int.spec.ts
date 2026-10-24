import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { createApp } from '../../src/app.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { runMigrations } from '../../src/db/migrate.js'

// Slice 4 — backend letters entity + endpoints. Letters have no create endpoint
// (they are engine/system-generated), so the test seeds rows directly and drives
// the read paths (list + detail-with-read-marking) through the public HTTP API.

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString })

const PROXY_SECRET = 'test-internal-proxy-secret'
const OWNER = 'user-1'
const OTHER = 'user-2'

interface LetterFixture {
  type?: string
  title?: string
  body?: string
  senderName?: string | null
  senderRole?: string | null
  recipientId?: string
  read?: boolean
}

async function insertLetter(fixture: LetterFixture = {}): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO dashboard.letters (type, title, body, sender_id, sender_name, sender_role, recipient_id, read)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7)
     RETURNING id`,
    [
      fixture.type ?? 'official',
      fixture.title ?? 'نامه',
      fixture.body ?? 'متن نامه',
      fixture.senderName ?? null,
      fixture.senderRole ?? null,
      fixture.recipientId ?? OWNER,
      fixture.read ?? false,
    ],
  )
  return rows[0]!.id
}

function authHeaders(userId: string) {
  return { 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': userId }
}

async function createAppUnderTest() {
  const jwt = await JwtSigner.create('test-kid')
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt,
    userStore: new InMemoryUserStore([
      ...['user-1', 'user-2', 'company-1', 'company-2'].map((id) => ({ id, phone: id, roles: ['representative' as const], isActive: true })),
      { id: 'staff-1', phone: 'staff-1', roles: ['admin'], isActive: true },
    ]),
    companyStore: new InMemoryCompanyStore(),
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: PROXY_SECRET,
  })
}

describe('letters API', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.letters')
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('list', () => {
    it('returns only the owner letters, paginated', async () => {
      const app = await createAppUnderTest()
      await insertLetter({ title: 'mine', recipientId: OWNER })
      await insertLetter({ title: 'theirs', recipientId: OTHER })

      const res = await request(app).get('/letters').set(authHeaders(OWNER))
      expect(res.status).toBe(200)
      expect(res.body.total).toBe(1)
      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].title).toBe('mine')
      expect(res.body.page).toBe(1)
      expect(res.body.totalPages).toBe(1)
    })

    it('filters by read status', async () => {
      const app = await createAppUnderTest()
      await insertLetter({ title: 'unread', read: false })
      await insertLetter({ title: 'read', read: true })

      const unread = await request(app).get('/letters?read=false').set(authHeaders(OWNER))
      expect(unread.body.total).toBe(1)
      expect(unread.body.items[0].title).toBe('unread')

      const read = await request(app).get('/letters?read=true').set(authHeaders(OWNER))
      expect(read.body.total).toBe(1)
      expect(read.body.items[0].title).toBe('read')
    })
  })

  describe('detail', () => {
    it('returns the letter and marks it read', async () => {
      const app = await createAppUnderTest()
      const id = await insertLetter({ title: 'باز شود', read: false })

      const res = await request(app).get(`/letters/${id}`).set(authHeaders(OWNER))
      expect(res.status).toBe(200)
      expect(res.body.letter.id).toBe(id)
      expect(res.body.letter.title).toBe('باز شود')
      expect(res.body.letter.read).toBe(true)

      // The read flag persists.
      const after = await request(app).get('/letters?read=false').set(authHeaders(OWNER))
      expect(after.body.total).toBe(0)
    })

    it('returns 404 for another owner letter', async () => {
      const app = await createAppUnderTest()
      const id = await insertLetter({ recipientId: OWNER })

      const res = await request(app).get(`/letters/${id}`).set(authHeaders(OTHER))
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('not_found')
    })

    it('returns 404 for a missing letter', async () => {
      const app = await createAppUnderTest()
      const res = await request(app)
        .get('/letters/00000000-0000-0000-0000-000000000000')
        .set(authHeaders(OWNER))
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('not_found')
    })
  })
})
