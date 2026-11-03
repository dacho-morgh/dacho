import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../src/auth/user-store.js'
import { InMemoryEventStore } from '../src/dashboard/event-repo.js'
import { InMemoryBoothCatalogueRepository } from '../src/exhibitions/catalogue-repo.js'
import { InMemoryPublicRecordStore } from '../src/exhibitions/exhibition-store.js'
import { createTestApp } from './helpers.js'

/** S5 (#243): the owner manages events and exhibitions, public page included, without the CMS. */

const USERS: User[] = [
  { id: 'owner-1', phone: '09000000001', name: 'Owner', operationalRole: 'system-owner', isActive: true },
  { id: 'secretariat-1', phone: '09000000002', name: 'Secretariat', operationalRole: 'central-secretariat', isActive: true },
  { id: 'chief-1', phone: '09000000003', name: 'Chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'reviewer-1', phone: '09000000004', name: 'Reviewer', operationalRole: 'reviewer', isActive: true },
  { id: 'employer-1', phone: '09000000005', name: 'Employer', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'investment-1', phone: '09000000006', name: 'Investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'representative-1', phone: '09000000007', name: 'Company', operationalRole: 'representative', isActive: true },
]
const NON_OWNERS = USERS.filter((user) => user.operationalRole !== 'system-owner').map((user) => user.id)

const as = (userId: string) => ({ 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': userId })

const publicFields = {
  location: 'بوشهر، سالن همایش',
  startDate: '2027-03-01T08:00:00.000Z',
  endDate: '2027-03-02T16:00:00.000Z',
  status: 'upcoming' as const,
}

const eventBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'رویداد انرژی',
  description: 'خط اول\nخط دوم',
  registrationOpenAt: '2027-01-01T00:00:00.000Z',
  registrationCloseAt: '2027-02-01T00:00:00.000Z',
  responsibleChiefId: 'chief-1',
  responsibleInvestmentId: 'investment-1',
  ...publicFields,
  ...overrides,
})

const exhibitionBody = (overrides: Record<string, unknown> = {}) => ({
  title: 'نمایشگاه نفت و گاز',
  description: 'نمایشگاه سالانه',
  ...publicFields,
  companyBoothLimit: 2,
  guideMapReference: 'https://example.test/map.pdf',
  ...overrides,
})

async function setup() {
  const publicRecords = new InMemoryPublicRecordStore()
  const eventStore = new InMemoryEventStore()
  const boothCatalogue = new InMemoryBoothCatalogueRepository()
  const companyStore = new InMemoryCompanyStore([
    { name: 'شرکت نمونه', nationalId: '10000000001', representativeId: 'representative-1' },
  ])
  const { app } = await createTestApp({
    userStore: new InMemoryUserStore(USERS),
    companyStore,
    eventStore,
    boothCatalogue,
    publicRecords,
    exhibitionStore: publicRecords,
  })
  return { app, publicRecords, eventStore, boothCatalogue }
}

describe('owner event admin with its public page', () => {
  it('creates the public page with the event and links them', async () => {
    const { app, publicRecords } = await setup()
    const created = await request(app).post('/admin/events').set(as('owner-1')).send(eventBody()).expect(201)

    const pages = publicRecords.all('events')
    expect(pages).toHaveLength(1)
    expect(pages[0]).toMatchObject({ title: 'رویداد انرژی', description: 'خط اول\nخط دوم', ...publicFields })
    expect(created.body.event.publicEventId).toBe(pages[0]!.id)
    expect(created.body.event.public).toMatchObject({ id: pages[0]!.id, location: publicFields.location })

    const list = await request(app).get('/admin/events').set(as('owner-1')).expect(200)
    expect(list.headers['cache-control']).toContain('no-store')
    expect(list.body.items[0].public.id).toBe(pages[0]!.id)
    expect(list.body.unlinkedPublicEvents).toEqual([])

    // Companies choose an event by its public page and apply to the operational one.
    const forCompany = await request(app).get('/events').set(as('representative-1')).expect(200)
    expect(forCompany.body.items).toEqual([
      expect.objectContaining({ id: created.body.event.id, publicEventId: pages[0]!.id }),
    ])
  })

  it('writes neither record when the public page cannot be created', async () => {
    const { app, publicRecords, eventStore } = await setup()
    publicRecords.failNext.create = true
    const response = await request(app).post('/admin/events').set(as('owner-1')).send(eventBody()).expect(502)
    expect(response.body).toEqual({ error: 'public_record_failed' })
    expect(await eventStore.list()).toEqual([])
    expect(publicRecords.all('events')).toEqual([])
  })

  it('requires the public fields and an end after the start', async () => {
    const { app } = await setup()
    const missing = await request(app).post('/admin/events').set(as('owner-1'))
      .send(eventBody({ location: '', status: 'draft' })).expect(400)
    expect(missing.body).toEqual({ error: 'invalid_public_content', fields: ['location', 'status'] })
    const reversed = await request(app).post('/admin/events').set(as('owner-1'))
      .send(eventBody({ endDate: publicFields.startDate })).expect(400)
    expect(reversed.body).toEqual({ error: 'invalid_public_dates' })
  })

  it('edits both records together and refuses a stale revision', async () => {
    const { app, publicRecords } = await setup()
    const created = await request(app).post('/admin/events').set(as('owner-1')).send(eventBody()).expect(201)
    const id = created.body.event.id as string

    const edited = await request(app).patch(`/admin/events/${id}`).set(as('owner-1'))
      .send({ title: 'رویداد انرژی ۱۴۰۶', location: 'عسلویه', revision: 1, reason: 'تغییر محل' }).expect(200)
    expect(edited.body.event).toMatchObject({ title: 'رویداد انرژی ۱۴۰۶', revision: 2 })
    expect(publicRecords.all('events')[0]).toMatchObject({ title: 'رویداد انرژی ۱۴۰۶', location: 'عسلویه' })

    const stale = await request(app).patch(`/admin/events/${id}`).set(as('owner-1'))
      .send({ title: 'نسخه کهنه', revision: 1, reason: 'کهنه' }).expect(409)
    expect(stale.body).toEqual({ error: 'stale_event', revision: 2 })
    expect(publicRecords.all('events')[0]!.title).toBe('رویداد انرژی ۱۴۰۶')
  })

  it('keeps the event unchanged when the public page update fails', async () => {
    const { app, publicRecords, eventStore } = await setup()
    const created = await request(app).post('/admin/events').set(as('owner-1')).send(eventBody()).expect(201)
    publicRecords.failNext.update = true
    await request(app).patch(`/admin/events/${created.body.event.id}`).set(as('owner-1'))
      .send({ title: 'عنوان تازه', revision: 1, reason: 'تغییر' }).expect(502)
    expect((await eventStore.findById(created.body.event.id))?.revision).toBe(1)
    expect(publicRecords.all('events')[0]!.title).toBe('رویداد انرژی')
  })

  it('gives an event made before S5 its public page on the next save', async () => {
    const { app, eventStore, publicRecords } = await setup()
    const legacy = await eventStore.create({ ...eventBody(), createdBy: 'owner-1' })
    expect(legacy.publicEventId).toBeNull()

    const list = await request(app).get('/admin/events').set(as('owner-1')).expect(200)
    expect(list.body.items[0].public).toBeNull()
    // Without a page to fill them from, the public fields are required.
    await request(app).patch(`/admin/events/${legacy.id}`).set(as('owner-1'))
      .send({ title: 'قدیمی', revision: 1, reason: 'ساخت صفحه عمومی' }).expect(400)
    const saved = await request(app).patch(`/admin/events/${legacy.id}`).set(as('owner-1'))
      .send({ ...publicFields, revision: 1, reason: 'ساخت صفحه عمومی' }).expect(200)
    expect(saved.body.event.publicEventId).toBe(publicRecords.all('events')[0]!.id)
  })

  it('takes over a public event made in the CMS instead of making a second page', async () => {
    const { app, publicRecords } = await setup()
    const page = publicRecords.seed('events', { title: 'از CMS', description: '', ...publicFields, status: 'ongoing' })
    const listed = await request(app).get('/admin/events').set(as('owner-1')).expect(200)
    expect(listed.body.unlinkedPublicEvents).toEqual([expect.objectContaining({ id: page.id })])

    const adopted = await request(app).post('/admin/events').set(as('owner-1'))
      .send(eventBody({ publicEventId: page.id })).expect(201)
    expect(adopted.body.event.publicEventId).toBe(page.id)
    expect(publicRecords.all('events')).toHaveLength(1)
    expect(publicRecords.all('events')[0]!.title).toBe('رویداد انرژی')

    const again = await request(app).post('/admin/events').set(as('owner-1'))
      .send(eventBody({ publicEventId: page.id })).expect(409)
    expect(again.body).toEqual({ error: 'public_event_linked' })
    await request(app).post('/admin/events').set(as('owner-1'))
      .send(eventBody({ publicEventId: '999' })).expect(404)
  })
})

describe('owner exhibition admin', () => {
  it('creates the public page and the booth settings together', async () => {
    const { app, publicRecords, boothCatalogue } = await setup()
    const created = await request(app).post('/admin/exhibitions').set(as('owner-1')).send(exhibitionBody()).expect(201)
    const id = created.body.exhibition.id as string
    expect(created.body.exhibition).toMatchObject({
      title: 'نمایشگاه نفت و گاز', companyBoothLimit: 2, revision: 1, boothCount: 0,
    })
    expect(publicRecords.all('exhibitions')).toHaveLength(1)
    expect(await boothCatalogue.getSettings(id)).toMatchObject({ companyBoothLimit: 2 })

    const list = await request(app).get('/admin/exhibitions').set(as('owner-1')).expect(200)
    expect(list.headers['cache-control']).toContain('no-store')
    expect(list.body.items).toEqual([expect.objectContaining({ id, companyBoothLimit: 2 })])
    const one = await request(app).get(`/admin/exhibitions/${id}`).set(as('owner-1')).expect(200)
    expect(one.body.exhibition).toMatchObject({ id, guideMapReference: 'https://example.test/map.pdf' })
  })

  it('writes neither record when the public page cannot be created', async () => {
    const { app, publicRecords, boothCatalogue } = await setup()
    publicRecords.failNext.create = true
    await request(app).post('/admin/exhibitions').set(as('owner-1')).send(exhibitionBody()).expect(502)
    expect(publicRecords.all('exhibitions')).toEqual([])
    expect(await boothCatalogue.listAdminSummaries()).toEqual([])
  })

  it('removes the new public page when the booth settings cannot be written', async () => {
    const { app, publicRecords, boothCatalogue } = await setup()
    // Settings already stored under the id the CMS will hand out next.
    await boothCatalogue.upsertSettings('1', { companyBoothLimit: 9, guideMapReference: null }, 'owner-1')
    const response = await request(app).post('/admin/exhibitions').set(as('owner-1')).send(exhibitionBody()).expect(409)
    expect(response.body).toEqual({ error: 'exhibition_settings_conflict' })
    expect(publicRecords.all('exhibitions')).toEqual([])
    expect((await boothCatalogue.getSettings('1'))?.companyBoothLimit).toBe(9)
  })

  it('edits both records, refuses a stale revision and rolls settings back on a CMS failure', async () => {
    const { app, publicRecords, boothCatalogue } = await setup()
    const created = await request(app).post('/admin/exhibitions').set(as('owner-1')).send(exhibitionBody()).expect(201)
    const id = created.body.exhibition.id as string

    const edited = await request(app).patch(`/admin/exhibitions/${id}`).set(as('owner-1'))
      .send({ title: 'نمایشگاه ۱۴۰۶', companyBoothLimit: 3, revision: 1 }).expect(200)
    expect(edited.body.exhibition).toMatchObject({ title: 'نمایشگاه ۱۴۰۶', companyBoothLimit: 3, revision: 2 })

    const stale = await request(app).patch(`/admin/exhibitions/${id}`).set(as('owner-1'))
      .send({ title: 'کهنه', revision: 1 }).expect(409)
    expect(stale.body).toEqual({ error: 'stale_exhibition', revision: 2 })

    publicRecords.failNext.update = true
    await request(app).patch(`/admin/exhibitions/${id}`).set(as('owner-1'))
      .send({ companyBoothLimit: 7, revision: 2 }).expect(502)
    expect(await boothCatalogue.getSettings(id)).toMatchObject({ companyBoothLimit: 3, revision: 2 })
    expect(publicRecords.all('exhibitions')[0]!.title).toBe('نمایشگاه ۱۴۰۶')
  })

  it('adds booth settings to an exhibition made in the CMS before S5', async () => {
    const { app, publicRecords } = await setup()
    const page = publicRecords.seed('exhibitions', { title: 'قدیمی', description: '', ...publicFields })
    const list = await request(app).get('/admin/exhibitions').set(as('owner-1')).expect(200)
    expect(list.body.items[0]).toMatchObject({ id: page.id, revision: 0, companyBoothLimit: null })

    await request(app).patch(`/admin/exhibitions/${page.id}`).set(as('owner-1')).send({ revision: 0 }).expect(400)
    const saved = await request(app).patch(`/admin/exhibitions/${page.id}`).set(as('owner-1'))
      .send({ companyBoothLimit: 1, revision: 0 }).expect(200)
    expect(saved.body.exhibition).toMatchObject({ companyBoothLimit: 1, revision: 1 })
  })

  it('validates input and answers 404 for unknown exhibitions', async () => {
    const { app } = await setup()
    const invalid = await request(app).post('/admin/exhibitions').set(as('owner-1'))
      .send(exhibitionBody({ title: ' ', companyBoothLimit: 0 })).expect(400)
    expect(invalid.body).toEqual({ error: 'invalid_public_content', fields: ['title'] })
    await request(app).post('/admin/exhibitions').set(as('owner-1'))
      .send(exhibitionBody({ companyBoothLimit: 0 })).expect(400)
    await request(app).get('/admin/exhibitions/404').set(as('owner-1')).expect(404)
    await request(app).get('/admin/exhibitions/..%2Fx').set(as('owner-1')).expect(404)
    await request(app).patch('/admin/exhibitions/404').set(as('owner-1')).send({ revision: 0 }).expect(404)
  })
})

describe('owner-only access', () => {
  it.each(NON_OWNERS)('refuses %s on every owner admin write and the exhibition reads', async (userId) => {
    const { app, publicRecords, eventStore } = await setup()
    const page = publicRecords.seed('exhibitions', { title: 'نمایشگاه', description: '', ...publicFields })
    const event = await eventStore.create({ ...eventBody(), createdBy: 'owner-1' })

    await request(app).post('/admin/events').set(as(userId)).send(eventBody()).expect(403)
    await request(app).patch(`/admin/events/${event.id}`).set(as(userId))
      .send({ ...eventBody(), revision: 1, reason: 'x' }).expect(403)
    await request(app).get('/admin/exhibitions').set(as(userId)).expect(403)
    await request(app).get(`/admin/exhibitions/${page.id}`).set(as(userId)).expect(403)
    await request(app).post('/admin/exhibitions').set(as(userId)).send(exhibitionBody()).expect(403)
    await request(app).patch(`/admin/exhibitions/${page.id}`).set(as(userId)).send({ title: 'x', revision: 0 }).expect(403)

    expect(publicRecords.all('events')).toEqual([])
    expect(publicRecords.all('exhibitions')).toHaveLength(1)
    expect((await eventStore.findById(event.id))?.revision).toBe(1)
  })

  it('does not show the CMS pages to roles that only read events', async () => {
    const { app, eventStore } = await setup()
    await eventStore.create({ ...eventBody(), createdBy: 'owner-1' })
    const secretariat = await request(app).get('/admin/events').set(as('secretariat-1')).expect(200)
    expect(secretariat.body.unlinkedPublicEvents).toBeUndefined()
    expect(secretariat.body.items[0].public).toBeUndefined()
  })
})
