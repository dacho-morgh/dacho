import express from 'express'
import type { Pool } from 'pg'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import type { EventStore } from '../src/dashboard/event-repo.js'
import { createDashboardRouter } from '../src/dashboard/router.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'

const OPEN = '11111111-1111-4111-8111-111111111111'
const OPEN_TOO = '22222222-2222-4222-8222-222222222222'
const CLOSED = '33333333-3333-4333-8333-333333333333'
const PRIVATE = '44444444-4444-4444-8444-444444444444'
const future = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

function setup(seenEvents: number) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('COUNT(*) FILTER (WHERE NOT l.read)')) return { rows: [{ unread: '2', action_required: '0' }] }
    if (sql.includes('COUNT(*) AS total FROM dashboard.support_tickets')) return { rows: [{ total: '1' }] }
    if (sql.includes('FROM dashboard.event_views')) return { rows: [{ seen: String(seenEvents) }] }
    return { rows: [] }
  })
  const eventStore = {
    list: async () => [
      { id: OPEN, publicEventId: 'a', registrationCloseAt: future },
      { id: OPEN_TOO, publicEventId: 'b', registrationCloseAt: future },
      { id: CLOSED, publicEventId: 'c', registrationCloseAt: past },
      { id: PRIVATE, publicEventId: null, registrationCloseAt: future },
    ],
  } as unknown as EventStore
  const app = express()
  app.use(express.json())
  app.use(createDashboardRouter({
    pool: { query, connect: vi.fn() } as unknown as Pool,
    proxySecret: 'test-secret',
    eventStore,
    userStore: new InMemoryUserStore([
      { id: 'rep', phone: '09000000001', operationalRole: 'representative', isActive: true },
      { id: 'sec', phone: '09000000002', operationalRole: 'central-secretariat', isActive: true },
    ]),
    companyStore: new InMemoryCompanyStore([{ name: 'Company', nationalId: '10000000001', representativeId: 'rep' }]),
    serviceCatalog: new InMemoryServiceCatalog([]),
    privateDocumentStorage: new PrivateDocumentStorage('/unused-nav-counts-test-storage'),
  }))
  return app
}

const as = (id: string) => ({ 'x-internal-proxy-secret': 'test-secret', 'x-user-id': id })

describe('GET /nav-counts', () => {
  it("counts a company's unread mail with its unopened support answers, and its events not yet opened", async () => {
    const { body } = await request(setup(1)).get('/nav-counts').set(as('rep')).expect(200)

    // 2 unread letters + 1 unread ticket; the verification is unsent, so one request waits on the company.
    expect(body.letters).toBe(3)
    expect(body.requests).toBe(1)
    // Two open events with a public page, one of them already opened.
    expect(body.events).toBe(1)
  })

  it('has no event count for a role that is not a company', async () => {
    const { body } = await request(setup(0)).get('/nav-counts').set(as('sec')).expect(200)

    expect(body.events).toBe(0)
    expect(body.letters).toBe(2)
  })
})

describe('POST /events/:eventId/seen', () => {
  it('is for companies only', async () => {
    const app = setup(0)
    await request(app).post(`/events/${OPEN}/seen`).set(as('sec')).expect(403)
  })
})
