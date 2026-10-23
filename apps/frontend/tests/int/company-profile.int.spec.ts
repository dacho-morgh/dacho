import { randomUUID } from 'node:crypto'
import { getPayload, handleEndpoints, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { PayloadCompanyStore } from '../../../backend/src/auth/company-store'
import { PayloadUserStore } from '../../../backend/src/auth/payload-user-store'
import { ProfileRepository } from '../../../backend/src/dashboard/profile-repo'

// Dispatch through Payload's real REST handlers/auth/access/serialization and
// Postgres, rather than faking responses from the CMS adapter.
const rest = (path: string, key?: string, method = 'GET', body?: unknown) =>
  handleEndpoints({
    config,
    request: new Request(`http://localhost/api/${path}`, {
      method,
      headers: {
        ...(key ? { Authorization: `users API-Key ${key}` } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  })

let payload: Payload
const users: number[] = []
const companies: number[] = []
const keys = Array.from({ length: 5 }, () => randomUUID())
let companyId: number
let otherCompanyId: number

function profileRepository() {
  const options = {
    baseUrl: 'http://localhost',
    apiKey: keys[2],
    fetcher: (url: string, init?: RequestInit) =>
      handleEndpoints({ config, request: new Request(url, init) }),
  }
  return new ProfileRepository(new PayloadUserStore(options), new PayloadCompanyStore(options))
}

describe('company persistence and private CMS boundaries (T05/T06)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    for (const [index, role] of ['representative', 'representative', 'admin', 'editor', 'referee'].entries()) {
      const user = await payload.create({
        collection: 'users',
        data: {
          phone: `0991051000${index}`,
          email: `company-profile-${index}@example.invalid`,
          password: 'company-profile-test-only',
          name: `Company profile fixture ${index}`,
          roles: [role as 'representative' | 'admin' | 'editor' | 'referee'],
          enableAPIKey: true,
          apiKey: keys[index],
        },
        context: { allowRoleAssignment: true },
      })
      users.push(user.id)
    }
    for (let index = 0; index < 2; index++) {
      const company = await payload.create({
        collection: 'companies',
        data: {
          name: `شرکت آزمون ${index}`,
          nationalId: `company-profile-nid-${index}`,
          representative: users[index],
          economicCode: `private-economic-${index}`,
          registrationNumber: `private-registration-${index}`,
          type: 'سهامی خاص',
          province: 'بوشهر',
          city: 'بوشهر',
          addresses: [{ title: 'Private office', address: 'Private street' }],
          executives: [{ name: 'Private executive', position: 'مدیرعامل' }],
        },
      })
      companies.push(company.id)
    }
    companyId = companies[0]
    otherCompanyId = companies[1]
  }, 60_000)

  afterAll(async () => {
    for (const id of companies) await payload.delete({ collection: 'companies', id })
    for (const id of users) await payload.delete({ collection: 'users', id })
  })

  it('persists create/edit/delete and explicit empty arrays through fresh CMS adapters', async () => {
    const userId = String(users[0])
    await profileRepository().updateExecutives(userId, [{ role: 'مدیرعامل', name: 'نام جدید' }])
    const address = await profileRepository().addAddress(userId, {
      title: 'دفتر فنی', province: 'بوشهر', city: 'بوشهر', postalCode: '7514112345', address: 'نشانی جدید',
    })
    let profile = await profileRepository().getProfile(userId)
    expect(profile.executives).toEqual([{ role: 'مدیرعامل', name: 'نام جدید' }])
    expect(profile.addresses).toContainEqual(address)

    await profileRepository().updateAddress(userId, address.id, { title: 'دفتر جدید' })
    // An unrelated partial update must retain both nested arrays.
    await profileRepository().updateBasicInfo(userId, { status: 'فعال' })
    profile = await profileRepository().getProfile(userId)
    expect(profile.addresses.find((item) => item.id === address.id)?.title).toBe('دفتر جدید')
    expect(profile.executives).toHaveLength(1)
    expect(await profileRepository().deleteAddress(userId, address.id)).toBe(true)
    expect((await profileRepository().getProfile(userId)).addresses.some((item) => item.id === address.id)).toBe(false)

    const options = {
      baseUrl: 'http://localhost', apiKey: keys[2],
      fetcher: (url: string, init?: RequestInit) => handleEndpoints({ config, request: new Request(url, init) }),
    }
    await new PayloadCompanyStore(options).update(String(companyId), { addresses: [], executives: [] })
    profile = await profileRepository().getProfile(userId)
    expect(profile.addresses).toEqual([])
    expect(profile.executives).toEqual([])
    // Independent SQL-backed read; no cached adapter state can satisfy this.
    const stored = await payload.findByID({ collection: 'companies', id: companyId, depth: 0 })
    expect(stored.addresses).toEqual([])
    expect(stored.executives).toEqual([])
  })

  it('denies anonymous, editorial and unassigned reviewer reads and writes', async () => {
    for (const key of [undefined, keys[3], keys[4]]) {
      expect([401, 403, 404]).toContain((await rest(`companies/${otherCompanyId}?depth=3`, key)).status)
      expect([401, 403, 404]).toContain((await rest(`companies/${otherCompanyId}`, key, 'PATCH', { name: 'hacked' })).status)
      const list = await rest('companies?depth=3', key)
      expect([401, 403]).toContain(list.status)
    }
  })

  it('scopes lists, search, counts and guessed IDs to the acting representative', async () => {
    const own = await rest(`companies/${companyId}?depth=3`, keys[0])
    expect(own.status).toBe(200)
    const ownBody = await own.json()
    expect(ownBody.nationalId).toBe('company-profile-nid-0')
    expect(ownBody.representative).toBe(users[0])
    const list = await (await rest('companies?depth=3', keys[0])).json()
    expect(list.docs.map((doc: { id: number }) => doc.id)).toEqual([companyId])
    expect(list.totalDocs).toBe(1)
    const search = await (await rest(`companies?where[nationalId][equals]=company-profile-nid-1`, keys[0])).json()
    expect(search.docs).toEqual([])
    expect(search.totalDocs).toBe(0)
    const count = await (await rest('companies/count', keys[0])).json()
    expect(count.totalDocs).toBe(1)
    expect((await rest(`companies/${otherCompanyId}`, keys[0])).status).toBe(404)
    expect([403, 404]).toContain((await rest(`companies/${otherCompanyId}`, keys[0], 'PATCH', { name: 'hacked' })).status)
  })

  it('enforces the same scope for Local API calls acting on behalf of a user', async () => {
    const actor = await payload.findByID({ collection: 'users', id: users[0] })
    const result = await payload.find({ collection: 'companies', user: actor, overrideAccess: false, depth: 5 })
    expect(result.docs.map(({ id }) => id)).toEqual([companyId])
    expect(result.docs[0].representative).toBe(users[0])
    await expect(payload.findByID({
      collection: 'companies', id: otherCompanyId, user: actor, overrideAccess: false, depth: 5,
    })).rejects.toThrow()
  })

  it('prevents representative/national-ID reassignment and keeps admin corrections available', async () => {
    const result = await rest(`companies/${companyId}`, keys[0], 'PATCH', {
      nationalId: 'hacked-national-id', representative: users[1], status: 'فعال',
    })
    expect(result.status).toBe(200)
    const stored = await payload.findByID({ collection: 'companies', id: companyId, depth: 0 })
    expect(stored.nationalId).toBe('company-profile-nid-0')
    expect(stored.representative).toBe(users[0])
    expect(stored.status).toBe('فعال')
    const admin = await rest(`companies/${otherCompanyId}`, keys[2], 'PATCH', { nationalId: 'company-profile-admin-correction' })
    expect(admin.status).toBe(200)
    expect((await admin.json()).doc.nationalId).toBe('company-profile-admin-correction')
  })

  it('exposes only the fixed public directory projection even with hostile query parameters', async () => {
    const response = await rest('companies/directory?depth=5&select[nationalId]=true&where[nationalId][equals]=missing&sort=economicCode')
    expect(response.status).toBe(200)
    const result = await response.json()
    const own = result.docs.find((doc: { id: number }) => doc.id === companyId)
    expect(own).toEqual({ id: companyId, name: 'شرکت آزمون 0', type: 'سهامی خاص', province: 'بوشهر', city: 'بوشهر' })
    for (const doc of result.docs) expect(Object.keys(doc).sort()).toEqual(['city', 'id', 'name', 'province', 'type'])
    expect((await rest('companies/directory?page=-1')).status).toBe(400)
  })

  it('revokes access after representative or role changes in the stored records', async () => {
    await payload.update({ collection: 'companies', id: companyId, data: { representative: users[1] } })
    expect((await rest(`companies/${companyId}`, keys[0])).status).toBe(404)
    await payload.update({ collection: 'companies', id: companyId, data: { representative: users[0] } })
    await payload.update({ collection: 'users', id: users[0], data: { roles: ['referee'] } })
    expect([401, 403]).toContain((await rest(`companies/${companyId}`, keys[0])).status)
    await payload.update({ collection: 'users', id: users[0], data: { roles: ['representative'] } })
  })

  it('does not grant identity-store access merely for a claimed backend email', async () => {
    const fakeService = { ...await payload.findByID({ collection: 'users', id: users[0] }), email: 'backend@dacho.local' }
    await expect(payload.findByID({
      collection: 'users', id: users[1], user: fakeService, overrideAccess: false,
    })).rejects.toThrow()
    await expect(payload.update({
      collection: 'users', id: users[1], user: fakeService, overrideAccess: false, data: { name: 'hacked' },
    })).rejects.toThrow()
    await expect(payload.delete({
      collection: 'users', id: users[1], user: fakeService, overrideAccess: false,
    })).rejects.toThrow()
  })

  it('creates nested fields through the real adapter as well as updating them', async () => {
    const options = {
      baseUrl: 'http://localhost', apiKey: keys[2],
      fetcher: (url: string, init?: RequestInit) => handleEndpoints({ config, request: new Request(url, init) }),
    }
    const created = await new PayloadCompanyStore(options).create({
      name: 'شرکت موقت', nationalId: 'company-profile-created', representativeId: String(users[1]),
      executives: [{ name: 'نام مدیر', position: 'مدیرعامل' }],
      addresses: [{ title: 'دفتر', address: 'نشانی دفتر', province: 'بوشهر', city: 'بوشهر', postalCode: '7514112345' }],
    })
    companies.push(Number(created.id))
    const fresh = await new PayloadCompanyStore(options).findById(created.id)
    expect(fresh?.executives).toEqual([expect.objectContaining({ name: 'نام مدیر', position: 'مدیرعامل' })])
    expect(fresh?.addresses).toEqual([expect.objectContaining({ title: 'دفتر', address: 'نشانی دفتر' })])
  })
})
