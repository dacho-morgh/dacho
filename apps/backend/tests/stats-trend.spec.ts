import express from 'express'
import type { Pool } from 'pg'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import { createDashboardRouter } from '../src/dashboard/router.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

function setup(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue({ rows })
  const app = express()
  app.use(express.json())
  app.use(createDashboardRouter({
    pool: { query, connect: vi.fn() } as unknown as Pool,
    proxySecret: 'test-secret',
    userStore: new InMemoryUserStore([
      { id: 'rep', phone: '09000000001', operationalRole: 'representative', isActive: true },
      { id: 'owner', phone: '09000000002', operationalRole: 'system-owner', isActive: true },
    ]),
    companyStore: new InMemoryCompanyStore([
      { name: 'Company', nationalId: '10000000001', representativeId: 'rep' },
    ]),
    serviceCatalog: new InMemoryServiceCatalog([]),
    privateDocumentStorage: new PrivateDocumentStorage('/unused-stats-trend-test-storage'),
  }))
  return { app, query }
}

const as = (id: string) => ({ 'x-internal-proxy-secret': 'test-secret', 'x-user-id': id })

describe('GET /stats/trend', () => {
  it('returns per-day submission counts without caching', async () => {
    const { app, query } = setup([
      { day: '2026-10-03', submitted: 4, approved: 1 },
      { day: '2026-10-05', submitted: 2, approved: 2 },
    ])

    const response = await request(app).get('/stats/trend').set(as('owner')).expect(200)

    expect(response.body).toEqual({
      days: [
        { day: '2026-10-03', submitted: 4, approved: 1 },
        { day: '2026-10-05', submitted: 2, approved: 2 },
      ],
    })
    expect(response.headers['cache-control']).toBe('private, no-store, max-age=0')
    expect(query).toHaveBeenCalledOnce()
    const [sql, params] = query.mock.calls[0] ?? []
    expect(sql).toContain('GROUP BY 1')
    expect(params).toEqual([200])
  })

  it('narrows a company representative to their own rows', async () => {
    const { app, query } = setup()

    await request(app).get('/stats/trend').set(as('rep')).expect(200, { days: [] })

    const [sql, params] = query.mock.calls[0] ?? []
    expect(sql).toMatch(/company_id = \$1/)
    expect(params.at(-1)).toBe(200)
    expect(params).toContain('rep')
  })
})
