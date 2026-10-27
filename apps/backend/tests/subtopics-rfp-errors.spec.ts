import express, { type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { createSubtopicRouter } from '../src/dashboard/subtopics-router.js'
import { createRfpRouter } from '../src/dashboard/rfp-router.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

const eventId = randomUUID(), subtopicId = randomUUID(), versionId = randomUUID(), fileId = randomUUID()
const base = `/events/${eventId}/subtopics/${subtopicId}/rfp`
function fixture(role = 'system-owner') {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }
  const pool = { query, connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const userStore = new InMemoryUserStore([{ id: 'employer', phone: 'employer', operationalRole: 'employer-reviewer', isActive: true }])
  const companyStore = new InMemoryCompanyStore([{ name: 'Fixture', nationalId: 'fixture', representativeId: 'company' }])
  const storage = new PrivateDocumentStorage('/unused-unit-fixture')
  vi.spyOn(storage, 'save').mockResolvedValue(`${fileId}.pdf`)
  vi.spyOn(storage, 'remove').mockResolvedValue()
  const app = express().use(express.json()).use((_req, res, next) => {
    res.locals.actor = { id: role === 'representative' ? 'company' : 'owner', operationalRole: role }; next()
  })
  app.use(createSubtopicRouter({ pool, userStore, companyStore }))
  app.use(createRfpRouter({ pool, companyStore, privateDocumentStorage: storage }))
  const errorHandler = vi.fn<ErrorRequestHandler>((_error, _req, res, _next) => { res.status(503).json({ error: 'unavailable' }) })
  app.use(errorHandler)
  return { app, query, pool, client, userStore, companyStore, storage, errorHandler }
}
const failure = new Error('expected injected failure')
const bounded = { response: 500, deadline: 1500 }
const upload = (app: express.Express) => request(app).post(`/admin${base}`).field('expectedVersionId', '').field('reason', 'Initial').attach('files', Buffer.from('%PDF-Fixture'), { filename: 'fixture.pdf', contentType: 'application/pdf' }).timeout(bounded)

describe('subtopic/RFP Express 4 failure forwarding', () => {
  it.each([
    ['get', `/admin/events/${eventId}/categories`],
    ['post', `/admin/events/${eventId}/categories`],
    ['get', `/admin/events/${eventId}/subtopics`],
    ['post', `/admin/events/${eventId}/subtopics`],
    ['get', `/events/${eventId}/subtopics`],
    ['get', base],
  ] as const)('forwards %s %s SQL rejection once', async (method, path) => {
    const { app, query, errorHandler } = fixture()
    query.mockRejectedValueOnce(failure)
    const response = await request(app)[method](path).send({ title: 'Need', categoryId: randomUUID(), employerId: 'employer' }).timeout(bounded)
    expect(response.status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it('forwards current employer lookup failure', async () => {
    const { app, userStore, errorHandler } = fixture()
    vi.spyOn(userStore, 'findById').mockRejectedValueOnce(failure)
    const response = await request(app).post(`/admin/events/${eventId}/subtopics`).send({ title: 'Need', categoryId: randomUUID(), employerId: 'employer' }).timeout(bounded)
    expect(response.status).toBe(503)
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it.each([`/events/${eventId}/subtopics`, base, `/requests/${randomUUID()}/rfp`])('forwards current company lookup failure on %s', async (path) => {
    const { app, companyStore, errorHandler } = fixture('representative')
    vi.spyOn(companyStore, 'findByRepresentative').mockRejectedValueOnce(failure)
    expect((await request(app).get(path).timeout(bounded)).status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it.each([1, 2, 3])('forwards RFP read SQL failure at await %s', async (call) => {
    const { app, query, errorHandler } = fixture()
    query.mockResolvedValue({ rows: [{ id: versionId, storage_key: `${fileId}.pdf` }] })
    for (let n = 1; n < call; n++) query.mockResolvedValueOnce({ rows: [{ id: versionId, storage_key: `${fileId}.pdf`, event_id: eventId, subtopic_id: subtopicId, version_id: versionId, created_at: new Date(), updated_at: new Date(), submission_date: null, due_date: null }] })
    query.mockRejectedValueOnce(failure)
    const path = call === 3 ? `/requests/${randomUUID()}/rfp` : `${base}/${versionId}/files/${fileId}`
    expect((await request(app).get(path).timeout(bounded)).status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it('preserves original failure when private-file cleanup also fails', async () => {
    const { app, client, storage, errorHandler } = fixture()
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ current_rfp_version_id: null }] }).mockResolvedValueOnce({ rows: [{ id: versionId }] }).mockRejectedValueOnce(failure)
    vi.mocked(storage.remove).mockRejectedValueOnce(new Error('cleanup failed'))
    expect((await upload(app)).status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it.each([1, 2, 3, 4, 5, 6])('rolls back and forwards publishing SQL failure at await %s', async (call) => {
    const { app, client, storage, errorHandler } = fixture()
    const rows = [[], [{ current_rfp_version_id: null }], [{ id: versionId }], [{ id: fileId }], [], []]
    for (let n = 1; n < call; n++) client.query.mockResolvedValueOnce({ rows: rows[n - 1] })
    client.query.mockRejectedValueOnce(failure)
    expect((await upload(app)).status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
    expect(client.release).toHaveBeenCalledOnce()
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    if (call >= 4) expect(storage.remove).toHaveBeenCalledWith(`${fileId}.pdf`)
  })
})
