import express, { type NextFunction, type Request, type Response } from 'express'
import request from 'supertest'
import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { createDocumentRouter } from '../src/documents/router.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

const requestId = '00000000-0000-4000-8000-000000000001'
const malformedId = 'mobile-request-531620939'

function setup() {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const router = createDocumentRouter({
    pool: { query } as unknown as Pool,
    userStore: new InMemoryUserStore(),
    companyStore: new InMemoryCompanyStore(),
    privateDocumentStorage: new PrivateDocumentStorage('/unused-document-test-storage'),
  })
  const res = {
    locals: { actor: { id: 'owner', operationalRole: 'system-owner' } },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  const next = vi.fn<(error?: unknown) => void>() satisfies NextFunction
  async function invoke(method: string, path: string, input: Partial<Request>) {
    // Exercise the real final handler; multipart parsing has its own middleware.
    const route = router.stack.find((layer) => layer.route?.path === path && layer.route.stack.some((handler) => handler.method === method))!.route!
    await route.stack.at(-1)!.handle({ query: {}, body: {}, params: {}, ...input } as Request, res, next)
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  const app = express()
  app.use(express.json(), (_req, response, next) => {
    response.locals.actor = res.locals.actor
    next()
  })
  app.use(router)
  app.get('/health', (_req, response) => { response.json({ ok: true }) })
  const onError = vi.fn()
  app.use((error: unknown, _req: Request, response: Response, _next: NextFunction) => {
    onError(error)
    response.status(500).json({ error: 'internal_error' })
  })
  return { app, query, res, next, invoke, onError }
}

describe('document router input and error boundaries', () => {
  it.each(['chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer', 'representative'])(
    'historic letters cannot grant %s financial metadata or bytes', async (role) => {
      const { app, query, res } = setup()
      res.locals.actor = { id: 'other-user', operationalRole: role }
      const documentId = '00000000-0000-4000-8000-000000000002'
      query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM dashboard.private_documents')) return { rows: [{
          id: documentId, storage_key: 'private-key.pdf', category: 'financialStatements',
          original_filename: 'secret-finance.pdf', mime_type: 'application/pdf', size_bytes: 64,
          logical_version: 1, request_id: requestId, company_id: 'other-company', uploader_id: 'owner',
          created_at: new Date(), updated_at: new Date(), request_owner_id: 'original-owner',
          request_status: 'in_review', request_company_id: 'other-company',
        }] }
        // A historic letter and even an active assignment must not authorize finance.
        return { rows: [{ has_access: true }], rowCount: 1 }
      })
      for (const url of [`/documents/${documentId}`, `/documents/${documentId}/download`]) {
        await request(app).get(url).expect(404, { error: 'not_found' })
      }
      expect(query.mock.calls.every(([sql]) => !String(sql).includes('dashboard.letters'))).toBe(true)
    },
  )

  it('returns not_found for CI request over HTTP and stays healthy', async () => {
    const { app, query } = setup()
    await request(app).get('/documents').query({ requestId: malformedId }).expect(404, { error: 'not_found' })
    await request(app).post('/documents').field('category', 'proposal').field('requestId', malformedId)
      .expect(404, { error: 'not_found' })
    expect(query).not.toHaveBeenCalled()
    await request(app).get('/health').expect(200, { ok: true })
  })

  it.each(['list', 'upload', 'detail', 'download', 'delete'])('handles %s database rejection over Express 4 HTTP without losing health', async (operation) => {
    const { app, query, onError } = setup()
    const error = new Error('database unavailable')
    query.mockRejectedValueOnce(error)
    const agent = request(app)
    const response = operation === 'list'
      ? agent.get('/documents').query({ requestId })
      : operation === 'upload'
        ? agent.post('/documents').field('category', 'proposal').field('requestId', requestId)
        : operation === 'download'
          ? agent.get(`/documents/${requestId}/download`)
          : operation === 'delete'
            ? agent.delete(`/documents/${requestId}`)
            : agent.get(`/documents/${requestId}`)
    await response.timeout({ response: 1000, deadline: 2000 }).expect(500, { error: 'internal_error' })
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    await request(app).get('/health').expect(200, { ok: true })
  })

  it('preserves text company IDs instead of applying UUID validation', async () => {
    const { app, query } = setup()
    await request(app).get('/documents').query({ companyId: '123' }).expect(200, { items: [] })
    expect(query).toHaveBeenCalledWith(expect.any(String), ['123'])
  })
  it('rejects malformed request query IDs before querying Postgres', async () => {
    const { invoke, query, res } = setup()
    await invoke('get', '/documents', { query: { requestId: malformedId } })
    expect(query).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'not_found' })
  })

  it('rejects malformed upload request IDs before querying Postgres', async () => {
    const { invoke, query, res } = setup()
    await invoke('post', '/documents', { body: { category: 'proposal', requestId: malformedId } })
    expect(query).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'not_found' })
  })

  it.each([
    ['get', '/documents/:id'],
    ['get', '/documents/:id/download'],
    ['delete', '/documents/:id'],
  ])('rejects malformed document IDs before querying Postgres: %s %s', async (method, path) => {
    const { invoke, query, res } = setup()
    await invoke(method, path, { params: { id: malformedId } })
    expect(query).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'not_found' })
  })

  it.each([
    ['get', '/documents', { query: { requestId } }],
    ['post', '/documents', { body: { category: 'proposal', requestId } }],
    ['get', '/documents/:id', { params: { id: requestId } }],
    ['get', '/documents/:id/download', { params: { id: requestId } }],
    ['delete', '/documents/:id', { params: { id: requestId } }],
  ] as const)('forwards rejected database calls through next: %s %s', async (method, path, input) => {
    const { invoke, query, next } = setup()
    const error = new Error('database unavailable')
    query.mockRejectedValueOnce(error)
    await expect(invoke(method, path, input)).resolves.toBeUndefined()
    expect(next).toHaveBeenCalledExactlyOnceWith(error)
  })
})
