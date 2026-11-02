import express, { type ErrorRequestHandler } from 'express'
import type { Pool } from 'pg'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import { createDashboardRouter } from '../src/dashboard/router.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

/** Answers each statement by what it reads; `fail` makes the matching statement reject. */
function setup(fail?: RegExp) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (fail?.test(sql)) throw new Error('read failed')
    if (sql.includes('booth_reservations')) {
      return { rows: [{ attendance_pending: 2, receipt_due: 1, receipt_pending: 3, confirmed: 4, rejected: 0 }] }
    }
    if (sql.includes('case_assignments a')) return { rows: [{ not_started: 1, draft: 2, final: 3 }] }
    if (sql.includes('DISTINCT ON (v.company_id)')) return { rows: [{ status: 'pending', count: 5 }] }
    if (sql.includes('COUNT(*) AS total FROM dashboard.support_tickets')) return { rows: [{ total: 0 }] }
    return { rows: [] }
  })
  const app = express()
  app.use(express.json())
  app.use(createDashboardRouter({
    pool: { query, connect: vi.fn() } as unknown as Pool,
    proxySecret: 'test-secret',
    userStore: new InMemoryUserStore([
      { id: 'rep', phone: '09000000001', operationalRole: 'representative', isActive: true },
      { id: 'sec', phone: '09000000002', operationalRole: 'central-secretariat', isActive: true },
      { id: 'rev', phone: '09000000003', operationalRole: 'reviewer', isActive: true },
    ]),
    companyStore: new InMemoryCompanyStore([
      { name: 'Company', nationalId: '10000000001', representativeId: 'rep' },
    ]),
    serviceCatalog: new InMemoryServiceCatalog([]),
    privateDocumentStorage: new PrivateDocumentStorage('/unused-stats-overview-test-storage'),
  }))
  const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(503).json({ error: 'unavailable' })
  }
  app.use(errorHandler)
  return { app, query }
}

const as = (id: string) => ({ 'x-internal-proxy-secret': 'test-secret', 'x-user-id': id })
const keyed = (items: { key: string; count: number }[]) =>
  Object.fromEntries(items.map((item) => [item.key, item.count]))

describe('GET /stats/overview sections', () => {
  afterEach(() => vi.restoreAllMocks())

  it("gives the Secretariat booth queues it acts on and the charts of its work", async () => {
    const { app } = setup()
    const { body } = await request(app).get('/stats/overview').set(as('sec')).expect(200)

    expect(keyed(body.queues)).toMatchObject({ booth_attendance_pending: 2, booth_receipt_pending: 3 })
    expect(keyed(body.queues)).not.toHaveProperty('booth_receipt_due')
    expect(body.charts.map((chart: { key: string }) => chart.key)).toEqual(['company_verification', 'booth_requests'])
    expect(keyed(body.charts[0].slices)).toEqual({ pending: 5, returned: 0, approved: 0, rejected: 0 })
    expect(body.unavailable).toEqual([])
  })

  it('gives a company the receipt it owes, read inside its own company only', async () => {
    const { app, query } = setup()
    const { body } = await request(app).get('/stats/overview').set(as('rep')).expect(200)

    expect(keyed(body.queues)).toMatchObject({ booth_receipt_due: 1 })
    expect(keyed(body.queues)).not.toHaveProperty('booth_attendance_pending')
    const booth = query.mock.calls.find(([sql]) => String(sql).includes('booth_reservations'))
    expect(booth?.[0]).toContain('r.company_id = $1')
    expect(booth?.[1]).toHaveLength(1)
  })

  it("charts a reviewer's own evaluations by their own id and role", async () => {
    const { app, query } = setup()
    const { body } = await request(app).get('/stats/overview').set(as('rev')).expect(200)

    expect(body.charts).toEqual([
      { key: 'own_evaluations', slices: [
        { key: 'not_started', count: 1 }, { key: 'draft', count: 2 }, { key: 'final', count: 3 },
      ] },
    ])
    const own = query.mock.calls.find(([sql]) => String(sql).includes('case_assignments a'))
    expect(own?.[1]).toEqual(['rev', 'reviewer'])
  })

  it('names a failed section instead of reporting it as zero, and keeps the rest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { app } = setup(/booth_reservations/)
    const { body } = await request(app).get('/stats/overview').set(as('sec')).expect(200)

    expect(body.unavailable).toEqual(['booth_requests'])
    expect(keyed(body.queues)).not.toHaveProperty('booth_attendance_pending')
    expect(body.charts.map((chart: { key: string }) => chart.key)).toEqual(['company_verification'])
    expect(body.counts).toBeDefined()
  })

  it('still fails the whole read when the request counts fail', async () => {
    const { app } = setup(/FROM dashboard\.requests r/)
    await request(app).get('/stats/overview').set(as('sec')).expect(503)
  })
})
