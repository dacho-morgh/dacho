import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { InMemoryPublicRecordStore } from '../../src/exhibitions/exhibition-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { PUBLIC_EVENT_FIELDS } from './public-event-fields.js'

/**
 * S5 (#243, T60): creating an event or exhibition writes its public CMS page and its
 * operational row together. These tests make the second write fail inside Postgres
 * after the CMS write succeeded, and check that neither record is left.
 */

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'owner-event-exhibition-admin-integration' })
const PROXY_SECRET = 'owner-admin-proxy-secret'
const OWNER = 's5-owner'
// Ids the in-memory CMS hands out in this file; far from other specs' rows.
const FIRST_ID = 5_500_001

const USERS: User[] = [
  { id: OWNER, phone: 's5-owner', name: 'Owner', operationalRole: 'system-owner', isActive: true },
  { id: 's5-secretariat', phone: 's5-secretariat', name: 'Secretariat', operationalRole: 'central-secretariat', isActive: true },
  { id: 's5-chief', phone: 's5-chief', name: 'Chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 's5-investment', phone: 's5-investment', name: 'Investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 's5-company', phone: 's5-company', name: 'Company', operationalRole: 'representative', isActive: true },
]

const as = (userId: string) => ({ 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': userId })

const eventBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'رویداد آزمون S5',
  description: 'شرح عمومی',
  registrationOpenAt: '2027-01-01T00:00:00.000Z',
  registrationCloseAt: '2027-02-01T00:00:00.000Z',
  responsibleChiefId: 's5-chief',
  responsibleInvestmentId: 's5-investment',
  ...PUBLIC_EVENT_FIELDS,
  ...overrides,
})

const exhibitionBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'نمایشگاه آزمون S5',
  description: '',
  ...PUBLIC_EVENT_FIELDS,
  companyBoothLimit: 2,
  ...overrides,
})

let cms: InMemoryPublicRecordStore

async function createAppUnderTest() {
  cms = new InMemoryPublicRecordStore({ firstId: FIRST_ID })
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt: await JwtSigner.create('test-kid'),
    userStore: new InMemoryUserStore(USERS),
    companyStore: new InMemoryCompanyStore([
      { name: 'شرکت S5', nationalId: '15500000001', representativeId: 's5-company' },
    ]),
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: PROXY_SECRET,
    exhibitionStore: cms,
    publicRecords: cms,
  })
}

async function cleanUp() {
  await pool.query('DROP TRIGGER IF EXISTS s5_fail_event_link ON dashboard.events')
  await pool.query('DROP TRIGGER IF EXISTS s5_fail_settings ON dashboard.exhibition_catalogue_settings')
  await pool.query('DROP FUNCTION IF EXISTS dashboard.s5_fail_second_write()')
  await pool.query(`DELETE FROM dashboard.event_audit WHERE actor_id = $1`, [OWNER])
  await pool.query(`DELETE FROM dashboard.events WHERE created_by = $1`, [OWNER])
  await pool.query(
    `DELETE FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id ~ '^55[0-9]{5}$'`,
  )
}

/** Makes the operational write that follows the CMS write fail inside Postgres. */
async function failSecondWrite() {
  await pool.query(`CREATE FUNCTION dashboard.s5_fail_second_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 's5 forced failure of the second write'; END $$`)
  await pool.query(`CREATE TRIGGER s5_fail_event_link BEFORE UPDATE OF public_event_id ON dashboard.events
    FOR EACH ROW WHEN (NEW.public_event_id IS NOT NULL) EXECUTE FUNCTION dashboard.s5_fail_second_write()`)
  await pool.query(`CREATE TRIGGER s5_fail_settings BEFORE INSERT ON dashboard.exhibition_catalogue_settings
    FOR EACH ROW EXECUTE FUNCTION dashboard.s5_fail_second_write()`)
}

