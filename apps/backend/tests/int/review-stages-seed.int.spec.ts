import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'

import { createApp } from '../../src/app.js'
import { InMemoryCompanyStore } from '../../src/auth/company-store.js'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../../src/catalog/service-catalog.js'
import { runMigrations } from '../../src/db/migrate.js'
import { PrivateDocumentStorage } from '../../src/documents/storage.js'
import { InMemoryPublicRecordStore } from '../../src/exhibitions/exhibition-store.js'
import { JwtSigner } from '../../src/jwt.js'
import { InMemoryCodeStore } from '../../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../../src/otp/console-delivery.js'
import { httpSeedClient, seedReviewStages, SEED_EVENT_TITLE, type SeedPeople } from '../../src/dev/review-stages-seed.js'

// #288: the design-review seed, run twice over the real API on the disposable
// database, leaves one case per stage and a non-empty list for every role.

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString, application_name: 'design-qa-288-seed' })

const people: SeedPeople = {
  owner: 'seed-owner',
  secretariat: 'seed-secretariat',
  chief: 'seed-chief',
  investment: 'seed-investment',
  employer: 'seed-employer',
  reviewers: ['seed-reviewer-1', 'seed-reviewer-2', 'seed-reviewer-3'],
  representative: 'seed-representative',
}
const roles: Record<string, string> = {
  'seed-owner': 'system-owner',
  'seed-secretariat': 'central-secretariat',
  'seed-chief': 'chief-reviewer',
  'seed-investment': 'investment-reviewer',
  'seed-employer': 'employer-reviewer',
  'seed-reviewer-1': 'reviewer',
  'seed-reviewer-2': 'reviewer',
  'seed-reviewer-3': 'reviewer',
  'seed-representative': 'representative',
}
const userStore = new InMemoryUserStore(
  Object.entries(roles).map(([id, operationalRole]) => ({ id, phone: id, name: `نام ${id}`, operationalRole, isActive: true })),
)
// A complete, not yet verified profile: the seed has to take it through verification itself.
const companyStore = new InMemoryCompanyStore([
  {
    name: 'شرکت نمونه بازبینی',
    nationalId: 'Q288-seed-company',
    representativeId: 'seed-representative',
    registrationNumber: '12345',
    type: 'دانش‌بنیان',
    status: 'فعال',
    legalEntityType: 'سهامی خاص',
    classification: 'نوپا',
    knowledgeBasedStatus: 'دانش‌بنیان نوپا',
    foundingYear: '1395',
    establishmentDate: '2016',
    activityDomain: 'فناوری نفت و گاز',
    productsServices: [{ title: 'سامانه پایش' }],
    addresses: [{ title: 'دفتر مرکزی', province: 'بوشهر', city: 'بوشهر', postalCode: '7514', address: 'خیابان اصلی' }],
  },
])

let server: Server
let base: string
const SECRET = 'seed-test-proxy-secret'

async function cleanup() {
  const docs = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.private_documents')).rows
  const rfps = (await pool.query<{ storage_key: string }>('SELECT storage_key FROM dashboard.rfp_files')).rows
  await pool.query("DELETE FROM dashboard.requests WHERE service_id = 'q288-seed-service'; DELETE FROM dashboard.events")
  // The seed's verification files belong to in-memory company '1' and no request.
  await pool.query("DELETE FROM dashboard.private_documents WHERE company_id = '1' AND request_id IS NULL")
  await pool.query("DELETE FROM dashboard.company_verifications WHERE representative_id = 'seed-representative'")
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR!)
  await Promise.all([...docs, ...rfps].map(({ storage_key }) => storage.remove(storage_key).catch(() => undefined)))
}

const get = async (actor: string, path: string) => {
  const res = await fetch(`${base}${path}`, { headers: { 'x-internal-proxy-secret': SECRET, 'x-user-id': actor } })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (await res.json()) as any }
}

describe('#288 design-review seed (int)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
    await cleanup()
    const app = createApp({
      pool,
      userStore,
      companyStore,
      jwt: await JwtSigner.create('test'),
      codeStore: new InMemoryCodeStore(),
      delivery: new ConsoleOtpDelivery(),
      serviceCatalog: new InMemoryServiceCatalog([
        { id: 'q288-seed-service', key: 'events', title: 'رویدادها و رقابت‌ها', workflow: [], formFields: null },
      ]),
      proxySecret: SECRET,
      publicRecords: new InMemoryPublicRecordStore({ firstId: 2881 }),
    })
    server = app.listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', () => resolve()))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await cleanup()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await pool.end()
  })

  it('leaves one case per stage, the same ones on a second run, and a non-empty list for every role', async () => {
    const client = httpSeedClient(base, SECRET)
    const first = await seedReviewStages(client, people, { serviceId: 'q288-seed-service' })
    const second = await seedReviewStages(client, people, { serviceId: 'q288-seed-service' })
    expect(second).toEqual(first)

    const events = await pool.query('SELECT id FROM dashboard.events WHERE title = $1', [SEED_EVENT_TITLE])
    expect(events.rows).toHaveLength(1)
    const rows = await pool.query<{ id: string; status: string; review_stage: string }>(
      "SELECT id, status, review_stage FROM dashboard.requests WHERE service_id = 'q288-seed-service'",
    )
    expect(rows.rows).toHaveLength(3)
    const stageOf = new Map(rows.rows.map((row) => [row.id, `${row.status}/${row.review_stage}`]))
    expect(stageOf.get(first.requests.triage)).toBe('in_review/chief_triage')
    expect(stageOf.get(first.requests.review)).toBe('in_review/triaged')
    expect(stageOf.get(first.requests.investment)).toBe('in_review/advanced')

    // Every role in the design review has something to open.
    const seeded = Object.values(first.requests)
    for (const person of [people.secretariat, people.chief, people.representative]) {
      const ids = (await get(person, '/requests?limit=100')).body.items.map((item: { id: string }) => item.id)
      expect(ids, person).toEqual(expect.arrayContaining(seeded))
    }
    for (const person of [people.employer, ...people.reviewers]) {
      const queue = (await get(person, '/review/queue?view=all')).body.items.map((item: { requestId: string }) => item.requestId)
      expect(queue.sort(), person).toEqual([first.requests.review, first.requests.investment].sort())
    }
    expect((await get(people.investment, '/investment/queue')).body.items.map((item: { requestId: string }) => item.requestId))
      .toEqual([first.requests.investment])

    // The round's reviewer list shows every progress state.
    const round = (await get(people.chief, `/requests/${first.requests.review}/review-round`)).body.round
    const status = Object.fromEntries(round.slots.map((slot: { userId: string; status: string }) => [slot.userId, slot.status]))
    expect(status).toEqual({
      [people.employer]: 'final',
      [people.reviewers[0]]: 'not_viewed',
      [people.reviewers[1]]: 'in_review',
      [people.reviewers[2]]: 'in_review',
    })
  }, 60_000)
})
