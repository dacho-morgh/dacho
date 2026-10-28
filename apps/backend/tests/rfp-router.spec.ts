import express, { type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { randomUUID } from 'node:crypto'
import { createRfpRouter } from '../src/dashboard/rfp-router.js'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

const eventId = randomUUID(), subtopicId = randomUUID(), versionId = randomUUID(), fileId = randomUUID()
const base = `/events/${eventId}/subtopics/${subtopicId}/rfp`

function fixture(role = 'system-owner') {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }
  const pool = { query, connect: vi.fn().mockResolvedValue(client) } as unknown as Pool
  const companyStore = new InMemoryCompanyStore([{ name: 'Fixture', nationalId: 'fixture', representativeId: 'company' }])
  const storage = new PrivateDocumentStorage('/unused-unit-fixture')
  vi.spyOn(storage, 'save').mockResolvedValue(`${fileId}.pdf`)
  vi.spyOn(storage, 'remove').mockResolvedValue()
  const app = express().use(express.json()).use((_req, res, next) => {
    res.locals.actor = { id: role === 'representative' ? 'company' : 'owner', operationalRole: role }
    next()
  })
  app.use(createRfpRouter({ pool, companyStore, privateDocumentStorage: storage }))
  const errorHandler = vi.fn<ErrorRequestHandler>((_error, _req, res, _next) => {
    res.status(503).json({ error: 'unavailable' })
  })
  app.use(errorHandler)
  return { app, query, pool, client, companyStore, storage, errorHandler }
}

const failure = new Error('expected injected failure')
const bounded = { response: 500, deadline: 1500 }
const upload = (app: express.Express) =>
  request(app)
    .post(`/admin${base}`)
    .field('expectedVersionId', '')
    .field('reason', 'Initial')
    .attach('files', Buffer.from('%PDF-Fixture'), { filename: 'fixture.pdf', contentType: 'application/pdf' })
    .timeout(bounded)

describe('RFP router unit and failure forwarding (T18)', () => {
  it('denies non-owner on admin RFP publishing', async () => {
    const { app } = fixture('representative')
    const response = await upload(app)
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'forbidden' })
  })

  it('forwards get RFP SQL rejection to error middleware', async () => {
    const { app, query, errorHandler } = fixture()
    query.mockRejectedValueOnce(failure)
    const response = await request(app).get(base).timeout(bounded)
    expect(response.status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it('forwards company lookup failure on company RFP read', async () => {
    const { app, companyStore, errorHandler } = fixture('representative')
    vi.spyOn(companyStore, 'findByRepresentative').mockRejectedValueOnce(failure)
    const response = await request(app).get(base).timeout(bounded)
    expect(response.status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it('forwards file download SQL failure to error middleware', async () => {
    const { app, query, errorHandler } = fixture()
    query.mockResolvedValueOnce({ rows: [{ id: versionId }] })
    query.mockRejectedValueOnce(failure)
    const response = await request(app).get(`${base}/${versionId}/files/${fileId}`).timeout(bounded)
    expect(response.status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it('preserves original error when cleanup on storage failure also fails', async () => {
    const { app, client, storage, errorHandler } = fixture()
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ current_rfp_version_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: versionId }] })
      .mockRejectedValueOnce(failure)
    vi.mocked(storage.remove).mockRejectedValueOnce(new Error('cleanup failed'))
    const response = await upload(app)
    expect(response.status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
  })

  it.each([1, 2, 3, 4, 5, 6])('rolls back and forwards publishing SQL failure at step %s', async (call) => {
    const { app, client, storage, errorHandler } = fixture()
    const rows = [[], [{ current_rfp_version_id: null }], [{ id: versionId }], [{ id: fileId }], [], []]
    for (let n = 1; n < call; n++) client.query.mockResolvedValueOnce({ rows: rows[n - 1] })
    client.query.mockRejectedValueOnce(failure)
    const response = await upload(app)
    expect(response.status).toBe(503)
    expect(errorHandler).toHaveBeenCalledOnce()
    expect(errorHandler.mock.calls[0]?.[0]).toBe(failure)
    expect(client.release).toHaveBeenCalledOnce()
    expect(client.query).toHaveBeenCalledWith('ROLLBACK')
    if (call >= 4) expect(storage.remove).toHaveBeenCalledWith(`${fileId}.pdf`)
  })
})
