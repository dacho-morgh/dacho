import { describe, expect, it } from 'vitest'
import request from 'supertest'

import {
  allowedEventActions,
  canActOnEvent,
  isRegistrationOpen,
} from '../src/access/events.js'
import { InMemoryUserStore, type User } from '../src/auth/user-store.js'
import { InMemoryEventStore } from '../src/dashboard/event-repo.js'
import { createTestApp, type TestApp } from './helpers.js'

const USERS: User[] = [
  { id: 'owner-1', phone: '09000000001', name: 'System Owner', operationalRole: 'system-owner', isActive: true },
  { id: 'secretariat-1', phone: '09000000002', name: 'Secretariat', operationalRole: 'central-secretariat', isActive: true },
  { id: 'chief-1', phone: '09000000003', name: 'Chief One', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: '09000000004', name: 'Chief Two', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment-1', phone: '09000000005', name: 'Investment One', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'investment-2', phone: '09000000006', name: 'Investment Two', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: '09000000007', name: 'Reviewer', operationalRole: 'reviewer', isActive: true },
  { id: 'representative-1', phone: '09000000008', name: 'Representative', operationalRole: 'representative', isActive: true },
]

interface EventTestApp extends TestApp {
  eventStore: InMemoryEventStore
  as: (userId: string) => Record<string, string>
}

async function createEventTestApp(): Promise<EventTestApp> {
  const userStore = new InMemoryUserStore(USERS)
  const eventStore = new InMemoryEventStore()
  const testApp = await createTestApp({ userStore, eventStore })
  return {
    ...testApp,
    eventStore,
    as: (userId) => ({
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': userId,
    }),
  }
}

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'رویداد سرمایه‌گذاری',
    description: 'فرصت سرمایه‌گذاری در حوزه فناوری',
    registrationOpenAt: '2027-01-01T00:00:00.000Z',
    registrationCloseAt: '2027-02-01T00:00:00.000Z',
    responsibleChiefId: 'chief-1',
    responsibleInvestmentId: 'investment-1',
    ...overrides,
  }
}

