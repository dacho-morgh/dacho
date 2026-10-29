import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { clearVerifiedCompanies, seedVerifiedCompanies } from './verified-company-fixtures.js'
import {
  DEFAULT_EVENT_RULES_VERSION,
  DEFAULT_NON_COMPETE_VERSION,
  APPLICATION_FORM_VERSION,
} from '../../src/dashboard/request-repo.js'

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://phase0_test:***@127.0.0.1:55439/dacho_phase0_test'
const pool = new Pool({ connectionString, application_name: 't20-proposal-intake' })

const users = [
  { id: 'owner', phone: 'owner', operationalRole: 'system-owner', isActive: true },
  { id: 'company-user-1', phone: 'company-user-1', operationalRole: 'representative', isActive: true },
  { id: 'employer-1', phone: 'employer-1', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'chief', phone: 'chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', phone: 'investment', operationalRole: 'investment-reviewer', isActive: true },
]

const userStore = new InMemoryUserStore(users)
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت فناور پیشرو', nationalId: 'T20-company', representativeId: 'company-user-1' },
])

const auth = (id = 'owner') => ({
  'x-internal-proxy-secret': 'test-proxy-secret',
  'x-user-id': id,
  'x-user-roles': users.find((u) => u.id === id)?.operationalRole ?? 'representative',
})

const makeApp = async () =>
  createApp({
    pool,
    userStore,
    companyStore,
    jwt: await JwtSigner.create('test'),
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    serviceCatalog: new InMemoryServiceCatalog([
      {
        id: 'event-service',
        key: 'event-application',
        title: 'درخواست رویداد',
        workflow: [{ title: 'بررسی سردبیر', role: 'chief-reviewer', roleName: 'chief-reviewer', order: 0 }],
        formFields: null,
      },
    ]),
    proxySecret: 'test-proxy-secret',
  })

const eventPayload = {
  title: 'رویداد هوش مصنوعی ۲۰۲۶',
  description: 'توضیحات رویداد',
  registrationOpenAt: '2020-01-01T00:00:00Z',
  registrationCloseAt: '2099-01-01T00:00:00Z',
  responsibleChiefId: 'chief',
  responsibleInvestmentId: 'investment',
}

async function cleanup() {
  const files = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  const docFiles = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id='event-service'; DELETE FROM dashboard.events")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all(
    [...files, ...docFiles].map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)),
  )
  await clearVerifiedCompanies(pool)
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id = 'company-user-1'")
}

