import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { createApp } from '../../src/app.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { InMemoryExhibitionStore } from '../../src/exhibitions/exhibition-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'booth-catalogue-integration' })

const PROXY_SECRET = 'booth-catalogue-proxy-secret'
const OWNER = 'owner-1'
const EXHIBITION = 'exhibition-1'

const ownerHeaders = {
  'x-internal-proxy-secret': PROXY_SECRET,
  'x-user-id': OWNER,
  'x-user-roles': 'admin',
}

const boothBody = (overrides: Record<string, unknown> = {}) => ({
  identifier: 'A-1',
  specification: '۳ متر × ۳ متر',
  location: 'سالن اصلی',
  status: 'available',
  active: true,
  priceAmount: 10_000_000,
  priceUnit: 'toman',
  ...overrides,
})

async function createAppUnderTest() {
  const jwt = await JwtSigner.create('test-kid')
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt,
    userStore: new InMemoryUserStore([
      { id: OWNER, phone: '09120000001', operationalRole: 'system-owner', roles: ['admin'], isActive: true },
    ]),
    companyStore: new InMemoryCompanyStore(),
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: PROXY_SECRET,
    exhibitionStore: new InMemoryExhibitionStore([EXHIBITION]),
  })
}

describe('booth catalogue Postgres repository', () => {
  let app: Awaited<ReturnType<typeof createAppUnderTest>>

  beforeAll(async () => {
    await runMigrations(connectionString)
    app = await createAppUnderTest()
  })

  beforeEach(async () => {
    await pool.query('UPDATE dashboard.exhibition_booths SET price_version_id = NULL')
    await pool.query('DELETE FROM dashboard.booth_price_versions')
    await pool.query('DELETE FROM dashboard.exhibition_booths')
    await pool.query('DELETE FROM dashboard.exhibition_catalogue_settings')
  })

  afterAll(async () => {
    await pool.end()
  })

  it('keeps a captured price version unchanged after the catalogue price is edited', async () => {
    const created = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(ownerHeaders)
      .send(boothBody({ priceAmount: 10_000_000 }))
      .expect(201)

    const boothId = created.body.booth.id as string
    const capturedVersionId = created.body.booth.priceVersionId as string

    const edited = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/${boothId}`)
      .set(ownerHeaders)
      .send({ priceAmount: 12_000_000, priceUnit: 'toman' })
      .expect(200)

    expect(edited.body.booth.priceAmount).toBe(12_000_000)
    expect(edited.body.booth.priceVersionId).not.toBe(capturedVersionId)

    const captured = await pool.query<{
      identifier: string
      price_amount: string
      price_unit: string
    }>(
      `SELECT identifier, price_amount::text AS price_amount, price_unit
       FROM dashboard.booth_price_versions
       WHERE id = $1`,
      [capturedVersionId],
    )
    expect(captured.rows[0]).toEqual({
      identifier: 'A-1',
      price_amount: '10000000',
      price_unit: 'toman',
    })

    const current = await pool.query<{
      price_amount: string
      price_unit: string
      price_version_id: string
    }>(
      `SELECT price_amount::text AS price_amount, price_unit, price_version_id
       FROM dashboard.exhibition_booths
       WHERE id = $1`,
      [boothId],
    )
    expect(current.rows[0]).toEqual({
      price_amount: '12000000',
      price_unit: 'toman',
      price_version_id: edited.body.booth.priceVersionId,
    })

    const versions = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM dashboard.booth_price_versions
       WHERE booth_id = $1`,
      [boothId],
    )
    expect(versions.rows[0]?.count).toBe('2')
  })

  it('rolls back a duplicate rename and price change atomically', async () => {
    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(ownerHeaders)
      .send(boothBody({ identifier: 'A-1', priceAmount: 10_000_000 }))
      .expect(201)

    const created = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(ownerHeaders)
      .send(boothBody({ identifier: 'B-2', priceAmount: 20_000_000 }))
      .expect(201)

    const boothId = created.body.booth.id as string
    const originalVersionId = created.body.booth.priceVersionId as string

    const failed = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/${boothId}`)
      .set(ownerHeaders)
      .send({ identifier: 'a-1', priceAmount: 99_000_000, priceUnit: 'toman' })

    expect(failed.status).toBe(409)
    expect(failed.body.error).toBe('duplicate_identifier')

    const booth = await pool.query<{
      identifier: string
      price_amount: string
      price_version_id: string
    }>(
      `SELECT identifier, price_amount::text AS price_amount, price_version_id
       FROM dashboard.exhibition_booths
       WHERE id = $1`,
      [boothId],
    )
    expect(booth.rows[0]).toEqual({
      identifier: 'B-2',
      price_amount: '20000000',
      price_version_id: originalVersionId,
    })

    const versions = await pool.query<{ price_amount: string }>(
      `SELECT price_amount::text AS price_amount
       FROM dashboard.booth_price_versions
       WHERE booth_id = $1
       ORDER BY created_at`,
      [boothId],
    )
    expect(versions.rows).toEqual([{ price_amount: '20000000' }])
  })
})
