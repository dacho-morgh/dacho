import express, { type ErrorRequestHandler } from 'express'
import request from 'supertest'
import type { Pool } from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import { createDashboardRouter } from '../src/dashboard/router.js'
import { LetterRepository, type LetterDto } from '../src/dashboard/letter-repo.js'
import { AssignmentRepository } from '../src/dashboard/assignment-repo.js'
import { RequestRepository, type RequestDto } from '../src/dashboard/request-repo.js'
import { DocumentRepository, type PrivateDocumentRecord } from '../src/documents/repo.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

const requestId = '00000000-0000-4000-8000-000000000001'
const documentId = '00000000-0000-4000-8000-000000000002'
const letterId = '00000000-0000-4000-8000-000000000003'
const doc = { id: documentId, requestId, companyId: '1', requestCompanyId: '1',
  requestOwnerId: 'rep', category: 'financialStatements', filename: 'secret.pdf',
  mimeType: 'application/pdf', sizeBytes: 64, storageKey: 'private-key.pdf' } as PrivateDocumentRecord
const letter = { id: letterId, requestId, attachments: [{ id: documentId, filename: 'secret.pdf' }] } as LetterDto
const headers = (id: string) => ({ 'x-internal-proxy-secret': 'test-secret', 'x-user-id': id })
function setup() {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const storage = new PrivateDocumentStorage('/unused-letter-attachment-test')
  const read = vi.spyOn(storage, 'read').mockResolvedValue(Buffer.from('%PDF-test'))
  const app = express()
  app.use(express.json())
  app.use(createDashboardRouter({ pool: { query } as unknown as Pool, proxySecret: 'test-secret',
    userStore: new InMemoryUserStore([
      { id: 'sec', phone: '09000000001', operationalRole: 'central-secretariat', isActive: true },
      { id: 'chief', phone: '09000000002', operationalRole: 'chief-reviewer', isActive: true },
      { id: 'rep', phone: '09000000003', operationalRole: 'representative', isActive: true },
      { id: 'other-rep', phone: '09000000004', operationalRole: 'representative', isActive: true },
      { id: 'investment', phone: '09000000005', operationalRole: 'investment-reviewer', isActive: true },
      { id: 'owner', phone: '09000000006', operationalRole: 'system-owner', isActive: true },
    ]), companyStore: new InMemoryCompanyStore([
      { representativeId: 'rep' }, { representativeId: 'other-rep' },
    ]), serviceCatalog: new InMemoryServiceCatalog(),
    privateDocumentStorage: storage }))
  const onError = vi.fn()
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    onError(error)
    res.status(500).json({ error: 'internal_error' })
  }
  app.use(errorHandler)
  const findDocument = vi.spyOn(DocumentRepository.prototype, 'findById').mockResolvedValue(doc)
  const activeFor = vi.spyOn(AssignmentRepository.prototype, 'activeFor').mockResolvedValue(true)
  return { app, query, read, findDocument, activeFor, onError }
}
afterEach(() => vi.restoreAllMocks())
describe('letter attachment authorization at HTTP boundaries', () => {
  it.each([
    { attachmentIds: documentId }, { attachments: { id: documentId } },
    { attachmentIds: [null] }, { attachments: [{}] },
    { attachments: [documentId, 42] }, { attachmentIds: [{ id: documentId }] },
  ])('rejects malformed attachment input without sending a partial letter: %j', async (input) => {
    const { app, query, findDocument } = setup()
    vi.spyOn(LetterRepository.prototype, 'createScoped').mockResolvedValue(letter)
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'rep', requestId, ...input }).expect(400, { error: 'invalid_attachment' })
    expect(query).not.toHaveBeenCalled()
    expect(findDocument).not.toHaveBeenCalled()
  })
  it('denies investment access to supplementary finance before an authorized handoff', async () => {
    const { app, read, findDocument } = setup()
    findDocument.mockResolvedValue({ ...doc, category: 'correspondenceAttachment' })
    vi.spyOn(LetterRepository.prototype, 'findByIdScoped').mockResolvedValue(letter)
    vi.spyOn(LetterRepository.prototype, 'findByIdAndMarkReadScoped').mockResolvedValue(letter)
    for (const url of [`/documents/${documentId}`, `/documents/${documentId}/download`,
      `/letters/${letterId}/attachments/${documentId}/download`]) {
      await request(app).get(url).set(headers('investment')).expect(404)
    }
    const detail = await request(app).get(`/letters/${letterId}`).set(headers('investment')).expect(200)
    expect(detail.body.letter.attachments).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })
  it.each(['1', null])('keeps company dossier files on the owning company case (%s)', async (caseCompanyId) => {
    const { app, read, findDocument } = setup()
    findDocument.mockResolvedValue({ ...doc, requestId: null, category: 'articlesOfAssociation' })
    vi.spyOn(RequestRepository.prototype, 'findByIdScoped').mockResolvedValue({
      id: requestId, companyId: caseCompanyId, ownerId: 'rep',
    } as RequestDto)
    const create = vi.spyOn(LetterRepository.prototype, 'createScoped').mockResolvedValue(letter)
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'owner', requestId, attachmentIds: [documentId] }).expect(201)
    create.mockClear()
    vi.mocked(RequestRepository.prototype.findByIdScoped).mockResolvedValue({
      id: requestId, companyId: caseCompanyId === null ? null : '2', ownerId: 'other-rep',
    } as RequestDto)
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'owner', requestId, attachmentIds: [documentId] }).expect(403)
    expect(create).not.toHaveBeenCalled()
    vi.spyOn(LetterRepository.prototype, 'findByIdScoped').mockResolvedValue(letter)
    vi.spyOn(LetterRepository.prototype, 'findByIdAndMarkReadScoped').mockResolvedValue(letter)
    const detail = await request(app).get(`/letters/${letterId}`).set(headers('sec')).expect(200)
    expect(detail.body.letter.attachments).toEqual([])
    await request(app).get(`/letters/${letterId}/attachments/${documentId}/download`).set(headers('sec')).expect(404)
    expect(read).not.toHaveBeenCalled()
  })
  it('rejects a financial document sent to an assigned chief before inserting the letter', async () => {
    const { app, query } = setup()
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'chief', requestId, attachmentIds: [documentId] }).expect(403)
    expect(query).not.toHaveBeenCalled()
  })
  it('rejects a case document sent as a personal letter', async () => {
    const { app, query } = setup()
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'rep', attachmentIds: [documentId] }).expect(403)
    expect(query).not.toHaveBeenCalled()
  })
  it.each(['financialStatements', 'articlesOfAssociation'] as const)(
    'rejects a %s attachment sent to another company', async (category) => {
      const { app, query, findDocument } = setup()
      findDocument.mockResolvedValue({ ...doc, category,
        ...(category === 'articlesOfAssociation' ? { requestId: null } : {}) })
      await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
        recipientId: 'other-rep', ...(category === 'financialStatements' ? { requestId } : {}),
        attachmentIds: [documentId] }).expect(403)
      expect(query).not.toHaveBeenCalled()
    },
  )
  it('rejects an attachment linked to a different case', async () => {
    const { app, query } = setup()
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'rep', requestId: letterId, attachmentIds: [documentId] }).expect(403)
    expect(query).not.toHaveBeenCalled()
  })
  it('allows the owning company to send correspondence to Secretariat during review', async () => {
    const { app, findDocument } = setup()
    findDocument.mockResolvedValue({ ...doc, category: 'correspondenceAttachment', requestStatus: 'in_review' })
    const create = vi.spyOn(LetterRepository.prototype, 'createScoped').mockResolvedValue(letter)
    await request(app).post('/letters').set(headers('rep')).send({ title: 'Title', body: 'Body',
      recipientId: 'sec', requestId, attachmentIds: [documentId] }).expect(201)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ attachments: [expect.objectContaining({
      id: documentId, filename: doc.filename, size: '1 KB',
    })] }), { kind: 'company', userId: 'rep', companyId: '1' }, { kind: 'all' }, false)
  })
  it('allows Secretariat to send financial files to their owning company', async () => {
    const { app } = setup()
    const create = vi.spyOn(LetterRepository.prototype, 'createScoped').mockResolvedValue(letter)
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'rep', requestId, attachmentIds: [documentId] }).expect(201)
    expect(create).toHaveBeenCalledOnce()
  })
  it('accepts both attachment input forms and persists each document once', async () => {
    const { app, findDocument } = setup()
    const create = vi.spyOn(LetterRepository.prototype, 'createScoped').mockResolvedValue(letter)
    await request(app).post('/letters').set(headers('sec')).send({ title: 'Title', body: 'Body',
      recipientId: 'rep', requestId, attachmentIds: [documentId],
      attachments: [documentId, { id: documentId, filename: 'untrusted.pdf' }] }).expect(201)
    expect(findDocument).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]![0].attachments).toEqual([expect.objectContaining({
      id: documentId, filename: doc.filename,
    })])
  })
  it('denies legacy financial download despite current letter visibility, before reading storage', async () => {
    const { app, read } = setup()
    vi.spyOn(LetterRepository.prototype, 'findByIdScoped').mockResolvedValue(letter)
    await request(app).get(`/letters/${letterId}/attachments/${documentId}/download`)
      .set(headers('chief')).expect(404)
    expect(read).not.toHaveBeenCalled()
  })
  it('hides legacy financial metadata in letter detail and mailbox', async () => {
    const { app } = setup()
    vi.spyOn(LetterRepository.prototype, 'findByIdAndMarkReadScoped').mockResolvedValue(letter)
    vi.spyOn(LetterRepository.prototype, 'listScoped').mockResolvedValue({ items: [letter], total: 1, page: 1, totalPages: 1 })
    const detail = await request(app).get(`/letters/${letterId}`).set(headers('chief')).expect(200)
    const list = await request(app).get('/letters').set(headers('chief')).expect(200)
    expect(detail.body.letter.attachments).toEqual([])
    expect(list.body.items[0].attachments).toEqual([])
  })
  it('allows Secretariat to download a correctly associated financial attachment', async () => {
    const { app, read } = setup()
    vi.spyOn(LetterRepository.prototype, 'findByIdScoped').mockResolvedValue(letter)
    await request(app).get(`/letters/${letterId}/attachments/${documentId}/download`)
      .set(headers('sec')).expect(200)
    expect(read).toHaveBeenCalledWith(doc.storageKey)
  })
  it('revokes a historic attachment when its assignment ends even if the letter remains visible', async () => {
    const { app, read, findDocument, activeFor } = setup()
    // The mailbox remains visible; the case document must still be authorized independently.
    findDocument.mockResolvedValue({ ...doc, category: 'proposal' })
    vi.spyOn(LetterRepository.prototype, 'findByIdScoped').mockResolvedValue(letter)
    vi.spyOn(LetterRepository.prototype, 'findByIdAndMarkReadScoped').mockResolvedValue(letter)
    const url = `/letters/${letterId}/attachments/${documentId}/download`
    await request(app).get(url).set(headers('chief')).expect(200)
    activeFor.mockResolvedValue(false)
    read.mockClear()
    for (const target of [url, `/documents/${documentId}`, `/documents/${documentId}/download`]) {
      await request(app).get(target).set(headers('chief')).expect(404)
    }
    const detail = await request(app).get(`/letters/${letterId}`).set(headers('chief')).expect(200)
    expect(detail.body.letter.attachments).toEqual([])
    expect(read).not.toHaveBeenCalled()
  })
  it.each([null, letterId])('hides a case attachment from a legacy letter linked to %s', async (linkedRequest) => {
    const { app, read } = setup()
    const detachedLetter = { ...letter, requestId: linkedRequest }
    vi.spyOn(LetterRepository.prototype, 'findByIdScoped').mockResolvedValue(detachedLetter)
    vi.spyOn(LetterRepository.prototype, 'findByIdAndMarkReadScoped').mockResolvedValue(detachedLetter)
    const detail = await request(app).get(`/letters/${letterId}`).set(headers('sec')).expect(200)
    expect(detail.body.letter.attachments).toEqual([])
    await request(app).get(`/letters/${letterId}/attachments/${documentId}/download`).set(headers('sec')).expect(404)
    expect(read).not.toHaveBeenCalled()
  })
  it.each(['/letters', '/admin/letters'])('rehydrates authorized attachment metadata and display size for %s', async (route) => {
    const { app } = setup()
    const stored = { ...letter, attachments: [{ id: documentId, name: 'stale.pdf', size: 'wrong' }] }
    const page = { items: [stored], total: 1, page: 1, totalPages: 1 }
    vi.spyOn(LetterRepository.prototype, 'listScoped').mockResolvedValue(page)
    vi.spyOn(LetterRepository.prototype, 'listAll').mockResolvedValue(page)
    const response = await request(app).get(route).set(headers('sec')).expect(200)
    expect(response.body.items[0].attachments).toEqual([{
      id: documentId, name: doc.filename, filename: doc.filename, category: doc.category,
      mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, size: '1 KB',
      downloadUrl: `/api/dashboard/documents/${documentId}/download`,
    }])
  })
  it.each(['/admin/letters', `/admin/letters/${letterId}`])('forwards document-query failures to Express for %s', async (route) => {
    const { app, findDocument, onError } = setup()
    const error = new Error('document lookup unavailable')
    findDocument.mockRejectedValue(error)
    vi.spyOn(LetterRepository.prototype, 'listAll').mockResolvedValue({ items: [letter], total: 1, page: 1, totalPages: 1 })
    vi.spyOn(LetterRepository.prototype, 'findByIdAndMarkReadScoped').mockResolvedValue(letter)
    await request(app).get(route).set(headers('sec')).timeout(1000).expect(500)
    expect(onError).toHaveBeenCalledWith(error)
  })
})
