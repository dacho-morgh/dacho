import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'
import path from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const PROXY_SECRET = 'test-internal-proxy-secret'

const people = {
  owner: { id: 'owner-1', phone: '09000000001', name: 'صاحب سیستم', operationalRole: 'system-owner', roles: ['admin'], isActive: true },
  secretariat: { id: 'sec-1', phone: '09000000002', name: 'دبیرخانه', operationalRole: 'central-secretariat', roles: [], isActive: true },
  chief: { id: 'chief-1', phone: '09000000003', name: 'سردبیر', operationalRole: 'chief-reviewer', roles: [], isActive: true },
  reviewer: { id: 'reviewer-1', phone: '09000000004', name: 'داور', operationalRole: 'reviewer', roles: [], isActive: true },
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
})

const pdf = (label = 'test-file', size = 64) => {
  const body = Buffer.alloc(size)
  body.write(`%PDF-1.7\n${label}`, 0, 'ascii')
  return body
}

async function createRequest(userId = people.repA.id, title = 'درخواست آزمون'): Promise<string> {
  const res = await request(payload)
    .post('/requests')
    .set(headers(userId))
    .send({ serviceId: '1', title })
    .expect(201)
  return res.body.request.id as string
}

function submit(id: string, userId = people.repA.id) {
  return request(payload).post(`/requests/${id}/submit`).set(headers(userId))
}

function assign(requestId: string, userId: string, role: string, actor = people.owner.id) {
  return request(payload)
    .post(`/admin/requests/${requestId}/assignments`)
    .set(headers(actor))
    .send({ userId, role })
}

