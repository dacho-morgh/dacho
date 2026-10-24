import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../../src/auth/user-store.js'
import { createApp } from '../../src/app.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'

// Real Postgres + real private-file directory. The suite drives the public HTTP
// surface through the proxy identity boundary; it does not fake repository rows.
const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 'access-documents-integration' })
const PROXY_SECRET = 'access-documents-proxy-secret'

const people = {
  owner: { id: 'owner-1', phone: '09000000001', name: 'صاحب سیستم', operationalRole: 'system-owner', roles: ['admin'], isActive: true },
  secretariat: { id: 'secretariat-1', phone: '09000000002', name: 'دبیرخانه', operationalRole: 'central-secretariat', roles: [], isActive: true },
  chief: { id: 'chief-1', phone: '09000000003', name: 'سردبیر', operationalRole: 'chief-reviewer', roles: [], isActive: true },
  reviewer: { id: 'reviewer-1', phone: '09000000004', name: 'داور', operationalRole: 'reviewer', roles: ['referee'], isActive: true },
  employer: { id: 'employer-1', phone: '09000000005', name: 'کارفرما', operationalRole: 'employer-reviewer', roles: [], isActive: true },
  investment: { id: 'investment-1', phone: '09000000006', name: 'سرمایه‌گذاری', operationalRole: 'investment-reviewer', roles: [], isActive: true },
  repA: { id: 'rep-a', phone: '09000000007', name: 'نماینده الف', operationalRole: 'representative', roles: ['representative'], isActive: true },
  repB: { id: 'rep-b', phone: '09000000008', name: 'نماینده ب', operationalRole: 'representative', roles: ['representative'], isActive: true },
} satisfies Record<string, User>

const userStore = new InMemoryUserStore(Object.values(people))
const companyStore = new InMemoryCompanyStore([
  { name: 'شرکت الف', nationalId: 'nid-a', representativeId: people.repA.id },
  { name: 'شرکت ب', nationalId: 'nid-b', representativeId: people.repB.id },
])
let payload: Awaited<ReturnType<typeof createApp>>
let storage: PrivateDocumentStorage
let storageRoot: string

const headers = (userId: string) => ({
  'x-internal-proxy-secret': PROXY_SECRET,
  'x-user-id': userId,
  // A deliberately forged compatibility role proves the backend ignores it.
  'x-user-roles': 'admin',
})

async function makeApp() {
  const serviceCatalog = new InMemoryServiceCatalog()
  serviceCatalog.set({
    id: '1',
    key: 'events',
    title: 'رویدادها',
    workflow: [{ title: 'بررسی اولیه', role: '1', roleName: 'دبیرخانه', order: 0 }],
    formFields: [],
  })
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt: await JwtSigner.create('test-kid'),
    userStore,
    companyStore,
    pool,
    serviceCatalog,
    proxySecret: PROXY_SECRET,
    privateDocumentStorage: storage,
  })
}

async function createRequest(userId = people.repA.id, title = 'درخواست آزمون'): Promise<string> {
  const res = await request(payload)
    .post('/requests')
    .set(headers(userId))
    .send({ serviceId: '1', title })
    .expect(201)
  return res.body.request.id as string
}

async function submit(id: string, userId = people.repA.id) {
  return request(payload).post(`/requests/${id}/submit`).set(headers(userId))
}

function assign(requestId: string, userId: string, role: string, actor = people.owner.id) {
  return request(payload)
    .post(`/admin/requests/${requestId}/assignments`)
    .set(headers(actor))
    .send({ userId, role })
}

const pdf = (label = 'proposal', size = 64) => {
  const body = Buffer.alloc(size)
  body.write(`%PDF-1.7\n${label}`, 0, 'ascii')
  return body
}

const docx = () => {
  const body = Buffer.alloc(64)
  body.set([0x50, 0x4b, 0x03, 0x04])
  return body
}

const upload = (input: {
  userId: string
  category: string
  filename: string
  contentType: string
  body: Buffer
  requestId?: string
  companyId?: string
  logicalVersion?: number
}) => {
  const agent = request(payload)
    .post('/documents')
    .set(headers(input.userId))
    .field('category', input.category)
    .attach('file', input.body, { filename: input.filename, contentType: input.contentType })
  if (input.requestId) agent.field('requestId', input.requestId)
  if (input.companyId) agent.field('companyId', input.companyId)
  if (input.logicalVersion) agent.field('logicalVersion', String(input.logicalVersion))
  return agent
}

