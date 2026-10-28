import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { Pool } from 'pg'

import { createApp } from '../../src/app.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryDossierDocumentSource } from '../../src/dashboard/dossier.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { JwtSigner } from '../../src/jwt.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PostgresVerificationStore } from '../../src/dashboard/verification-repo.js'

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })

describe('Postgres Company Verification Integration (T14)', () => {
  let app: ReturnType<typeof createApp>
  let userStore: InMemoryUserStore
  let companyStore: InMemoryCompanyStore
  let dossierDocuments: InMemoryDossierDocumentSource
  const representativeIds: string[] = []

  function submission() {
    const representativeId = randomUUID()
    representativeIds.push(representativeId)
    return { companyId: randomUUID(), representativeId, snapshot: { company: { name: 'Concurrent verification test' } } }
  }

  beforeAll(async () => {
    await runMigrations(connectionString)

    userStore = new InMemoryUserStore()
    companyStore = new InMemoryCompanyStore()
    dossierDocuments = new InMemoryDossierDocumentSource()

    const delivery = new ConsoleOtpDelivery()
    const codeStore = new InMemoryCodeStore()
    const jwt = await JwtSigner.create('test-kid')

    app = createApp({
      pool,
      userStore,
      companyStore,
      dossierDocuments,
      serviceCatalog: new InMemoryServiceCatalog(),
      delivery,
      codeStore,
      jwt,
      proxySecret: 'test-proxy-secret',
      verificationStore: new PostgresVerificationStore(pool),
    })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM dashboard.company_verifications WHERE representative_id = ANY($1::text[])', [representativeIds])
    await pool.query('DELETE FROM dashboard.letters WHERE recipient_id = ANY($1::text[])', [representativeIds])
    await pool.query('DELETE FROM dashboard.activities WHERE owner_id = ANY($1::text[]) AND action LIKE $2', [representativeIds, 'verification_%'])
    await pool.end()
  })

  it('serializes simultaneous first submissions and records a single transition', async () => {
    const store = new PostgresVerificationStore(pool)
    const input = submission()
    const results = await Promise.all(Array.from({ length: 10 }, () => store.submit(input)))
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toEqual(
      Array.from({ length: 9 }, () => ({ ok: false, reason: 'already_submitted' })),
    )
    expect(await store.listHistory(input.companyId)).toHaveLength(1)
    const activities = await pool.query('SELECT action FROM dashboard.activities WHERE owner_id = $1', [input.representativeId])
    expect(activities.rows).toEqual([{ action: 'verification_submit' }])
  })

  it.each(['return', 'reject'] as const)('serializes resubmissions after %s and preserves the previous decision', async (action) => {
    const store = new PostgresVerificationStore(pool)
    const input = submission()
    await store.submit(input)
    await store.decide({ companyId: input.companyId, action, reviewerId: randomUUID(), reason: 'Correct documents', expectedRevision: 1 })
    const results = await Promise.all(Array.from({ length: 10 }, () => store.submit(input)))
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toHaveLength(9)
    const history = await store.listHistory(input.companyId)
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({ revision: 2, status: 'pending' })
    expect(history[1]).toMatchObject({ revision: 1, status: action === 'return' ? 'returned' : 'rejected', reason: 'Correct documents' })
  })

  it('records only one decision and one letter when reviewers decide concurrently', async () => {
    const store = new PostgresVerificationStore(pool)
    const input = submission()
    const submitted = await store.submit(input)
    if (!submitted.ok) throw new Error('Expected a new submission')
    const results = await Promise.all(Array.from({ length: 5 }, () => store.decide({
      id: submitted.verification.id, action: 'approve', reviewerId: randomUUID(), expectedRevision: 1,
    })))
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toEqual(
      Array.from({ length: 4 }, () => ({ ok: false, reason: 'not_pending' })),
    )
    const letters = await pool.query('SELECT type FROM dashboard.letters WHERE recipient_id = $1', [input.representativeId])
    expect(letters.rows).toEqual([{ type: 'approved' }])
    const activities = await pool.query("SELECT action FROM dashboard.activities WHERE owner_id = $1 AND action = 'verification_approve'", [input.representativeId])
    expect(activities.rows).toHaveLength(1)
  })

  it('persists verification, creates letter on return, and logs transition in activities', async () => {
    const repUser = await userStore.findOrCreateByPhone('09120000001')
    representativeIds.push(repUser.id)
    repUser.name = 'نماینده شرکت ادغام'
    repUser.operationalRole = 'representative'
    repUser.roles = ['representative']

    const company = await companyStore.create({
      name: 'شرکت فناوران ادغام',
      nationalId: '14002222222',
      activityDomain: 'امنیت سایبری',
      registrationNumber: '654321',
      status: 'فعال',
      type: 'سهامی خاص',
      legalEntityType: 'سهامی خاص',
      knowledgeBasedStatus: 'دانش‌بنیان',
      classification: 'فناوری اطلاعات',
      foundingYear: '1399',
      productsServices: ['فایروال بومی'],
      addresses: [{ id: 'a1', title: 'مرکز', province: 'تهران', city: 'تهران', postalCode: '1111111111', address: 'تهران' }],
      notAvailable: [
        'centerEstablishment', 'website', 'insuredEmployeeCount', 'pastProjectsCustomers',
        'requestedServices', 'catalogues', 'certificatesLicenses', 'amendmentNotices',
      ],
      representativeId: repUser.id,
    })

    dossierDocuments.add(company.id, 'articlesOfAssociation', 'statute.pdf', 1024)
    dossierDocuments.add(company.id, 'establishmentNotices', 'notice.pdf', 2048)

    const secretariat = await userStore.findOrCreateByPhone('09120000002')
    secretariat.name = 'دبیرخانه تست'
    secretariat.operationalRole = 'central-secretariat'
    secretariat.roles = ['admin']

    const repHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': repUser.id,
      'x-user-roles': 'representative',
    }
    const secHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': secretariat.id,
      'x-user-roles': 'central-secretariat',
    }

    // 1. Submit verification
    const submitRes = await request(app)
      .post('/profile/verification/submit')
      .set(repHeaders)
      .expect(201)

    const verif = submitRes.body.verification
    expect(verif.status).toBe('pending')
    expect(verif.revision).toBe(1)

    // Check DB row directly
    const dbRow = await pool.query(
      'SELECT * FROM dashboard.company_verifications WHERE id = $1',
      [verif.id],
    )
    expect(dbRow.rows[0].status).toBe('pending')
    expect(dbRow.rows[0].revision).toBe(1)

    // 2. Secretariat returns with reason
    const returnRes = await request(app)
      .post(`/admin/verifications/${verif.id}/decision`)
      .set(secHeaders)
      .send({ action: 'return', reason: 'روزنامه رسمی آپلود نشده است.' })
      .expect(200)

    expect(returnRes.body.verification.status).toBe('returned')

    // Verify letter was created in real Postgres dashboard.letters
    const letterDb = await pool.query(
      `SELECT * FROM dashboard.letters WHERE recipient_id = $1 ORDER BY sent_at DESC LIMIT 1`,
      [repUser.id],
    )
    expect(letterDb.rows).toHaveLength(1)
    expect(letterDb.rows[0].type).toBe('needs_fix')
    expect(letterDb.rows[0].body).toBe('روزنامه رسمی آپلود نشده است.')

    // Verify transition in real Postgres dashboard.activities
    const activityDb = await pool.query(
      `SELECT * FROM dashboard.activities WHERE owner_id = $1 AND action = 'verification_return'`,
      [repUser.id],
    )
    expect(activityDb.rows).toHaveLength(1)
    expect(activityDb.rows[0].to_state).toBe('returned')
    expect(activityDb.rows[0].actor_id).toBe(secretariat.id)
    expect(activityDb.rows[0].reason).toBe('روزنامه رسمی آپلود نشده است.')

    // 3. Representative resubmits with revision 2
    const resubmitRes = await request(app)
      .post('/profile/verification/submit')
      .set(repHeaders)
      .expect(201)

    expect(resubmitRes.body.verification.revision).toBe(2)
    expect(resubmitRes.body.verification.status).toBe('pending')

    // 4. Secretariat approves revision 2
    const approveRes = await request(app)
      .post(`/admin/verifications/${resubmitRes.body.verification.id}/decision`)
      .set(secHeaders)
      .send({ action: 'approve' })
      .expect(200)

    expect(approveRes.body.verification.status).toBe('approved')

    // Verify approved letter
    const approvedLetterDb = await pool.query(
      `SELECT * FROM dashboard.letters WHERE recipient_id = $1 AND type = 'approved'`,
      [repUser.id],
    )
    expect(approvedLetterDb.rows).toHaveLength(1)
  })
})