describe('T35 - Case-linked letters and private attachments integration', () => {
  beforeAll(async () => {
    storageRoot = path.join(process.env.PRIVATE_DOCUMENTS_DIR!, 't35-tests')
    mkdirSync(storageRoot, { recursive: true })
    storage = new PrivateDocumentStorage(storageRoot)
    await runMigrations(connectionString)

    const serviceCatalog = new InMemoryServiceCatalog()
    serviceCatalog.set({
      id: '1',
      key: 'events',
      title: 'رویدادها',
      workflow: [{ title: 'بررسی اولیه', role: '1', roleName: 'دبیرخانه', order: 0 }],
      formFields: [],
    })

    payload = await createApp({
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
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.letters')
    await pool.query('DELETE FROM dashboard.private_documents')
    await pool.query('DELETE FROM dashboard.case_assignments')
    await pool.query('DELETE FROM dashboard.requests')
  })

  afterAll(async () => {
    await pool.end()
    try {
      rmSync(storageRoot, { recursive: true, force: true })
    } catch {
      // Best-effort cleanup
    }
  })

  it('rejects attachment sends to unauthorized recipients and detached or mismatched cases', async () => {
    const requestId = await createRequest()
    const otherRequestId = await createRequest(people.repB.id)
    const upload = await request(payload).post('/documents').set(headers(people.repA.id))
      .field('category', 'financialStatements').field('requestId', requestId)
      .attach('file', pdf(), { filename: 'private-finance.pdf', contentType: 'application/pdf' }).expect(201)
    const documentId = upload.body.document.id as string
    await submit(requestId).expect(200)
    await assign(requestId, people.chief.id, 'chief-reviewer').expect(201)
    const send = (recipientId: string, linkedRequest?: string) => request(payload).post('/letters')
      .set(headers(people.secretariat.id)).send({ title: 'Private', body: 'Attachment', recipientId,
        ...(linkedRequest ? { requestId: linkedRequest } : {}), attachmentIds: [documentId] })
    await send(people.chief.id, requestId).expect(403)
    await send(people.repB.id).expect(403)
    await send(people.repB.id, otherRequestId).expect(403)
    await send(people.repA.id, requestId).expect(201)
    const company = await companyStore.findByRepresentative(people.repA.id)
    const dossier = await request(payload).post('/documents').set(headers(people.repA.id))
      .field('category', 'articlesOfAssociation').field('companyId', company!.id)
      .attach('file', pdf(), { filename: 'private-dossier.pdf', contentType: 'application/pdf' }).expect(201)
    await request(payload).post('/letters').set(headers(people.secretariat.id))
      .send({ title: 'Private', body: 'Attachment', recipientId: people.repB.id,
        attachmentIds: [dossier.body.document.id] }).expect(403)
  })

  it('does not expose legacy financial attachments through mailbox metadata or either download route', async () => {
    const requestId = await createRequest()
    const upload = await request(payload).post('/documents').set(headers(people.repA.id))
      .field('category', 'financialStatements').field('requestId', requestId)
      .attach('file', pdf(), { filename: 'secret-finance.pdf', contentType: 'application/pdf' }).expect(201)
    const documentId = upload.body.document.id as string
    await submit(requestId).expect(200)
    await assign(requestId, people.chief.id, 'chief-reviewer').expect(201)
    const { rows } = await pool.query<{ id: string }>(`INSERT INTO dashboard.letters
      (type, title, body, sender_id, recipient_id, request_id, attachments)
      VALUES ('official', 'Legacy', 'Legacy', $1, $2, $3, $4::jsonb) RETURNING id`,
      [people.secretariat.id, people.chief.id, requestId, JSON.stringify([{ id: documentId, filename: 'secret-finance.pdf' }])])
    const letterId = rows[0]!.id
    const detail = await request(payload).get(`/letters/${letterId}`).set(headers(people.chief.id)).expect(200)
    expect(detail.body.letter.attachments).toEqual([])
    const mailbox = await request(payload).get('/letters').set(headers(people.chief.id)).expect(200)
    expect(mailbox.body.items.find((letter: { id: string }) => letter.id === letterId).attachments).toEqual([])
    for (const url of [`/documents/${documentId}`, `/documents/${documentId}/download`,
      `/letters/${letterId}/attachments/${documentId}/download`]) {
      await request(payload).get(url).set(headers(people.chief.id)).expect(404)
    }
  })

  it('rejects cross-company dossier attachments even when both mailbox actors can access every case', async () => {
    const ownRequest = await createRequest()
    const otherRequest = await createRequest(people.repB.id)
    const company = await companyStore.findByRepresentative(people.repA.id)
    const upload = await request(payload).post('/documents').set(headers(people.repA.id))
      .field('category', 'articlesOfAssociation').field('companyId', company!.id)
      .attach('file', pdf(), { filename: 'company-a.pdf', contentType: 'application/pdf' }).expect(201)
    const documentId = upload.body.document.id as string
    const send = (requestId: string) => request(payload).post('/letters').set(headers(people.secretariat.id))
      .send({ title: 'Dossier', body: 'Dossier', recipientId: people.owner.id, requestId, attachmentIds: [documentId] })
    await send(ownRequest).expect(201)
    await send(otherRequest).expect(403)
    const { rows } = await pool.query<{ id: string }>(`INSERT INTO dashboard.letters
      (type, title, body, sender_id, recipient_id, request_id, attachments)
      VALUES ('official', 'Legacy', 'Legacy', $1, $2, $3, $4::jsonb) RETURNING id`,
      [people.secretariat.id, people.owner.id, otherRequest, JSON.stringify([{ id: documentId }])])
    const letterId = rows[0]!.id
    const detail = await request(payload).get(`/letters/${letterId}`).set(headers(people.owner.id)).expect(200)
    expect(detail.body.letter.attachments).toEqual([])
    await request(payload).get(`/letters/${letterId}/attachments/${documentId}/download`)
      .set(headers(people.owner.id)).expect(404)
  })

  it('a historic letter cannot restore proposal access after assignment revocation', async () => {
    const requestId = await createRequest()
    const upload = await request(payload).post('/documents').set(headers(people.repA.id))
      .field('category', 'proposal').field('requestId', requestId)
      .attach('file', pdf(), { filename: 'proposal.pdf', contentType: 'application/pdf' }).expect(201)
    const documentId = upload.body.document.id as string
    await submit(requestId).expect(200)
    await assign(requestId, people.chief.id, 'chief-reviewer').expect(201)
    const sent = await request(payload).post('/letters').set(headers(people.secretariat.id))
      .send({ title: 'Proposal', body: 'Review', recipientId: people.chief.id, requestId,
        attachmentIds: [documentId] }).expect(201)
    const url = `/letters/${sent.body.letter.id}/attachments/${documentId}/download`
    await request(payload).get(url).set(headers(people.chief.id)).expect(200)
    await pool.query('UPDATE dashboard.case_assignments SET active = false WHERE request_id = $1', [requestId])
    for (const target of [url, `/documents/${documentId}`, `/documents/${documentId}/download`]) {
      await request(payload).get(target).set(headers(people.chief.id)).expect(404)
    }
  })

  it('handles the full flow: secretariat requests supplementary docs, company replies with attachment, download works and enforces confidentiality', async () => {
    // 1. Company creates request and submits it
    const reqId = await createRequest(people.repA.id, 'پرونده رویداد')
    await submit(reqId, people.repA.id).expect(200)

    // Assign investment reviewer and chief
    await assign(reqId, people.chief.id, 'chief-reviewer').expect(201)
    await assign(reqId, people.investment.id, 'investment-reviewer').expect(201)

    // 2. Secretariat sends case-linked letter requesting supplementary documents
    const reqLetter = await request(payload)
      .post('/letters')
      .set(headers(people.secretariat.id))
      .send({
        title: 'درخواست مدارک مالی تکمیلی',
        body: 'لطفاً صورت‌های مالی تکمیلی را پیوست نمایید.',
        recipientId: people.repA.id,
        requestId: reqId,
        type: 'needs_fix',
      })
      .expect(201)

    expect(reqLetter.body.letter.type).toBe('needs_fix')
    expect(reqLetter.body.letter.requestId).toBe(reqId)

    // Company checks letters and sees the request letter
    const companyInbox = await request(payload)
      .get('/letters')
      .set(headers(people.repA.id))
      .expect(200)
    expect(companyInbox.body.total).toBe(2)
    expect(companyInbox.body.items.map((i: { title: string }) => i.title)).toContain('درخواست مدارک مالی تکمیلی')

    // 3. Company uploads correspondence attachment (allowed even when request is in_review)
    const uploadRes = await request(payload)
      .post('/documents')
      .set(headers(people.repA.id))
      .field('category', 'correspondenceAttachment')
      .field('requestId', reqId)
      .attach('file', pdf('financial-supplementary-evidence'), { filename: 'financial-evidence.pdf', contentType: 'application/pdf' })
      .expect(201)

    const docId = uploadRes.body.document.id as string
    expect(docId).toBeDefined()
    expect(uploadRes.body.document.filename).toBe('financial-evidence.pdf')
    expect(uploadRes.body.document.category).toBe('correspondenceAttachment')

    // 4. Company replies with a case-linked letter with the attachment attached
    const replyRes = await request(payload)
      .post('/letters')
      .set(headers(people.repA.id))
      .send({
        title: 'پاسخ به درخواست مدارک مالی',
        body: 'مدرک تکمیلی پیوست شد.',
        recipientId: people.secretariat.id,
        requestId: reqId,
        attachments: [docId],
      })
      .expect(201)

    const letterId = replyRes.body.letter.id as string
    expect(replyRes.body.letter.attachments).toHaveLength(1)
    expect(replyRes.body.letter.attachments[0].id).toBe(docId)
    expect(replyRes.body.letter.attachments[0].filename).toBe('financial-evidence.pdf')

    // 5. Secretariat opens letter and sees the attachment
    const secLetter = await request(payload)
      .get(`/letters/${letterId}`)
      .set(headers(people.secretariat.id))
      .expect(200)

    expect(secLetter.body.letter.attachments).toHaveLength(1)
    expect(secLetter.body.letter.attachments[0].id).toBe(docId)

    // 6. Secretariat downloads the attachment via /documents/:id/download
    const secDownload = await request(payload)
      .get(`/documents/${docId}/download`)
      .set(headers(people.secretariat.id))
      .expect(200)
    expect(secDownload.headers['content-type']).toBe('application/pdf')
    expect(secDownload.body.toString('ascii')).toContain('%PDF-1.7')

    // Secretariat downloads via /letters/:letterId/attachments/:attachmentId/download
    const secAttDownload = await request(payload)
      .get(`/letters/${letterId}/attachments/${docId}/download`)
      .set(headers(people.secretariat.id))
      .expect(200)
    expect(secAttDownload.headers['content-type']).toBe('application/pdf')

    // 7. Company (sender) can also download the attachment
    await request(payload)
      .get(`/documents/${docId}/download`)
      .set(headers(people.repA.id))
      .expect(200)

    // 8. Assignment alone cannot replace the still-undelivered financial handoff.
    await request(payload)
      .get(`/documents/${docId}/download`)
      .set(headers(people.investment.id))
      .expect(404)

    // 9. Confidentiality: Ordinary reviewer, chief reviewer, and employer reviewer CANNOT download it
    await request(payload)
      .get(`/documents/${docId}/download`)
      .set(headers(people.chief.id))
      .expect(404)

    // 10. Another company representative CANNOT download it
    await request(payload)
      .get(`/documents/${docId}/download`)
      .set(headers(people.repB.id))
      .expect(404)
    await request(payload)
      .get(`/letters/${letterId}/attachments/${docId}/download`)
      .set(headers(people.repB.id))
      .expect(404)
  })

  it('rejects invalid or unauthorized attachments during letter creation', async () => {
    const reqId = await createRequest(people.repA.id, 'پرونده دیگر')

    // Invalid UUID
    await request(payload)
      .post('/letters')
      .set(headers(people.repA.id))
      .send({
        title: 'خطا',
        body: 'پیوست نامعتبر',
        recipientId: people.secretariat.id,
        requestId: reqId,
        attachments: ['not-a-uuid'],
      })
      .expect(400)

    // Non-existent document UUID
    await request(payload)
      .post('/letters')
      .set(headers(people.repA.id))
      .send({
        title: 'خطا',
        body: 'پیوست پیدا نشد',
        recipientId: people.secretariat.id,
        requestId: reqId,
        attachments: ['00000000-0000-4000-8000-000000000999'],
      })
      .expect(404)

    // Document belongs to Company B, Company A tries to attach it
    const compB = (await companyStore.findByRepresentative(people.repB.id))!
    const compBDoc = await request(payload)
      .post('/documents')
      .set(headers(people.repB.id))
      .field('category', 'articlesOfAssociation')
      .field('companyId', compB.id)
      .attach('file', pdf('company-b-doc'), { filename: 'statute.pdf', contentType: 'application/pdf' })
      .expect(201)

    await request(payload)
      .post('/letters')
      .set(headers(people.repA.id))
      .send({
        title: 'دسترسی غیرمجاز',
        body: 'تلاش برای پیوست کردن مدرک شرکت دیگر',
        recipientId: people.secretariat.id,
        requestId: reqId,
        attachments: [compBDoc.body.document.id],
      })
      .expect(403)
  })
})
