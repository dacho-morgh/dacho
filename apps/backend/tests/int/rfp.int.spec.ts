import { seedVerifiedCompanies, clearVerifiedCompanies } from './verified-company-fixtures.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import request from 'supertest'
import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { RequestRepository } from '../../src/dashboard/request-repo.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { DOCUMENT_POLICY_VERSION } from '../../src/documents/policy.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const users: User[] = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'other-chief', phone: 'other-chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'employer', phone: 'employer', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'other-employer', phone: 'other-employer', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'inactive', phone: 'inactive', operationalRole: 'employer-reviewer', isActive: false },
  { id: 'company', phone: 'company', operationalRole: 'representative', isActive: true },
  { id: 'outsider', phone: 'outsider', operationalRole: 'representative', isActive: true },
  { id: 'unassociated', phone: 'unassociated', operationalRole: 'representative', isActive: true },
  { id: 'reviewer', phone: 'reviewer', operationalRole: 'reviewer', isActive: true },
  { id: 'secretariat', phone: 'secretariat', operationalRole: 'central-secretariat', isActive: true },
]
const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'Synthetic company', nationalId: 'T18-company', representativeId: 'company' },
  { name: 'Other company', nationalId: 'T18-outsider', representativeId: 'outsider' },
])
const auth = (id = 'owner') => ({ 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': id })
const makeApp = async () =>
  createApp({
    pool,
    userStore,
    companyStore,
    jwt: await JwtSigner.create('test'),
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    serviceCatalog: new InMemoryServiceCatalog([
      { id: 'event-service', key: 'event', title: 'Event application', workflow: [], formFields: null },
    ]),
    proxySecret: 'test-proxy-secret',
  })

const eventBody = {
  title: 'Synthetic event',
  description: '',
  registrationOpenAt: '2020-01-01T00:00:00Z',
  registrationCloseAt: '2099-01-01T00:00:00Z',
  responsibleChiefId: 'chief',
  responsibleInvestmentId: 'investment',
}

async function cleanup() {
  const files = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(files.map(({ storage_key }) => storage.remove(storage_key)))
}

describe('subtopic RFP versioning and download workflow (T18)', () => {
  beforeAll(async () => {
    await runMigrations(process.env.DATABASE_URL!)
  })
  beforeEach(async () => {
    await cleanup()
    await seedVerifiedCompanies(pool, companyStore)
  })
  afterAll(async () => {
    await cleanup()
    await clearVerifiedCompanies(pool)
    await pool.end()
  })

  it('publishes multiple private RFP representations and downloads only the matching subtopic', async () => {
    const app = await makeApp()
    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventBody)).body.event.id
    const categoryId = (await request(app).post(`/admin/events/${eventId}/categories`).set(auth()).send({ title: 'Technology' })).body.category.id
    const subtopicId = (await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'Need', categoryId, employerId: 'employer' })).body.subtopic.id
    const base = `/events/${eventId}/subtopics/${subtopicId}/rfp`

    const published = await request(app)
      .post(`/admin${base}`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'Initial RFP')
      .attach('files', Buffer.from('%PDF-Synthetic first'), { filename: 'first.pdf', contentType: 'application/pdf' })
      .attach('files', Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]), {
        filename: 'first.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .attach('files', Buffer.from('%PDF-Synthetic extra'), { filename: 'extra.pdf', contentType: 'application/pdf' })

    expect(published.status).toBe(201)
    expect(published.body.version.files).toHaveLength(3)
    for (const file of published.body.version.files) {
      expect(file.policyVersion).toBe(DOCUMENT_POLICY_VERSION)
    }
    const acceptedPolicies = await pool.query<{ policy_version: string }>(
      'SELECT policy_version FROM dashboard.rfp_files WHERE version_id=$1',
      [published.body.version.id],
    )
    expect(acceptedPolicies.rows.map((file) => file.policy_version)).toEqual(Array(3).fill(DOCUMENT_POLICY_VERSION))
    expect(JSON.stringify(published.body)).not.toMatch(/storageKey|storage_key/)

    const current = await request(await makeApp()).get(base).set(auth('company'))
    expect(current.status).toBe(200)
    expect(current.body.version).toEqual(published.body.version)

    const file = current.body.version.files[0]
    const downloaded = await request(app).get(`${base}/${current.body.version.id}/files/${file.id}`).set(auth('company'))
    expect(downloaded.status).toBe(200)
    expect(downloaded.body).toEqual(Buffer.from('%PDF-Synthetic first'))
    expect(downloaded.headers['cache-control']).toBe('private, no-store')

    // Unauthorized or mismatching attempts
    expect((await request(app).get(`${base}/${current.body.version.id}/files/${file.id}`)).status).toBe(403)
    expect((await request(app).get(`/events/${randomUUID()}/subtopics/${subtopicId}/rfp/${current.body.version.id}/files/${file.id}`).set(auth('company'))).status).toBe(404)
    expect((await request(app).post(`/admin${base}`).set(auth('company'))).status).toBe(403)

    // Definition assignments authorize the current RFP before any case exists.
    const downloadUrl = `${base}/${current.body.version.id}/files/${file.id}`
    for (const id of ['chief', 'employer']) {
      expect((await request(app).get(base).set(auth(id))).status).toBe(200)
      expect((await request(app).get(downloadUrl).set(auth(id))).body).toEqual(Buffer.from('%PDF-Synthetic first'))
      expect((await request(app).post(`/admin${base}`).set(auth(id))).status).toBe(403)
    }
    for (const id of ['other-chief', 'other-employer', 'reviewer', 'investment', 'unassociated']) {
      expect((await request(app).get(base).set(auth(id))).status).toBe(404)
      expect((await request(app).get(downloadUrl).set(auth(id))).status).toBe(404)
    }

    // Reload authoritative assignments on every metadata and byte request.
    await pool.query('UPDATE dashboard.events SET responsible_chief_id=$2 WHERE id=$1', [eventId, 'other-chief'])
    await pool.query('UPDATE dashboard.event_subtopics SET employer_id=$2 WHERE id=$1', [subtopicId, 'other-employer'])
    for (const id of ['chief', 'employer']) {
      expect((await request(app).get(base).set(auth(id))).status).toBe(404)
      expect((await request(app).get(downloadUrl).set(auth(id))).status).toBe(404)
    }
    for (const id of ['other-chief', 'other-employer']) {
      expect((await request(app).get(base).set(auth(id))).status).toBe(200)
      expect((await request(app).get(downloadUrl).set(auth(id))).status).toBe(200)
    }
  })

  it('pins submitted RFP version and rejects stale draft submission after replacement', async () => {
    const app = await makeApp()
    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventBody)).body.event.id
    const categoryId = (await request(app).post(`/admin/events/${eventId}/categories`).set(auth()).send({ title: 'Technology' })).body.category.id
    const subtopicId = (await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'Need', categoryId, employerId: 'employer' })).body.subtopic.id
    const base = `/events/${eventId}/subtopics/${subtopicId}/rfp`

    const publish = (expectedVersionId: string, content: string) =>
      request(app)
        .post(`/admin${base}`)
        .set(auth())
        .field('expectedVersionId', expectedVersionId)
        .field('reason', 'Publish replacement')
        .attach('files', Buffer.from(content), { filename: 'rfp.pdf', contentType: 'application/pdf' })

    const v1 = (await publish('', '%PDF-Version one')).body.version
    const create = (actor = 'company') =>
      request(app)
        .post('/requests')
        .set(auth(actor))
        .send({
          serviceId: 'event-service',
          title: 'Application',
          eventId,
          subtopicId,
          rfpVersionId: v1.id,
          answers: { applicationTeam: [{ name: 'تیم فنی', role: 'توسعه‌دهنده' }] },
        })

    const first = await create()
    expect(first.status).toBe(201)

    await request(app)
      .post('/documents')
      .set(auth('company'))
      .field('category', 'proposal')
      .field('requestId', first.body.request.id)
      .attach('file', Buffer.from('%PDF-Proposal-Fixture'), { filename: 'prop.pdf', contentType: 'application/pdf' })
      .expect(201)

    const submitted = await request(app)
      .post(`/requests/${first.body.request.id}/submit`)
      .set(auth('company'))
      .send({
        nonCompeteAcceptance: { accepted: true },
        eventRulesAcceptance: { accepted: true },
      })
    expect(submitted.status).toBe(200)

    const context = await request(app).get(`/requests/${first.body.request.id}/rfp`).set(auth('company'))
    expect(context.status).toBe(200)
    expect(context.body.version.id).toBe(v1.id)

    const otherSubtopicId = (
      await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'Other need', categoryId, employerId: 'employer' })
    ).body.subtopic.id

    const other = await request(app)
      .post(`/admin/events/${eventId}/subtopics/${otherSubtopicId}/rfp`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'Other RFP')
      .attach('files', Buffer.from('%PDF-Other need'), { filename: 'other.pdf', contentType: 'application/pdf' })

    expect(other.status).toBe(201)
    expect((await request(app).get(`/events/${eventId}/subtopics/${otherSubtopicId}/rfp/${v1.id}/files/${v1.files[0].id}`).set(auth('company'))).status).toBe(404)
    expect((await request(app).get(`/requests/${first.body.request.id}/rfp/files/${other.body.version.files[0].id}`).set(auth('company'))).status).toBe(404)

    const stale = await create('outsider')
    const v2 = await publish(v1.id, '%PDF-Version two')
    expect(v2.status).toBe(201)
    expect((await publish(v1.id, '%PDF-Lost update')).status).toBe(409)

    // Submitted request still retains v1
    const old = await request(await makeApp()).get(`/requests/${first.body.request.id}/rfp`).set(auth('company'))
    expect(old.body.version).toEqual(context.body.version)
    const oldFile = await request(app).get(`/requests/${first.body.request.id}/rfp/files/${v1.files[0].id}`).set(auth('company'))
    expect(oldFile.status).toBe(200)
    expect(oldFile.body).toEqual(Buffer.from('%PDF-Version one'))

    // Subtopic direct download only serves current active RFP
    for (const id of ['company', 'chief', 'employer']) {
      expect((await request(app).get(`${base}/${v1.id}/files/${v1.files[0].id}`).set(auth(id))).status).toBe(404)
    }

    // Stale draft submit is rejected
    expect((await request(app).post(`/requests/${stale.body.request.id}/submit`).set(auth('outsider'))).body).toEqual({ error: 'stale_rfp' })

    // Immutability trigger checks
    await expect(pool.query('UPDATE dashboard.rfp_files SET filename=$2 WHERE id=$1', [v1.files[0].id, 'rewritten.pdf'])).rejects.toThrow(
      'RFP records are immutable',
    )

    // Access authorization checks for request-pinned RFP
    for (const id of ['outsider', 'unassociated', 'chief', 'reviewer', 'employer', 'investment']) {
      expect((await request(app).get(`/requests/${first.body.request.id}/rfp`).set(auth(id))).status).toBe(404)
    }

    // Assigned reviewer can read
    await pool.query(
      `INSERT INTO dashboard.case_assignments (request_id,user_id,role,assigned_by) VALUES ($1,'reviewer','reviewer','owner')`,
      [first.body.request.id],
    )
    expect((await request(app).get(`/requests/${first.body.request.id}/rfp`).set(auth('reviewer'))).status).toBe(200)
    await pool.query(`UPDATE dashboard.case_assignments SET active=false WHERE request_id=$1`, [first.body.request.id])
    expect((await request(app).get(`/requests/${first.body.request.id}/rfp`).set(auth('reviewer'))).status).toBe(404)
  })

  it('validates every RFP file before publishing and preserves current version on failure', async () => {
    const app = await makeApp()
    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventBody)).body.event.id
    const categoryId = (await request(app).post(`/admin/events/${eventId}/categories`).set(auth()).send({ title: 'Technology' })).body.category.id
    const subtopicId = (await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'Need', categoryId, employerId: 'employer' })).body.subtopic.id
    const base = `/events/${eventId}/subtopics/${subtopicId}/rfp`

    const max = Buffer.alloc(10_000_000, 32)
    max.write('%PDF-')
    const initial = await request(app)
      .post(`/admin${base}`)
      .set(auth())
      .field('expectedVersionId', '')
      .field('reason', 'Initial')
      .attach('files', max, { filename: 'max.pdf', contentType: 'application/pdf' })
    expect(initial.status).toBe(201)

    for (const [body, filename, contentType, status] of [
      [Buffer.alloc(10_000_001), 'huge.pdf', 'application/pdf', 413],
      [Buffer.from('not a pdf'), 'spoof.pdf', 'application/pdf', 400],
      [Buffer.from('image'), 'image.png', 'image/png', 400],
      [Buffer.from('%PDF-Wrong mime'), 'bad.pdf', 'application/msword', 400],
    ] as const) {
      const invalid = await request(app)
        .post(`/admin${base}`)
        .set(auth())
        .field('expectedVersionId', initial.body.version.id)
        .field('reason', 'Invalid replacement')
        .attach('files', Buffer.from('%PDF-Good'), { filename: 'good.pdf', contentType: 'application/pdf' })
        .attach('files', body, { filename, contentType })
      expect(invalid.status).toBe(status)
      expect((await request(app).get(base).set(auth('company'))).body.version.id).toBe(initial.body.version.id)
    }

    expect((await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM dashboard.rfp_versions WHERE subtopic_id=$1', [subtopicId])).rows[0]?.count).toBe(1)

    // Catalogue discovery exposes currentRfpVersionId
    const catalogue = await request(app).get(`/events/${eventId}/subtopics`).set(auth('company'))
    expect(catalogue.status).toBe(200)
    expect(catalogue.body.items[0]).toMatchObject({
      id: subtopicId,
      categoryId,
      categoryTitle: 'Technology',
      employerId: 'employer',
      currentRfpVersionId: initial.body.version.id,
    })
    expect(JSON.stringify(catalogue.body)).not.toMatch(/storageKey|storage_key|phone/)
  })

  it('serializes competing replacements without orphan versions or files', async () => {
    const app = await makeApp()
    const eventId = (await request(app).post('/admin/events').set(auth()).send(eventBody)).body.event.id
    const categoryId = (await request(app).post(`/admin/events/${eventId}/categories`).set(auth()).send({ title: 'Technology' })).body.category.id
    const subtopicId = (await request(app).post(`/admin/events/${eventId}/subtopics`).set(auth()).send({ title: 'Need', categoryId, employerId: 'employer' })).body.subtopic.id
    const url = `/admin/events/${eventId}/subtopics/${subtopicId}/rfp`

    const publish = () =>
      request(app)
        .post(url)
        .set(auth())
        .field('expectedVersionId', '')
        .field('reason', 'Concurrent initial')
        .attach('files', Buffer.from('%PDF-Fixture'), { filename: 'fixture.pdf', contentType: 'application/pdf' })

    const responses = await Promise.all([publish(), publish()])
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409])
    expect((await pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM dashboard.rfp_versions WHERE subtopic_id=$1', [subtopicId])).rows[0]?.count).toBe(1)
  })
})
