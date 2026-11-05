import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTestApp } from './helpers.js'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryVerificationStore } from '../src/dashboard/verification-repo.js'

/** The Secretariat's company table pages, filters and searches on the server. */
describe('GET /admin/companies paging', () => {
  async function setup() {
    const userStore = new InMemoryUserStore()
    const secretariat = await userStore.findOrCreateByPhone('09120000000')
    secretariat.operationalRole = 'central-secretariat'
    secretariat.roles = ['admin']

    const names = ['آلفا', 'بتا', 'گاما', 'دلتا', 'اپسیلون']
    const reps = []
    for (const [index] of names.entries()) reps.push(await userStore.findOrCreateByPhone(`0912111111${index}`))
    const companyStore = new InMemoryCompanyStore(
      reps.map((rep, index) => ({
        name: `شرکت ${names[index]}`,
        nationalId: `1010101010${index}`,
        registrationNumber: `99887${index}`,
        economicCode: `41111111111${index}`,
        type: 'سهامی خاص',
        status: 'فعال',
        province: 'بوشهر',
        city: 'بوشهر',
        establishmentDate: '1398/01/01',
        representativeId: rep.id,
        executives: [],
        addresses: [],
      })),
    )
    const verificationStore = new InMemoryVerificationStore()
    // The first two companies are pending, the third is approved, the rest never submitted.
    for (const rep of reps.slice(0, 3)) {
      const company = (await companyStore.findByRepresentative(rep.id))!
      const submitted = await verificationStore.submit({ companyId: company.id, representativeId: rep.id, snapshot: {} })
      if (!submitted.ok) throw new Error('submit failed in setup')
      if (rep === reps[2]) {
        await verificationStore.decide({ id: submitted.verification.id, action: 'approve', reviewerId: secretariat.id, reason: null })
      }
    }
    const testApp = await createTestApp({ userStore, companyStore, verificationStore })
    const get = (query = '') =>
      request(testApp.app)
        .get(`/admin/companies${query}`)
        .set({ 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': secretariat.id })
    return { get, reps, userStore }
  }

  it('returns one page with its totals and the queue counts of every page', async () => {
    const { get } = await setup()
    const first = (await get('?page=1&limit=2').expect(200)).body
    expect(first).toMatchObject({ page: 1, limit: 2, totalDocs: 5, totalPages: 3 })
    expect(first.items).toHaveLength(2)
    expect(first.counts).toMatchObject({ all: 5, pending: 2, approved: 1, unsubmitted: 2 })

    const last = (await get('?page=3&limit=2').expect(200)).body
    expect(last.items).toHaveLength(1)
    const seen = new Set([...first.items, ...(await get('?page=2&limit=2')).body.items, ...last.items].map((item) => item.id))
    expect(seen.size).toBe(5)
  })

  it('pages within the chosen queue and keeps the counts of the whole search', async () => {
    const { get } = await setup()
    const res = (await get('?status=pending&page=1&limit=1').expect(200)).body
    expect(res).toMatchObject({ totalDocs: 2, totalPages: 2 })
    expect(res.items).toHaveLength(1)
    expect(res.items[0].verificationStatus).toBe('pending')
    expect(res.counts.all).toBe(5)
  })

  it('searches the company, not only the account name', async () => {
    const { get } = await setup()
    const res = (await get('?search=%D8%A8%D8%AA%D8%A7&limit=10').expect(200)).body
    expect(res.items.map((item: { companyName: string }) => item.companyName)).toEqual(['شرکت بتا'])
    expect(res.counts.all).toBe(1)
  })

  it('clamps a page past the end to the last page', async () => {
    const { get } = await setup()
    const res = (await get('?page=99&limit=2').expect(200)).body
    expect(res.page).toBe(3)
    expect(res.items).toHaveLength(1)
  })

  it('hides deactivated representatives', async () => {
    const { get, reps, userStore } = await setup()
    const rep = (await userStore.findById(reps[0]!.id))!
    rep.isActive = false
    const res = (await get('?limit=10').expect(200)).body
    expect(res.totalDocs).toBe(4)
    expect(res.items.map((item: { id: string }) => item.id)).not.toContain(rep.id)
  })

  it('still returns the whole list to callers that do not page', async () => {
    const { get } = await setup()
    const res = (await get().expect(200)).body
    expect(res.items).toHaveLength(5)
    expect(res.totalPages).toBe(1)
  })
})