describe('Event configuration', () => {
  it('lets the owner create, reload and update an event with its assignments', async () => {
    const { app, eventStore, as } = await createEventTestApp()

    const created = await request(app)
      .post('/admin/events')
      .set(as('owner-1'))
      .send(eventPayload())

    expect(created.status).toBe(201)
    expect(created.body.event).toMatchObject({
      title: 'رویداد سرمایه‌گذاری',
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      createdBy: 'owner-1',
      allowedActions: ['read', 'manage'],
    })
    const eventId = created.body.event.id as string

    const reloaded = await request(app).get(`/admin/events/${eventId}`).set(as('owner-1'))
    expect(reloaded.status).toBe(200)
    expect(reloaded.body.event).toMatchObject({
      id: eventId,
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
    })

    const updated = await request(app)
      .patch(`/admin/events/${eventId}`)
      .set(as('owner-1'))
      .send({ title: 'رویداد به‌روزشده', registrationCloseAt: '2027-03-01T00:00:00.000Z' })

    expect(updated.status).toBe(200)
    expect(updated.body.event).toMatchObject({
      title: 'رویداد به‌روزشده',
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      registrationCloseAt: '2027-03-01T00:00:00.000Z',
    })

    const persisted = await eventStore.findById(eventId)
    expect(persisted?.title).toBe('رویداد به‌روزشده')
    expect(persisted?.responsibleChiefId).toBe('chief-1')
    expect(persisted?.responsibleInvestmentId).toBe('investment-1')
  })

  it('rejects event configuration writes from every non-owner role', async () => {
    const { app, eventStore, as } = await createEventTestApp()
    const owners = ['secretariat-1', 'chief-1', 'investment-1', 'reviewer-1', 'representative-1']

    for (const actor of owners) {
      const response = await request(app).post('/admin/events').set(as(actor)).send(eventPayload())
      expect(response.status).toBe(403)
      expect(response.body).toEqual({ error: 'forbidden' })
    }
    expect(await eventStore.list()).toHaveLength(0)

    const created = await request(app)
      .post('/admin/events')
      .set(as('owner-1'))
      .send(eventPayload())
    const eventId = created.body.event.id as string

    for (const actor of owners) {
      const response = await request(app)
        .patch(`/admin/events/${eventId}`)
        .set(as(actor))
        .send({ title: 'تغییر غیرمجاز' })
      expect(response.status).toBe(403)
      expect(response.body).toEqual({ error: 'forbidden' })
    }
    expect((await eventStore.findById(eventId))?.title).toBe('رویداد سرمایه‌گذاری')
  })

  it('rejects missing fields and an invalid registration window', async () => {
    const { app, eventStore, as } = await createEventTestApp()

    const missing = await request(app).post('/admin/events').set(as('owner-1')).send({ title: 'ناقص' })
    expect(missing.status).toBe(400)
    expect(missing.body.error).toBe('invalid_event')
    expect(missing.body.fields).toEqual(
      expect.arrayContaining([
        'registrationOpenAt',
        'registrationCloseAt',
        'responsibleChiefId',
        'responsibleInvestmentId',
      ]),
    )

    const windows = [
      { registrationOpenAt: '2027-02-01T00:00:00.000Z', registrationCloseAt: '2027-01-01T00:00:00.000Z' },
      { registrationOpenAt: '2027-01-01T00:00:00.000Z', registrationCloseAt: '2027-01-01T00:00:00.000Z' },
      { registrationOpenAt: 'not-a-date', registrationCloseAt: '2027-01-01T00:00:00.000Z' },
    ]
    for (const window of windows) {
      const response = await request(app)
        .post('/admin/events')
        .set(as('owner-1'))
        .send(eventPayload(window))
      expect(response.status).toBe(400)
      expect(response.body).toEqual({ error: 'invalid_registration_window' })
    }
    expect(await eventStore.list()).toHaveLength(0)
  })

  it('rejects responsible people whose current role does not match the slot', async () => {
    const { app, as } = await createEventTestApp()

    const wrongChief = await request(app)
      .post('/admin/events')
      .set(as('owner-1'))
      .send(eventPayload({ responsibleChiefId: 'investment-1' }))
    expect(wrongChief.status).toBe(400)
    expect(wrongChief.body).toEqual({
      error: 'ineligible_responsible_person',
      field: 'responsibleChiefId',
    })

    const wrongInvestment = await request(app)
      .post('/admin/events')
      .set(as('owner-1'))
      .send(eventPayload({ responsibleInvestmentId: 'chief-1' }))
    expect(wrongInvestment.status).toBe(400)
    expect(wrongInvestment.body).toEqual({
      error: 'ineligible_responsible_person',
      field: 'responsibleInvestmentId',
    })
  })

  it('scopes event reads and actions to the assigned event', async () => {
    const { app, as } = await createEventTestApp()

    const first = await request(app)
      .post('/admin/events')
      .set(as('owner-1'))
      .send(eventPayload({ title: 'رویداد اول' }))
    const second = await request(app)
      .post('/admin/events')
      .set(as('owner-1'))
      .send(eventPayload({
        title: 'رویداد دوم',
        responsibleChiefId: 'chief-2',
        responsibleInvestmentId: 'investment-2',
      }))
    const firstId = first.body.event.id as string
    const secondId = second.body.event.id as string

    const chiefOne = await request(app).get('/admin/events').set(as('chief-1'))
    expect(chiefOne.status).toBe(200)
    expect(chiefOne.body.items.map((event: { id: string }) => event.id)).toEqual([firstId])
    expect(chiefOne.body.items[0].allowedActions).toEqual(['read'])
    expect((await request(app).get(`/admin/events/${secondId}`).set(as('chief-1'))).status).toBe(404)

    const chiefTwo = await request(app).get('/admin/events').set(as('chief-2'))
    expect(chiefTwo.body.items.map((event: { id: string }) => event.id)).toEqual([secondId])
    expect((await request(app).get(`/admin/events/${firstId}`).set(as('chief-2'))).status).toBe(404)

    const investmentOne = await request(app).get('/admin/events').set(as('investment-1'))
    expect(investmentOne.body.items.map((event: { id: string }) => event.id)).toEqual([firstId])
    expect(investmentOne.body.items[0].allowedActions).toEqual(['read'])

    const secretariat = await request(app).get('/admin/events').set(as('secretariat-1'))
    expect(secretariat.status).toBe(200)
    expect(secretariat.body.items).toHaveLength(2)
    expect(secretariat.body.items[0].allowedActions).toEqual(['read'])

    expect((await request(app).get('/admin/events').set(as('representative-1'))).status).toBe(403)
  })

  it('keeps event scope checks reusable for later event-owned resources', () => {
    const event = { id: 'event-1', responsibleChiefId: 'chief-1', responsibleInvestmentId: 'investment-1' }

    expect(canActOnEvent('chief-reviewer', 'chief-1', event, 'read')).toBe(true)
    expect(canActOnEvent('chief-reviewer', 'chief-2', event, 'read')).toBe(false)
    expect(canActOnEvent('investment-reviewer', 'investment-1', event, 'read')).toBe(true)
    expect(canActOnEvent('investment-reviewer', 'investment-2', event, 'read')).toBe(false)
    expect(canActOnEvent('system-owner', 'owner-1', event, 'manage')).toBe(true)
    expect(canActOnEvent('central-secretariat', 'secretariat-1', event, 'manage')).toBe(false)
    expect(allowedEventActions('reviewer', 'reviewer-1', event)).toEqual([])

    // The helper is exported for later endpoints; sanity-check it with an explicit clock.
    const atNoon = new Date('2026-10-26T12:00:00.000Z')
    expect(isRegistrationOpen(
      { registrationOpenAt: '2026-10-26T00:00:00.000Z', registrationCloseAt: '2026-10-26T23:59:59.000Z' },
      atNoon,
    )).toBe(true)
  })
})
