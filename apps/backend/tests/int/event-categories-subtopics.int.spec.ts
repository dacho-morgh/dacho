import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import request from 'supertest'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore, type User } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { EventRepository } from '../../src/dashboard/event-repo.js'
import { EventCategoryRepository } from '../../src/dashboard/event-category-repo.js'
import { runMigrations } from '../../src/db/migrate.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://phase0_test:phase0_test_only@127.0.0.1:55439/dacho_phase0_test'
const pool = new Pool({ connectionString, application_name: 'event-categories-integration' })
const PROXY_SECRET = 'test-internal-proxy-secret'

const USERS: User[] = [
  { id: 'owner-1', phone: '09000000001', name: 'Owner', operationalRole: 'system-owner', isActive: true },
  { id: 'secretariat-1', phone: '09000000002', name: 'Secretariat', operationalRole: 'central-secretariat', isActive: true },
  { id: 'chief-1', phone: '09000000003', name: 'Chief', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment-1', phone: '09000000004', name: 'Investment', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'employer-1', phone: '09000000005', name: 'Employer Reviewer', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'rep-1', phone: '09000000006', name: 'Representative', operationalRole: 'representative', isActive: true, companyId: 'company-1' },
]

function authHeaders(userId: string) {
  return { 'x-internal-proxy-secret': PROXY_SECRET, 'x-user-id': userId }
}

async function createAppUnderTest() {
  const jwt = await JwtSigner.create('test-kid')
  return createApp({
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    jwt,
    userStore: new InMemoryUserStore(USERS),
    companyStore: new InMemoryCompanyStore([
      { name: 'Company 1', nationalId: '10000000001', representativeId: 'rep-1' },
    ]),
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: PROXY_SECRET,
  })
}

describe('event categories and subtopics integration (PostgreSQL)', () => {
  let eventRepo: EventRepository
  let categoryRepo: EventCategoryRepository

  beforeAll(async () => {
    await runMigrations(connectionString)
    eventRepo = new EventRepository(pool)
    categoryRepo = new EventCategoryRepository(pool)
  })

  beforeEach(async () => {
    await pool.query('DELETE FROM dashboard.event_subtopics')
    await pool.query('DELETE FROM dashboard.event_categories')
    await pool.query('DELETE FROM dashboard.events')
  })

  afterAll(async () => {
    await pool.end()
  })

  it('persists categories and subtopics with relational integrity and cascade deletion', async () => {
    const event = await eventRepo.create({
      title: 'رویداد فناوری',
      description: 'شرح رویداد',
      registrationOpenAt: '2027-01-01T00:00:00.000Z',
      registrationCloseAt: '2027-02-01T00:00:00.000Z',
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      createdBy: 'owner-1',
    })

    const cat = await categoryRepo.createCategory(event.id, 'هوش مصنوعی')
    expect(cat.id).toBeDefined()
    expect(cat.eventId).toBe(event.id)
    expect(cat.title).toBe('هوش مصنوعی')

    const sub = await categoryRepo.createSubtopic({
      eventId: event.id,
      categoryId: cat.id,
      title: 'یادگیری ماشین',
      employerId: 'employer-1',
    })
    expect(sub.id).toBeDefined()
    expect(sub.eventId).toBe(event.id)
    expect(sub.categoryId).toBe(cat.id)
    expect(sub.employerId).toBe('employer-1')

    const subtopics = await categoryRepo.listSubtopics(event.id)
    expect(subtopics).toHaveLength(1)
    expect(subtopics[0]!.categoryTitle).toBe('هوش مصنوعی')
    expect(subtopics[0]!.title).toBe('یادگیری ماشین')

    // Cascade deletion
    await pool.query('DELETE FROM dashboard.events WHERE id = $1', [event.id])
    const categoriesAfter = await categoryRepo.listCategories(event.id)
    const subtopicsAfter = await categoryRepo.listSubtopics(event.id)
    expect(categoriesAfter).toHaveLength(0)
    expect(subtopicsAfter).toHaveLength(0)
  })

  it('enforces database-level foreign key constraint preventing cross-event subtopics', async () => {
    const event1 = await eventRepo.create({
      title: 'رویداد اول',
      description: 'شرح ۱',
      registrationOpenAt: '2027-01-01T00:00:00.000Z',
      registrationCloseAt: '2027-02-01T00:00:00.000Z',
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      createdBy: 'owner-1',
    })
    const event2 = await eventRepo.create({
      title: 'رویداد دوم',
      description: 'شرح ۲',
      registrationOpenAt: '2027-01-01T00:00:00.000Z',
      registrationCloseAt: '2027-02-01T00:00:00.000Z',
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      createdBy: 'owner-1',
    })

    const cat1 = await categoryRepo.createCategory(event1.id, 'دسته رویداد یک')

    // Direct SQL insert attempting to link event2 to cat1 (which belongs to event1)
    await expect(
      pool.query(
        `INSERT INTO dashboard.event_subtopics (event_id, category_id, title, employer_id)
         VALUES ($1, $2, $3, $4)`,
        [event2.id, cat1.id, 'زیرعنوان ناسازگار', 'employer-1'],
      ),
    ).rejects.toThrow()
  })

  it('manages categories and subtopics via HTTP API backed by real database', async () => {
    const app = await createAppUnderTest()
    const event = await eventRepo.create({
      title: 'رویداد سلامت',
      description: 'نوآوری در سلامت',
      registrationOpenAt: '2027-01-01T00:00:00.000Z',
      registrationCloseAt: '2027-02-01T00:00:00.000Z',
      responsibleChiefId: 'chief-1',
      responsibleInvestmentId: 'investment-1',
      createdBy: 'owner-1',
    })

    // 1. Create category
    const createCatRes = await request(app)
      .post(`/admin/events/${event.id}/categories`)
      .set(authHeaders('owner-1'))
      .send({ title: 'تجهیزات پزشکی' })
    expect(createCatRes.status).toBe(201)
    const categoryId = createCatRes.body.category.id

    // 2. Create subtopic with employer
    const createSubRes = await request(app)
      .post(`/admin/events/${event.id}/subtopics`)
      .set(authHeaders('owner-1'))
      .send({
        title: 'دستگاه‌های تصویربرداری',
        categoryId,
        employerId: 'employer-1',
      })
    expect(createSubRes.status).toBe(201)
    expect(createSubRes.body.subtopic.title).toBe('دستگاه‌های تصویربرداری')

    // 3. Representative discovers categories and subtopics
    const repCatRes = await request(app)
      .get(`/events/${event.id}/categories`)
      .set(authHeaders('rep-1'))
    expect(repCatRes.status).toBe(200)
    expect(repCatRes.body.items).toHaveLength(1)
    expect(repCatRes.body.items[0].title).toBe('تجهیزات پزشکی')

    const repSubRes = await request(app)
      .get(`/events/${event.id}/subtopics`)
      .set(authHeaders('rep-1'))
    expect(repSubRes.status).toBe(200)
    expect(repSubRes.body.items).toHaveLength(1)
    expect(repSubRes.body.items[0].title).toBe('دستگاه‌های تصویربرداری')
    expect(repSubRes.body.items[0].categoryTitle).toBe('تجهیزات پزشکی')
  })
})
