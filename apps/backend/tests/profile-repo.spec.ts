import { describe, expect, it } from 'vitest'

import { InMemoryCompanyStore, type CompanyStore } from '../src/auth/company-store.js'
import type { CompanyFields } from '../src/auth/user-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { ProfileRepository } from '../src/dashboard/profile-repo.js'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class SlowCompanyStore implements CompanyStore {
  readonly updates: { id: string; fields: CompanyFields }[] = []

  constructor(private readonly inner: InMemoryCompanyStore) {}

  findById(id: string) {
    return this.inner.findById(id)
  }

  findByRepresentative(userId: string) {
    return this.inner.findByRepresentative(userId)
  }

  create(fields: CompanyFields & { representativeId: string }) {
    return this.inner.create(fields)
  }

  async update(id: string, fields: CompanyFields) {
    this.updates.push({ id, fields })
    await delay(20)
    return this.inner.update(id, fields)
  }

  list(options?: { search?: string }) {
    return this.inner.list(options)
  }
}

describe('ProfileRepository dossier writes', () => {
  async function setup() {
    const users = new InMemoryUserStore()
    const user = await users.findOrCreateByPhone('09120000002')
    const inner = new InMemoryCompanyStore()
    const company = await inner.create({ name: 'شرکت هم‌زمان', representativeId: user.id })
    const companies = new SlowCompanyStore(inner)
    return { user, company, companies, repo: new ProfileRepository(users, companies) }
  }

  it('keeps concurrent saves to different fields and writes only what changed', async () => {
    const { user, repo, companies } = await setup()

    await Promise.all([
      repo.updateDossier(user.id, { website: 'https://example.invalid' }),
      repo.updateDossier(user.id, { activityDomain: 'نرم‌افزار' }),
    ])

    const profile = await repo.getProfile(user.id)
    expect(profile.dossier.website).toBe('https://example.invalid')
    expect(profile.dossier.activityDomain).toBe('نرم‌افزار')
    expect(companies.updates.map((entry) => entry.fields)).toEqual([
      { website: 'https://example.invalid' },
      { activityDomain: 'نرم‌افزار' },
    ])
  })

  it('persists only the coupled absence change when clearing a prior value', async () => {
    const { user, repo, companies } = await setup()
    await repo.updateDossier(user.id, { website: 'https://example.invalid' })
    companies.updates.length = 0

    await repo.updateDossier(user.id, { notAvailable: ['website'] })

    expect(companies.updates.map((entry) => entry.fields)).toEqual([
      { website: '', notAvailable: ['website'] },
    ])
    const profile = await repo.getProfile(user.id)
    expect(profile.dossier.website).toBe('')
    expect(profile.dossier.notAvailable).toContain('website')
  })
})