describe('T20: Proposal draft, fixed form, server validation and versioned agreements (int)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(async () => {
    await cleanup()
    await seedVerifiedCompanies(pool, companyStore)
  })

  afterEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
    await pool.end()
  })

  it('runs the complete T20 lifecycle: draft, edit, proposal upload, validation, submit, and immutability', async () => {
    const app = await makeApp()
    const company = (await companyStore.findByRepresentative('company-user-1'))!

    // 1. Create event, category, subtopic and RFP
    const eventRes = await request(app).post('/admin/events').set(auth('owner')).send(eventPayload)
    expect(eventRes.status).toBe(201)
    const eventId = eventRes.body.event.id

    const catRes = await request(app)
      .post(`/admin/events/${eventId}/categories`)
      .set(auth('owner'))
      .send({ title: 'دسته هوش مصنوعی' })
    expect(catRes.status).toBe(201)
    const categoryId = catRes.body.category.id

    const subtopicRes = await request(app)
      .post(`/admin/events/${eventId}/subtopics`)
      .set(auth('owner'))
      .send({ title: 'پردازش تصویر', categoryId, employerId: 'employer-1' })
    expect(subtopicRes.status).toBe(201)
    const subtopicId = subtopicRes.body.subtopic.id

    const rfpRes = await request(app)
      .post(`/admin/events/${eventId}/subtopics/${subtopicId}/rfp`)
      .set(auth('owner'))
      .field('expectedVersionId', '')
      .field('reason', 'نسخه اولیه')
      .attach('files', Buffer.from('%PDF-Initial-RFP'), { filename: 'rfp.pdf', contentType: 'application/pdf' })
    expect(rfpRes.status).toBe(201)
    const rfpVersionId = rfpRes.body.version.id

    // 2. Company creates draft request
    const createRes = await request(app)
      .post('/requests')
      .set(auth('company-user-1'))
      .send({
        serviceId: 'event-service',
        title: 'طرح سامانه بینایی ماشین',
        answers: {},
        eventId,
        subtopicId,
        rfpVersionId,
      })
    expect(createRes.status).toBe(201)
    const reqId = createRes.body.request.id
    expect(createRes.body.request.status).toBe('draft')
    expect(createRes.body.request.revision).toBe(1)

    // 3. Save draft with application team via PATCH /requests/:id
    const team = [
      { name: 'سارا حسینی', role: 'مدیر پروژه و معمار نرم‌افزار' },
      { name: 'رضا کمالی', role: 'متخصص یادگیری ماشین' },
    ]
    const patchRes = await request(app)
      .patch(`/requests/${reqId}`)
      .set(auth('company-user-1'))
      .send({
        title: 'طرح سامانه بینایی ماشین - ویرایش نهایی تیم',
        answers: { applicationTeam: team },
      })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.request.title).toBe('طرح سامانه بینایی ماشین - ویرایش نهایی تیم')
    expect(patchRes.body.request.answers.applicationTeam).toHaveLength(2)

    // 4. Try submitting without proposal document or agreements -> should be blocked
    const earlySubmit = await request(app).post(`/requests/${reqId}/submit`).set(auth('company-user-1')).send({})
    expect(earlySubmit.status).toBe(400)
    expect(earlySubmit.body.error).toBe('invalid_answers')
    expect(earlySubmit.body.missingFields).toContain('proposalDocuments')
    expect(earlySubmit.body.missingFields).toContain('nonCompeteAcceptance')
    expect(earlySubmit.body.missingFields).toContain('eventRulesAcceptance')

    // 5. Upload proposal document
    const uploadRes = await request(app)
      .post('/documents')
      .set(auth('company-user-1'))
      .field('category', 'proposal')
      .field('requestId', reqId)
      .attach('file', Buffer.from('%PDF-1.4 Proposal Document Content'), {
        filename: 'proposal.pdf',
        contentType: 'application/pdf',
      })
    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.document.category).toBe('proposal')
    expect(uploadRes.body.document.logicalVersion).toBe(1)

    // 6. Try submitting with non-compete rejected
    const badConsentSubmit = await request(app)
      .post(`/requests/${reqId}/submit`)
      .set(auth('company-user-1'))
      .send({
        nonCompeteAcceptance: { accepted: false },
        eventRulesAcceptance: { accepted: true },
      })
    expect(badConsentSubmit.status).toBe(400)
    expect(badConsentSubmit.body.error).toBe('invalid_answers')
    expect(badConsentSubmit.body.missingFields).toEqual(['nonCompeteAcceptance'])

    // 7. Successful submit with valid agreements
    const validSubmit = await request(app)
      .post(`/requests/${reqId}/submit`)
      .set(auth('company-user-1'))
      .send({
        nonCompeteAcceptance: { accepted: true, textVersionId: DEFAULT_NON_COMPETE_VERSION },
        eventRulesAcceptance: { accepted: true, textVersionId: DEFAULT_EVENT_RULES_VERSION },
      })
    expect(validSubmit.status).toBe(200)
    expect(validSubmit.body.request.status).toBe('in_review')
    expect(validSubmit.body.request.revision).toBe(2)

    // 8. Verify database state for request_proposals and request_agreements
    const proposalDb = await pool.query<{
      form_version: string
      application_team: any
      proposal_documents: any
      revision: number
    }>('SELECT form_version, application_team, proposal_documents, revision FROM dashboard.request_proposals WHERE request_id = $1', [
      reqId,
    ])
    expect(proposalDb.rows).toHaveLength(1)
    expect(proposalDb.rows[0]?.form_version).toBe(APPLICATION_FORM_VERSION)
    expect(proposalDb.rows[0]?.revision).toBe(2)
    expect(proposalDb.rows[0]?.application_team).toHaveLength(2)
    expect(proposalDb.rows[0]?.proposal_documents).toHaveLength(1)
    expect(proposalDb.rows[0]?.proposal_documents[0].filename).toBe('proposal.pdf')

    const agreementsDb = await pool.query<{
      agreement_type: string
      text_version_id: string
      accepted_by: string
      revision: number
    }>('SELECT agreement_type, text_version_id, accepted_by, revision FROM dashboard.request_agreements WHERE request_id = $1 ORDER BY agreement_type ASC', [
      reqId,
    ])
    expect(agreementsDb.rows).toHaveLength(2)
    expect(agreementsDb.rows[0]).toMatchObject({
      agreement_type: 'event_rules',
      text_version_id: DEFAULT_EVENT_RULES_VERSION,
      accepted_by: 'company-user-1',
      revision: 2,
    })
    expect(agreementsDb.rows[1]).toMatchObject({
      agreement_type: 'non_compete',
      text_version_id: DEFAULT_NON_COMPETE_VERSION,
      accepted_by: 'company-user-1',
      revision: 2,
    })

    // 9. Verify immutability triggers on proposals and agreements
    await expect(
      pool.query("UPDATE dashboard.request_proposals SET form_version = 'tampered' WHERE request_id = $1", [reqId]),
    ).rejects.toThrow('Request proposal records are immutable')

    await expect(
      pool.query("UPDATE dashboard.request_agreements SET text_version_id = 'tampered' WHERE request_id = $1", [reqId]),
    ).rejects.toThrow('Request agreement records are immutable')

    // 10. Attempting to submit again returns 409 already_submitted
    const duplicateSubmit = await request(app)
      .post(`/requests/${reqId}/submit`)
      .set(auth('company-user-1'))
      .send({
        nonCompeteAcceptance: { accepted: true },
        eventRulesAcceptance: { accepted: true },
      })
    expect(duplicateSubmit.status).toBe(409)
    expect(duplicateSubmit.body.error).toBe('already_submitted')

    // 11. Attempting to edit after submit returns 409 request_not_draft
    const latePatch = await request(app)
      .patch(`/requests/${reqId}`)
      .set(auth('company-user-1'))
      .send({ title: 'تغییر بعد از ارسال' })
    expect(latePatch.status).toBe(409)
    expect(latePatch.body.error).toBe('request_not_draft')

    // 12. Read proposal details via GET /requests/:id/proposal
    const getProposalRes = await request(app).get(`/requests/${reqId}/proposal`).set(auth('company-user-1'))
    expect(getProposalRes.status).toBe(200)
    expect(getProposalRes.body.proposal.formVersion).toBe(APPLICATION_FORM_VERSION)
    expect(getProposalRes.body.proposal.applicationTeam).toHaveLength(2)
    expect(getProposalRes.body.proposal.proposalDocuments).toHaveLength(1)
    expect(getProposalRes.body.agreements).toHaveLength(2)
  })
})