describe('owner event and exhibition admin (Postgres)', () => {
  let app: Awaited<ReturnType<typeof createAppUnderTest>>

  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await cleanUp()
    app = await createAppUnderTest()
  })

  afterEach(cleanUp)

  afterAll(async () => {
    await pool.end()
  })

  it('creates an event with its public page and links them in one transaction', async () => {
    const created = await request(app).post('/admin/events').set(as(OWNER)).send(eventBody()).expect(201)
    const page = cms.all('events')[0]!
    const { rows } = await pool.query(`SELECT public_event_id FROM dashboard.events WHERE id = $1`, [created.body.event.id])
    expect(rows).toEqual([{ public_event_id: page.id }])

    const forCompany = await request(app).get('/events').set(as('s5-company')).expect(200)
    expect(forCompany.body.items).toContainEqual(expect.objectContaining({ id: created.body.event.id, publicEventId: page.id }))
  })

  it('leaves neither record when the event link fails after the public page was made', async () => {
    await failSecondWrite()
    const response = await request(app).post('/admin/events').set(as(OWNER)).send(eventBody())
    expect(response.status).toBe(500)
    expect(cms.all('events')).toEqual([])
    const { rows } = await pool.query(`SELECT id FROM dashboard.events WHERE created_by = $1`, [OWNER])
    expect(rows).toEqual([])
  })

  it('leaves neither record when the public page cannot be made', async () => {
    cms.failNext.create = true
    await request(app).post('/admin/events').set(as(OWNER)).send(eventBody()).expect(502)
    cms.failNext.create = true
    await request(app).post('/admin/exhibitions').set(as(OWNER)).send(exhibitionBody()).expect(502)
    expect(cms.all('events')).toEqual([])
    expect(cms.all('exhibitions')).toEqual([])
    const { rows } = await pool.query(`SELECT id FROM dashboard.events WHERE created_by = $1`, [OWNER])
    expect(rows).toEqual([])
  })

  it('restores the public page when an event edit fails after it was written', async () => {
    const created = await request(app).post('/admin/events').set(as(OWNER)).send(eventBody()).expect(201)
    // The link is unchanged on an edit, so fail the audit row instead.
    await pool.query(`CREATE FUNCTION dashboard.s5_fail_second_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 's5 forced failure'; END $$`)
    await pool.query(`CREATE TRIGGER s5_fail_event_link BEFORE INSERT ON dashboard.event_audit
      FOR EACH ROW EXECUTE FUNCTION dashboard.s5_fail_second_write()`)
    try {
      await request(app).patch(`/admin/events/${created.body.event.id}`).set(as(OWNER))
        .send({ title: 'عنوان تازه', location: 'عسلویه', revision: 1, reason: 'تغییر' }).expect(500)
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS s5_fail_event_link ON dashboard.event_audit')
    }
    expect(cms.all('events')[0]).toMatchObject({ title: 'رویداد آزمون S5', location: PUBLIC_EVENT_FIELDS.location })
    const { rows } = await pool.query(`SELECT title, revision FROM dashboard.events WHERE id = $1`, [created.body.event.id])
    expect(rows).toEqual([{ title: 'رویداد آزمون S5', revision: 1 }])
  })

  it('creates an exhibition page and its booth settings together', async () => {
    const created = await request(app).post('/admin/exhibitions').set(as(OWNER)).send(exhibitionBody()).expect(201)
    const { rows } = await pool.query(
      `SELECT company_booth_limit, revision FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1`,
      [created.body.exhibition.id],
    )
    expect(rows).toEqual([{ company_booth_limit: '2', revision: 1 }])
  })

  it('removes the new exhibition page when its booth settings cannot be written', async () => {
    await failSecondWrite()
    const response = await request(app).post('/admin/exhibitions').set(as(OWNER)).send(exhibitionBody())
    expect(response.status).toBe(500)
    expect(cms.all('exhibitions')).toEqual([])
    const { rows } = await pool.query(
      `SELECT exhibition_id FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1`,
      [String(FIRST_ID)],
    )
    expect(rows).toEqual([])
  })

  it('versions exhibition edits: a stale form gets 409 and a CMS failure keeps the settings', async () => {
    const created = await request(app).post('/admin/exhibitions').set(as(OWNER)).send(exhibitionBody()).expect(201)
    const id = created.body.exhibition.id as string
    await request(app).patch(`/admin/exhibitions/${id}`).set(as(OWNER)).send({ companyBoothLimit: 3, revision: 1 }).expect(200)

    // Two forms opened at revision 2: the first save wins, the second is stale.
    const [first, second] = await Promise.all([
      request(app).patch(`/admin/exhibitions/${id}`).set(as(OWNER)).send({ companyBoothLimit: 4, revision: 2 }),
      request(app).patch(`/admin/exhibitions/${id}`).set(as(OWNER)).send({ companyBoothLimit: 5, revision: 2 }),
    ])
    expect([first.status, second.status].sort()).toEqual([200, 409])

    cms.failNext.update = true
    await request(app).patch(`/admin/exhibitions/${id}`).set(as(OWNER)).send({ companyBoothLimit: 9, revision: 3 }).expect(502)
    const { rows } = await pool.query(
      `SELECT company_booth_limit, revision FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1`,
      [id],
    )
    expect(rows[0].revision).toBe(3)
    expect(rows[0].company_booth_limit).not.toBe('9')
  })

  it('refuses every other role with 403 and writes nothing', async () => {
    const page = cms.seed('exhibitions', { title: 'نمایشگاه', description: '', ...PUBLIC_EVENT_FIELDS })
    for (const user of USERS.filter((candidate) => candidate.id !== OWNER)) {
      await request(app).post('/admin/events').set(as(user.id)).send(eventBody()).expect(403)
      await request(app).get('/admin/exhibitions').set(as(user.id)).expect(403)
      await request(app).post('/admin/exhibitions').set(as(user.id)).send(exhibitionBody()).expect(403)
      await request(app).patch(`/admin/exhibitions/${page.id}`).set(as(user.id)).send({ companyBoothLimit: 1, revision: 0 }).expect(403)
    }
    expect(cms.all('events')).toEqual([])
    expect(cms.all('exhibitions')).toHaveLength(1)
    const { rows } = await pool.query(
      `SELECT exhibition_id FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1`,
      [page.id],
    )
    expect(rows).toEqual([])
  })
})