describe('shared access policy and private documents (T09/T10)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
    storageRoot = mkdtempSync(join(tmpdir(), 'dacho-private-documents-'))
    storage = new PrivateDocumentStorage(storageRoot)
    await storage.ensure()
    payload = await makeApp()
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.private_documents')
    await pool.query('DELETE FROM dashboard.case_assignments')
    await pool.query('DELETE FROM dashboard.letters')
    await pool.query('DELETE FROM dashboard.requests')
    const stableRoles: Record<string, string> = {
      [people.secretariat.id]: 'central-secretariat',
      [people.chief.id]: 'chief-reviewer',
      [people.reviewer.id]: 'reviewer',
      [people.employer.id]: 'employer-reviewer',
      [people.investment.id]: 'investment-reviewer',
      [people.repA.id]: 'representative',
      [people.repB.id]: 'representative',
    }
    for (const raw of Object.values(people)) {
      const person = raw as User
      if (person.id === people.owner.id) continue
      person.operationalRole = stableRoles[person.id] ?? 'representative'
      person.isActive = true
      person.roles = person.operationalRole === 'representative' ? ['representative'] : person.operationalRole === 'reviewer' ? ['referee'] : []
    }
    rmSync(storageRoot, { recursive: true, force: true })
    mkdirSync(storageRoot, { recursive: true })
  })

  afterAll(async () => {
    await pool.query('DELETE FROM dashboard.private_documents')
    await pool.query('DELETE FROM dashboard.case_assignments')
    await pool.query('DELETE FROM dashboard.requests')
    await pool.end()
    rmSync(storageRoot, { recursive: true, force: true })
  })

  it('shares one own/assigned/all scope across lists, details, counts and safe projections', async () => {
    const own = await createRequest(people.repA.id, 'مال الف')
    const other = await createRequest(people.repB.id, 'مال ب')
    await submit(own)
    await submit(other, people.repB.id)

    const list = async (userId: string) => (await request(payload).get('/requests').set(headers(userId)).expect(200)).body
    expect(await list(people.repA.id)).toMatchObject({ total: 1 })
    expect((await list(people.repA.id)).items[0].id).toBe(own)
    expect(await list(people.repB.id)).toMatchObject({ total: 1 })
    expect(await list(people.owner.id)).toMatchObject({ total: 2 })
    expect(await list(people.secretariat.id)).toMatchObject({ total: 2 })
    expect(await list(people.chief.id)).toMatchObject({ total: 0 })
    expect(await list(people.investment.id)).toMatchObject({ total: 0 })

    await assign(own, people.chief.id, 'chief-reviewer').expect(201)
    await assign(own, people.reviewer.id, 'reviewer').expect(201)
    await assign(own, people.employer.id, 'employer-reviewer').expect(201)
    await assign(own, people.investment.id, 'investment-reviewer').expect(201)

    for (const person of [people.chief, people.reviewer, people.employer, people.investment]) {
      expect(await list(person.id)).toMatchObject({ total: 1 })
      expect((await list(person.id)).items[0].id).toBe(own)
      const detail = await request(payload).get(`/requests/${own}`).set(headers(person.id)).expect(200)
      expect(detail.body.request.allowedActions).toEqual(['read'])
      expect((await request(payload).get(`/requests/${other}`).set(headers(person.id))).status).toBe(404)
      expect((await request(payload).get('/stats').set(headers(person.id)).expect(200)).body.total).toBe(1)
    }

    expect((await request(payload).get('/stats').set(headers(people.owner.id)).expect(200)).body.total).toBe(2)
    const ownerDetail = await request(payload).get(`/requests/${own}`).set(headers(people.owner.id)).expect(200)
    expect(ownerDetail.body.request.allowedActions).toContain('assign')
    expect(ownerDetail.body.request.allowedActions).not.toContain('submit')
    expect(ownerDetail.body.owner).toEqual({ id: people.repA.id, name: people.repA.name })
    expect(JSON.stringify(ownerDetail.body.owner)).not.toContain(people.repA.phone)

    const adminDetail = await request(payload).get(`/admin/requests/${own}`).set(headers(people.chief.id)).expect(200)
    expect(adminDetail.body.request.allowedActions).toEqual(['read'])
    expect(adminDetail.body.owner).toEqual({ id: people.repA.id, name: people.repA.name })

    const company = await request(payload).get(`/admin/companies/${people.repA.id}`).set(headers(people.owner.id)).expect(200)
    expect(company.body.company.name).toBe('شرکت الف')
    expect(company.body.representative.phone).toBe(people.repA.phone)
    expect(company.body.user).toBeUndefined()
    expect(JSON.stringify(company.body)).not.toContain('apiKey')
    expect((await request(payload).get(`/admin/companies/${people.repA.id}`).set(headers(people.chief.id))).status).toBe(403)
  })

  it('revokes access on assignment revocation, role change and deactivation', async () => {
    const id = await createRequest()
    await submit(id)
    await assign(id, people.reviewer.id, 'reviewer').expect(201)
    expect((await request(payload).get(`/requests/${id}`).set(headers(people.reviewer.id))).status).toBe(200)

    await request(payload)
      .delete(`/admin/requests/${id}/assignments/${people.reviewer.id}`)
      .set(headers(people.owner.id))
      .send({ reason: 'replacement' })
      .expect(200)
    expect((await request(payload).get(`/requests/${id}`).set(headers(people.reviewer.id))).status).toBe(404)
    const stored = await pool.query('SELECT active, revoke_reason FROM dashboard.case_assignments WHERE request_id = $1 AND user_id = $2', [id, people.reviewer.id])
    expect(stored.rows[0]).toMatchObject({ active: false, revoke_reason: 'replacement' })

    await assign(id, people.reviewer.id, 'reviewer').expect(201)
    const reviewer = people.reviewer as User
    reviewer.operationalRole = 'chief-reviewer'
    expect((await request(payload).get(`/requests/${id}`).set(headers(people.reviewer.id))).status).toBe(404)
    reviewer.operationalRole = 'reviewer'
    expect((await request(payload).get(`/requests/${id}`).set(headers(people.reviewer.id))).status).toBe(200)

    reviewer.isActive = false
    expect((await request(payload).get(`/requests/${id}`).set(headers(people.reviewer.id))).status).toBe(403)
    reviewer.isActive = true
  })

  it('keeps allowedActions in agreement with the actual submit/assign endpoints', async () => {
    const id = await createRequest(people.repA.id, 'پیش‌نویس')
    const draft = await request(payload).get(`/requests/${id}`).set(headers(people.repA.id)).expect(200)
    expect(draft.body.request.allowedActions).toEqual(['read', 'submit', 'uploadDocument', 'deleteDocument'])

    await assign(id, people.chief.id, 'chief-reviewer').expect(201)
    const chief = await request(payload).get(`/requests/${id}`).set(headers(people.chief.id)).expect(200)
    expect(chief.body.request.allowedActions).toEqual(['read'])
    expect((await submit(id, people.chief.id)).status).toBe(403)
    expect((await assign(id, people.reviewer.id, 'reviewer', people.chief.id)).status).toBe(403)

    const owner = await request(payload).get(`/requests/${id}`).set(headers(people.owner.id)).expect(200)
    expect(owner.body.request.allowedActions).toContain('assign')
    expect(owner.body.request.allowedActions).not.toContain('submit')
    expect((await submit(id, people.owner.id)).status).toBe(403)

    expect((await submit(id, people.repB.id)).status).toBe(404)
    expect((await submit(id, people.repA.id)).status).toBe(200)
    const submitted = await request(payload).get(`/requests/${id}`).set(headers(people.repA.id)).expect(200)
    expect(submitted.body.request.allowedActions).toEqual(['read'])
    expect((await submit(id, people.repA.id)).status).toBe(409)
  })

  it('stores multiple Word/PDF files on one field and enforces the exact size/type boundary', async () => {
    const id = await createRequest()

    const first = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'پروپوزال.pdf',
      contentType: 'application/pdf',
      body: pdf(),
      requestId: id,
    }).expect(201)
    const second = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'پروپوزال.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body: docx(),
      requestId: id,
    }).expect(201)
    expect(first.body.document.logicalVersion).toBe(1)
    expect(second.body.document.logicalVersion).toBe(1)
    expect(first.body.document.allowedActions).toEqual(['download', 'delete'])

    const list = await request(payload).get(`/documents?requestId=${id}`).set(headers(people.repA.id)).expect(200)
    expect(list.body.items).toHaveLength(2)
    expect(JSON.stringify(list.body)).not.toContain('storageKey')

    const exact = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'exact.pdf',
      contentType: 'application/pdf',
      body: pdf('exact', 10_000_000),
      requestId: id,
    }).expect(201)
    expect(exact.body.document.sizeBytes).toBe(10_000_000)

    const over = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'over.pdf',
      contentType: 'application/pdf',
      body: pdf('over', 10_000_001),
      requestId: id,
    })
    expect(over.status).toBe(413)
    expect(over.body.error).toBe('file_too_large')

    const image = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'photo.png',
      contentType: 'image/png',
      body: Buffer.from('89504e470d0a1a0a', 'hex'),
      requestId: id,
    })
    expect(image.status).toBe(400)
    expect(image.body.error).toBe('invalid_file_type')

    const unsupported = await upload({
      userId: people.repA.id,
      category: 'rfp',
      filename: 'rfp.pdf',
      contentType: 'application/pdf',
      body: pdf(),
      requestId: id,
    })
    expect(unsupported.status).toBe(422)
    expect(unsupported.body.error).toBe('unsupported_category')

    const stored = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM dashboard.private_documents WHERE request_id = $1', [id])
    expect(stored.rows[0]?.count).toBe('3')
    const requestRow = await pool.query<{ status: string }>('SELECT status::text AS status FROM dashboard.requests WHERE id = $1', [id])
    expect(requestRow.rows[0]?.status).toBe('draft')
  })

  it('denies cross-company, unassigned, anonymous and financial downloads while allowing the approved audiences', async () => {
    const id = await createRequest()
    await assign(id, people.chief.id, 'chief-reviewer').expect(201)
    await assign(id, people.reviewer.id, 'reviewer').expect(201)
    await assign(id, people.employer.id, 'employer-reviewer').expect(201)
    await assign(id, people.investment.id, 'investment-reviewer').expect(201)

    const proposal = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'proposal.pdf',
      contentType: 'application/pdf',
      body: pdf(),
      requestId: id,
    }).expect(201)
    const financial = await upload({
      userId: people.repA.id,
      category: 'financialStatements',
      filename: 'financial.pdf',
      contentType: 'application/pdf',
      body: pdf('financial'),
      requestId: id,
    }).expect(201)

    const proposalId = proposal.body.document.id as string
    const financialId = financial.body.document.id as string

    for (const person of [people.chief, people.reviewer, people.employer]) {
      expect((await request(payload).get(`/documents/${proposalId}/download`).set(headers(person.id))).status).toBe(200)
      expect((await request(payload).get(`/documents/${financialId}/download`).set(headers(person.id))).status).toBe(404)
      expect((await request(payload).get(`/documents?requestId=${id}`).set(headers(person.id))).body.items.map((item: { id: string }) => item.id)).not.toContain(financialId)
    }

    expect((await request(payload).get(`/documents/${financialId}/download`).set(headers(people.investment.id))).status).toBe(200)
    expect((await request(payload).get(`/documents/${financialId}/download`).set(headers(people.owner.id))).status).toBe(200)
    expect((await request(payload).get(`/documents/${financialId}/download`).set(headers(people.secretariat.id))).status).toBe(200)
    expect((await request(payload).get(`/documents/${financialId}/download`).set(headers(people.repA.id))).status).toBe(200)

    expect((await request(payload).get(`/documents/${financialId}/download`).set(headers(people.repB.id))).status).toBe(404)
    expect((await request(payload).get(`/documents?requestId=${id}`).set(headers(people.repB.id))).status).toBe(404)
    expect((await request(payload).get(`/documents/${proposalId}/download`).set(headers(people.owner.id))).status).toBe(200)

    // No proxy secret: the route is not a public URL.
    expect((await request(payload).get(`/documents/${financialId}/download`).set({ 'x-user-id': people.owner.id })).status).toBe(403)
    const unassigned = await createRequest(people.repB.id, 'other')
    await submit(unassigned, people.repB.id)
    expect((await request(payload).get(`/documents/${financialId}/download`).set(headers(people.investment.id))).status).toBe(200)
  })

  it('keeps company dossier files private and denies them through case assignment', async () => {
    const companyDoc = await upload({
      userId: people.repA.id,
      category: 'articlesOfAssociation',
      filename: 'articles.pdf',
      contentType: 'application/pdf',
      body: pdf('articles'),
      companyId: '1',
    }).expect(201)

    expect((await request(payload).get(`/documents/${companyDoc.body.document.id}/download`).set(headers(people.repB.id))).status).toBe(404)
    expect((await request(payload).get(`/documents/${companyDoc.body.document.id}/download`).set(headers(people.owner.id))).status).toBe(200)
    expect((await request(payload).get(`/documents/${companyDoc.body.document.id}/download`).set(headers(people.secretariat.id))).status).toBe(200)
    expect((await request(payload).get(`/documents?companyId=1`).set(headers(people.chief.id))).status).toBe(403)

    const crossCompany = await upload({
      userId: people.repB.id,
      category: 'articlesOfAssociation',
      filename: 'articles-b.pdf',
      contentType: 'application/pdf',
      body: pdf('articles-b'),
      companyId: '1',
    })
    expect(crossCompany.status).toBe(404)

    const missingCompany = await upload({
      userId: people.owner.id,
      category: 'articlesOfAssociation',
      filename: 'missing.pdf',
      contentType: 'application/pdf',
      body: pdf('missing'),
      companyId: '999999',
    })
    expect(missingCompany.status).toBe(404)
  })

  it('validates assignment role/account state and does not let another role assign', async () => {
    const id = await createRequest()
    expect((await assign(id, people.reviewer.id, 'chief-reviewer')).status).toBe(400)
    const employer = people.employer as User
    employer.isActive = false
    expect((await assign(id, people.employer.id, 'employer-reviewer')).status).toBe(400)
    employer.isActive = true
    expect((await assign(id, people.chief.id, 'chief-reviewer', people.secretariat.id)).status).toBe(403)
    await assign(id, people.chief.id, 'chief-reviewer').expect(201)
    expect((await assign(id, people.chief.id, 'chief-reviewer')).status).toBe(409)
    expect((await request(payload).delete(`/admin/requests/${id}/assignments/${people.chief.id}`).set(headers(people.chief.id))).status).toBe(403)
  })

  it('scopes letter reads to participant/assignment and supports draft-only deletion', async () => {
    const id = await createRequest()
    await pool.query(
      `INSERT INTO dashboard.letters (type, title, body, sender_id, sender_name, sender_role, recipient_id, request_id, read)
       VALUES ('official', 'نامه پرونده', 'متن', $1, 'دبیرخانه', 'central-secretariat', $2, $3, false)`,
      [people.secretariat.id, people.repA.id, id],
    )

    expect((await request(payload).get('/letters').set(headers(people.repA.id)).expect(200)).body.total).toBe(1)
    expect((await request(payload).get('/letters').set(headers(people.repB.id)).expect(200)).body.total).toBe(0)
    expect((await request(payload).get('/letters').set(headers(people.owner.id)).expect(200)).body.total).toBe(1)
    expect((await request(payload).get('/letters').set(headers(people.chief.id)).expect(200)).body.total).toBe(0)
    await assign(id, people.chief.id, 'chief-reviewer').expect(201)
    expect((await request(payload).get('/letters').set(headers(people.chief.id)).expect(200)).body.total).toBe(1)

    const doc = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'draft.pdf',
      contentType: 'application/pdf',
      body: pdf(),
      requestId: id,
    }).expect(201)
    await request(payload).delete(`/documents/${doc.body.document.id}`).set(headers(people.repA.id)).expect(200)
    expect((await request(payload).get(`/documents/${doc.body.document.id}`).set(headers(people.repA.id))).status).toBe(404)

    const submittedDoc = await upload({
      userId: people.repA.id,
      category: 'proposal',
      filename: 'submitted.pdf',
      contentType: 'application/pdf',
      body: pdf(),
      requestId: id,
    }).expect(201)
    expect((await submit(id, people.repA.id)).status).toBe(200)
    expect((await request(payload).delete(`/documents/${submittedDoc.body.document.id}`).set(headers(people.repA.id))).status).toBe(403)
  })
})
