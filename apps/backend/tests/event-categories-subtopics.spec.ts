import { describe, expect, it, vi } from 'vitest'
import type { ErrorRequestHandler } from 'express'
import request from 'supertest'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../src/auth/user-store.js'
import { InMemoryEventStore } from '../src/dashboard/event-repo.js'
import {
  InMemoryEventCategoryStore,
  type EventCategoryStore,
} from '../src/dashboard/event-category-repo.js'
import { createTestApp, type TestApp } from './helpers.js'

const USERS: User[] = [
  { id: 'owner-1', phone: '09000000001', name: 'System Owner', operationalRole: 'system-owner', isActive: true },
  { id: 'secretariat-1', phone: '09000000002', name: 'Secretariat', operationalRole: 'central-secretariat', isActive: true },
  { id: 'chief-1', phone: '09000000003', name: 'Chief One', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'chief-2', phone: '09000000004', name: 'Chief Two', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment-1', phone: '09000000005', name: 'Investment One', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'reviewer-1', phone: '09000000006', name: 'Reviewer', operationalRole: 'reviewer', isActive: true },
  { id: 'employer-1', phone: '09000000007', name: 'Employer Reviewer One', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-2', phone: '09000000008', name: 'Employer Reviewer Two', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'employer-inactive', phone: '09000000009', name: 'Employer Inactive', operationalRole: 'employer-reviewer', isActive: false },
  { id: 'employer-company', phone: '09000000010', name: 'Employer With Company', operationalRole: 'employer-reviewer', isActive: true, companyId: 'company-1' },
  { id: 'rep-1', phone: '09000000011', name: 'Representative', operationalRole: 'representative', isActive: true, companyId: 'company-1' },
]

interface CategorySubtopicTestApp extends TestApp {
  eventStore: InMemoryEventStore
  categoryStore: InMemoryEventCategoryStore
  as: (userId: string) => Record<string, string>
}

async function createCategorySubtopicTestApp(): Promise<CategorySubtopicTestApp> {
  const userStore = new InMemoryUserStore(USERS)
  const eventStore = new InMemoryEventStore()
  const categoryStore = new InMemoryEventCategoryStore()
  const companyStore = new InMemoryCompanyStore([
    { name: 'Company One', nationalId: '10000000001', representativeId: 'rep-1' },
  ])
  const testApp = await createTestApp({
    userStore,
    eventStore,
    eventCategoryStore: categoryStore,
    companyStore,
  })
  return {
    ...testApp,
    eventStore,
    categoryStore,
    as: (userId) => ({
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': userId,
    }),
  }
}

async function seedEvent(eventStore: InMemoryEventStore, id = 'a0000000-0000-0000-0000-000000000001') {
  return eventStore.create({
    title: 'رویداد هوش مصنوعی',
    description: 'رویداد سالانه فناوری',
    registrationOpenAt: '2027-01-01T00:00:00.000Z',
    registrationCloseAt: '2027-02-01T00:00:00.000Z',
    responsibleChiefId: 'chief-1',
    responsibleInvestmentId: 'investment-1',
    createdBy: 'owner-1',
  })
}

describe('Event categories and subtopics (T17)', () => {
  describe('Authorization', () => {
    it('restricts category creation to system-owner', async () => {
      const { app, eventStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)

      const nonOwners = ['secretariat-1', 'chief-1', 'reviewer-1', 'employer-1', 'rep-1']
      for (const userId of nonOwners) {
        const res = await request(app)
          .post(`/admin/events/${event.id}/categories`)
          .set(as(userId))
          .send({ title: 'هوش مصنوعی' })
        expect(res.status).toBe(403)
      }

      const res = await request(app)
        .post(`/admin/events/${event.id}/categories`)
        .set(as('owner-1'))
        .send({ title: 'هوش مصنوعی' })
      expect(res.status).toBe(201)
    })

    it('restricts subtopic creation to system-owner', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'هوش مصنوعی')

      const resForbidden = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('secretariat-1'))
        .send({ title: 'پردازش زبان طبیعی', categoryId: cat.id, employerId: 'employer-1' })
      expect(resForbidden.status).toBe(403)

      const resAllowed = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({ title: 'پردازش زبان طبیعی', categoryId: cat.id, employerId: 'employer-1' })
      expect(resAllowed.status).toBe(201)
    })

    it('denies external representative from admin categories/subtopics', async () => {
      const { app, eventStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)

      const resCat = await request(app)
        .get(`/admin/events/${event.id}/categories`)
        .set(as('rep-1'))
      expect(resCat.status).toBe(403)

      const resSub = await request(app)
        .get(`/admin/events/${event.id}/subtopics`)
        .set(as('rep-1'))
      expect(resSub.status).toBe(403)
    })

    it('allows company representative to discover categories and subtopics via public participant endpoints', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'هوش مصنوعی')
      await categoryStore.createSubtopic({
        eventId: event.id,
        categoryId: cat.id,
        title: 'پردازش تصویر',
        employerId: 'employer-1',
      })

      const resCat = await request(app)
        .get(`/events/${event.id}/categories`)
        .set(as('rep-1'))
      expect(resCat.status).toBe(200)
      expect(resCat.body.items).toHaveLength(1)
      expect(resCat.body.items[0].title).toBe('هوش مصنوعی')

      const resSub = await request(app)
        .get(`/events/${event.id}/subtopics`)
        .set(as('rep-1'))
      expect(resSub.status).toBe(200)
      expect(resSub.body.items).toHaveLength(1)
      expect(resSub.body.items[0].title).toBe('پردازش تصویر')
      expect(resSub.body.items[0].categoryTitle).toBe('هوش مصنوعی')
    })
  })

  describe('Category validation', () => {
    it('rejects category creation with 404 for unknown or malformed eventId', async () => {
      const { app, as } = await createCategorySubtopicTestApp()

      const resInvalid = await request(app)
        .post('/admin/events/not-a-uuid/categories')
        .set(as('owner-1'))
        .send({ title: 'دسته تست' })
      expect(resInvalid.status).toBe(404)

      const resUnknown = await request(app)
        .post('/admin/events/00000000-0000-0000-0000-000000000000/categories')
        .set(as('owner-1'))
        .send({ title: 'دسته تست' })
      expect(resUnknown.status).toBe(404)
    })

    it('rejects empty, whitespace or non-string category title with 400 invalid_category', async () => {
      const { app, eventStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)

      const invalidTitles = ['', '   ', null, undefined, 123]
      for (const title of invalidTitles) {
        const res = await request(app)
          .post(`/admin/events/${event.id}/categories`)
          .set(as('owner-1'))
          .send({ title })
        expect(res.status).toBe(400)
        expect(res.body).toEqual({ error: 'invalid_category' })
      }
    })

    it('creates category successfully and lists categories in event', async () => {
      const { app, eventStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)

      const resCreate = await request(app)
        .post(`/admin/events/${event.id}/categories`)
        .set(as('owner-1'))
        .send({ title: '  فناوری زیستی  ' })
      expect(resCreate.status).toBe(201)
      expect(resCreate.body.category).toMatchObject({
        eventId: event.id,
        title: 'فناوری زیستی',
      })
      expect(resCreate.body.category.id).toBeDefined()

      const resList = await request(app)
        .get(`/admin/events/${event.id}/categories`)
        .set(as('owner-1'))
      expect(resList.status).toBe(200)
      expect(resList.body.items).toHaveLength(1)
      expect(resList.body.items[0].title).toBe('فناوری زیستی')
    })
  })

  describe('Subtopic and category/event relationship validation', () => {
    it('rejects subtopic creation with 404 if event does not exist', async () => {
      const { app, as } = await createCategorySubtopicTestApp()

      const res = await request(app)
        .post('/admin/events/00000000-0000-0000-0000-000000000000/subtopics')
        .set(as('owner-1'))
        .send({
          title: 'زیرعنوان ۱',
          categoryId: '00000000-0000-0000-0000-000000000001',
          employerId: 'employer-1',
        })
      expect(res.status).toBe(404)
    })

    it('rejects empty or whitespace subtopic title with 400 invalid_subtopic', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'فناوری اطلاعات')

      const res = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({ title: '   ', categoryId: cat.id, employerId: 'employer-1' })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'invalid_subtopic' })
    })

    it('rejects categoryId that does not exist with 400 invalid_category_event', async () => {
      const { app, eventStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)

      const res = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({
          title: 'زیرعنوان ۱',
          categoryId: '00000000-0000-0000-0000-000000000099',
          employerId: 'employer-1',
        })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'invalid_category_event' })
    })

    it('rejects categoryId belonging to a DIFFERENT event with 400 invalid_category_event', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event1 = await seedEvent(eventStore)
      const event2 = await eventStore.create({
        title: 'رویداد دوم',
        description: 'رویداد موازی',
        registrationOpenAt: '2027-01-01T00:00:00.000Z',
        registrationCloseAt: '2027-02-01T00:00:00.000Z',
        responsibleChiefId: 'chief-2',
        responsibleInvestmentId: 'investment-1',
        createdBy: 'owner-1',
      })

      // Category belongs to event2
      const catEvent2 = await categoryStore.createCategory(event2.id, 'دسته رویداد دو')

      // Attempt to create subtopic in event1 with category from event2
      const res = await request(app)
        .post(`/admin/events/${event1.id}/subtopics`)
        .set(as('owner-1'))
        .send({
          title: 'زیرعنوان نامعتبر',
          categoryId: catEvent2.id,
          employerId: 'employer-1',
        })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'invalid_category_event' })
    })
  })

  describe('Employer assignment validation (personal account only, no orgs, valid role)', () => {
    it('rejects subtopic creation when employer account does not exist with 400 ineligible_employer', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'فناوری سلامت')

      const res = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({
          title: 'تجهیزات پزشکی',
          categoryId: cat.id,
          employerId: 'non-existent-user',
        })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'ineligible_employer' })
    })

    it('rejects subtopic creation when employer is an organization/company or has companyId', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'فناوری سلامت')

      // 1. Direct company ID
      const resOrg = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({
          title: 'تجهیزات پزشکی',
          categoryId: cat.id,
          employerId: 'company-1',
        })
      expect(resOrg.status).toBe(400)
      expect(resOrg.body).toEqual({ error: 'ineligible_employer' })

      // 2. User account with associated companyId
      const resCompanyUser = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({
          title: 'تجهیزات پزشکی',
          categoryId: cat.id,
          employerId: 'employer-company',
        })
      expect(resCompanyUser.status).toBe(400)
      expect(resCompanyUser.body).toEqual({ error: 'ineligible_employer' })
    })

    it('rejects non-employer operational roles (reviewer, chief, representative, owner)', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'فناوری سلامت')

      const invalidRoleUsers = ['reviewer-1', 'chief-1', 'investment-1', 'owner-1', 'secretariat-1', 'rep-1']
      for (const userId of invalidRoleUsers) {
        const res = await request(app)
          .post(`/admin/events/${event.id}/subtopics`)
          .set(as('owner-1'))
          .send({
            title: 'تجهیزات پزشکی',
            categoryId: cat.id,
            employerId: userId,
          })
        expect(res.status).toBe(400)
        expect(res.body).toEqual({ error: 'ineligible_employer' })
      }
    })

    it('rejects inactive employer account', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'فناوری سلامت')

      const res = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({
          title: 'تجهیزات پزشکی',
          categoryId: cat.id,
          employerId: 'employer-inactive',
        })
      expect(res.status).toBe(400)
      expect(res.body).toEqual({ error: 'ineligible_employer' })
    })

    it('successfully creates subtopic when employer is a valid personal employer-reviewer account', async () => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'فناوری سلامت')

      const res = await request(app)
        .post(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
        .send({
          title: 'تجهیزات هوشمند جراحی',
          categoryId: cat.id,
          employerId: 'employer-1',
        })
      expect(res.status).toBe(201)
      expect(res.body.subtopic).toMatchObject({
        eventId: event.id,
        categoryId: cat.id,
        title: 'تجهیزات هوشمند جراحی',
        employerId: 'employer-1',
      })
      expect(res.body.subtopic.id).toBeDefined()

      // Verify list
      const resList = await request(app)
        .get(`/admin/events/${event.id}/subtopics`)
        .set(as('owner-1'))
      expect(resList.status).toBe(200)
      expect(resList.body.items).toHaveLength(1)
      expect(resList.body.items[0]).toMatchObject({
        id: res.body.subtopic.id,
        title: 'تجهیزات هوشمند جراحی',
        categoryTitle: 'فناوری سلامت',
        employerId: 'employer-1',
      })
    })
  })

  describe('Error forwarding', () => {
    it.each([
      ['get', '/admin/events/{eventId}/categories', 'listCategories'],
      ['post', '/admin/events/{eventId}/categories', 'createCategory'],
      ['get', '/admin/events/{eventId}/subtopics', 'listSubtopics'],
      ['post', '/admin/events/{eventId}/subtopics', 'createSubtopic'],
    ] as const)('forwards repository failure for %s %s (%s)', async (method, pathTemplate, op) => {
      const { app, eventStore, categoryStore, as } = await createCategorySubtopicTestApp()
      const event = await seedEvent(eventStore)
      const cat = await categoryStore.createCategory(event.id, 'دسته پایه')

      const failure = new Error('database connection lost')
      const errorHandler = vi.fn<ErrorRequestHandler>((error, _req, res, _next) => {
        res.status(503).json({ error: error.message })
      })
      app.use(errorHandler)
      vi.spyOn(categoryStore, op as any).mockRejectedValueOnce(failure)

      const path = pathTemplate.replace('{eventId}', event.id)
      const req = request(app)[method](path).set(as('owner-1'))
      if (method === 'post' && path.includes('categories')) {
        req.send({ title: 'دسته جدید' })
      } else if (method === 'post' && path.includes('subtopics')) {
        req.send({ title: 'زیرعنوان جدید', categoryId: cat.id, employerId: 'employer-1' })
      }

      const res = await req.timeout({ response: 500, deadline: 1000 })
      expect(res.status).toBe(503)
      expect(res.body).toEqual({ error: failure.message })
    })
  })
})
