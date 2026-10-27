import express, { type ErrorRequestHandler } from 'express'
import type { Pool } from 'pg'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import { createDashboardRouter } from '../src/dashboard/router.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

const id = '00000000-0000-4000-8000-000000000001'
const representativeRoutes = [
  ['post', '/requests'],
  ['get', '/requests'],
  ['get', `/requests/${id}`],
  ['get', `/requests/${id}/history`],
  ['post', `/requests/${id}/submit`],
  ['get', '/letters'],
  ['get', `/letters/${id}`],
  ['delete', `/letters/${id}`],
  ['get', '/stats'],
  ['get', '/stats/overview'],
  ['get', '/activities'],
] as const
const adminRoutes = [
  ['get', '/admin/requests'],
  ['get', `/admin/requests/${id}`],
] as const

function setup() {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const connect = vi.fn()
  const companyStore = new InMemoryCompanyStore([
    { name: 'Company', nationalId: '10000000001', representativeId: 'rep' },
  ])
  const app = express()
  app.use(express.json())
  app.use(createDashboardRouter({
    pool: { query, connect } as unknown as Pool,
    proxySecret: 'test-secret',
    userStore: new InMemoryUserStore([
      { id: 'rep', phone: '09000000001', operationalRole: 'representative', isActive: true },
      { id: 'admin', phone: '09000000002', operationalRole: 'system-owner', isActive: true },
    ]),
    companyStore,
    serviceCatalog: new InMemoryServiceCatalog([
      { id: 'service', key: 'service', title: 'Service', workflow: [], formFields: null },
    ]),
    privateDocumentStorage: new PrivateDocumentStorage('/unused-company-scope-test-storage'),
  }))
  const onError = vi.fn()
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    onError(error)
    res.status(503).json({ error: 'unavailable' })
  }
  app.use(errorHandler)
  return { app, query, connect, companyStore, onError }
}

describe('company-aware dashboard error forwarding over Express 4', () => {
  it.each(representativeRoutes)('forwards company lookup rejection once: %s %s', async (method, path) => {
    const { app, companyStore, query, connect, onError } = setup()
    const error = new Error('company lookup unavailable')
    const lookup = vi.spyOn(companyStore, 'findByRepresentative').mockRejectedValueOnce(error)

    await request(app)[method](path)
      .set({ 'x-internal-proxy-secret': 'test-secret', 'x-user-id': 'rep' })
      .send({ serviceId: 'service', title: 'Request' })
      .timeout({ response: 500, deadline: 1000 })
      .expect(503, { error: 'unavailable' })

    expect(lookup).toHaveBeenCalledExactlyOnceWith('rep')
    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    expect(onError.mock.calls[0]?.[0]).toBe(error)
    expect(query).not.toHaveBeenCalled()
    expect(connect).not.toHaveBeenCalled()
  })

  it.each([...representativeRoutes, ...adminRoutes])('forwards database rejection once: %s %s', async (method, path) => {
    const { app, query, connect, onError } = setup()
    const error = new Error('database unavailable')
    query.mockRejectedValue(error)
    connect.mockRejectedValue(error)

    await request(app)[method](path)
      .set({
        'x-internal-proxy-secret': 'test-secret',
        'x-user-id': path.startsWith('/admin/') ? 'admin' : 'rep',
      })
      .send({ serviceId: 'service', title: 'Request' })
      .timeout({ response: 500, deadline: 1000 })
      .expect(503, { error: 'unavailable' })

    expect(onError).toHaveBeenCalledExactlyOnceWith(error)
    expect(onError.mock.calls[0]?.[0]).toBe(error)
    expect(query.mock.calls.length + connect.mock.calls.length).toBeGreaterThan(0)
  })
})
