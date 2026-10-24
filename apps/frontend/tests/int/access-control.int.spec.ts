import { randomUUID } from 'node:crypto'
import { getPayload, handleEndpoints, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { operationalRole } from '@cms-core/access/roles'

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
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
const keys = Object.fromEntries(
  ['owner', 'secretariat', 'chief', 'reviewer', 'employer', 'investment', 'repA', 'repB', 'editor'].map((name) => [name, randomUUID()]),
) as Record<string, string>
const ids: Record<string, number> = {}
const companyIds: Record<string, number> = {}
const phones = Object.keys(keys).map((_, index) => `09919000${String(index).padStart(3, '0')}`)

const roles: Record<string, { operationalRole: string; contentEditor?: boolean }> = {
  owner: { operationalRole: 'system-owner' },
  secretariat: { operationalRole: 'central-secretariat' },
  chief: { operationalRole: 'chief-reviewer' },
  reviewer: { operationalRole: 'reviewer' },
  employer: { operationalRole: 'employer-reviewer' },
  investment: { operationalRole: 'investment-reviewer' },
  repA: { operationalRole: 'representative' },
  repB: { operationalRole: 'representative' },
  editor: { operationalRole: 'representative', contentEditor: true },
}

const reqFor = (user: unknown) => ({ req: { user } }) as never

describe('CMS role and dossier boundaries (T09)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    for (const [index, [name, spec]] of Object.entries(roles).entries()) {
      const user = await payload.create({
        collection: 'users',
        data: {
          email: `t09-${name}-${suffix}@example.invalid`,
          phone: phones[index],
          password: 't09-synthetic-password',
          name: `T09 ${name}`,
          operationalRole: spec.operationalRole as never,
          contentEditor: spec.contentEditor ?? false,
          isActive: true,
          enableAPIKey: true,
          apiKey: keys[name],
        },
        context: { allowPersonnelProvisioning: true },
      })
      ids[name] = user.id
    }
    for (const [name, representative] of [['A', ids.repA], ['B', ids.repB]] as const) {
      const company = await payload.create({
        collection: 'companies',
        data: {
          name: `T09 company ${name} ${suffix}`,
          nationalId: `t09-nid-${name}-${suffix}`,
          representative,
          economicCode: `t09-economic-${name}`,
        },
      })
      companyIds[name] = company.id
    }
  }, 60_000)

  afterAll(async () => {
    for (const id of Object.values(companyIds)) await payload.delete({ collection: 'companies', id })
    for (const id of Object.values(ids)) await payload.delete({ collection: 'users', id })
  })

  it('lets owner and Secretariat read the private dossier, and denies representative-others and case staff', async () => {
    for (const key of [keys.owner, keys.secretariat]) {
      expect((await rest(`companies/${companyIds.A}?depth=4`, key)).status).toBe(200)
      expect((await rest('companies?depth=0', key)).status).toBe(200)
    }
    for (const key of [keys.chief, keys.reviewer, keys.employer, keys.investment, keys.editor]) {
      expect([401, 403, 404]).toContain((await rest(`companies/${companyIds.A}?depth=4`, key)).status)
      const list = await rest('companies?depth=0', key)
      // Payload applies a deny-by-default query constraint, which yields an
      // empty page rather than an error for a collection read.
      expect([200, 401, 403]).toContain(list.status)
      if (list.status === 200) {
        const body = (await list.json()) as { docs: { id: number }[] }
        expect(body.docs).toEqual([])
      }
    }
    expect((await rest(`companies/${companyIds.A}`, keys.repA)).status).toBe(200)
    expect((await rest(`companies/${companyIds.B}`, keys.repA)).status).toBe(404)
  })

  it('enforces the same company scope through the Local API acting for a user', async () => {
    const chief = await payload.findByID({ collection: 'users', id: ids.chief })
    await expect(
      payload.findByID({ collection: 'companies', id: companyIds.A, user: chief, overrideAccess: false }),
    ).rejects.toThrow()
    const secretariat = await payload.findByID({ collection: 'users', id: ids.secretariat })
    const visible = await payload.find({
      collection: 'companies',
      user: secretariat,
      overrideAccess: false,
      depth: 0,
    })
    expect(visible.docs.map((doc) => doc.id)).toContain(companyIds.A)
  })

  it('projects user reads and keeps personnel authority with the owner', async () => {
    expect((await rest('users?depth=0', keys.owner)).status).toBe(200)
    expect((await rest('users?depth=0', keys.secretariat)).status).toBe(200)
    const chiefUsers = await rest('users?depth=0', keys.chief)
    expect([200, 401, 403]).toContain(chiefUsers.status)
    if (chiefUsers.status === 200) {
      const body = (await chiefUsers.json()) as { docs: { id: number }[] }
      // Self-read remains available; no other personnel record is listed.
      expect(body.docs.map((doc) => doc.id)).toEqual([ids.chief])
    }
    const representativeUsers = await rest('users?depth=0', keys.repA)
    expect([200, 401, 403]).toContain(representativeUsers.status)
    if (representativeUsers.status === 200) {
      const body = (await representativeUsers.json()) as { docs: { id: number }[] }
      expect(body.docs.map((doc) => doc.id)).toEqual([ids.repA])
    }

    const secretariatRead = await rest(`users/${ids.owner}`, keys.secretariat)
    expect(secretariatRead.status).toBe(200)
    const text = await secretariatRead.text()
    expect(text).not.toContain(keys.owner)
    expect(text).not.toContain('personnelHistory')

    const attempted = await rest(`users/${ids.reviewer}`, keys.secretariat, 'PATCH', {
      operationalRole: 'system-owner',
      isActive: false,
    })
    expect([200, 403]).toContain(attempted.status)
    const unchanged = await payload.findByID({ collection: 'users', id: ids.reviewer, depth: 0 })
    expect(unchanged.operationalRole).toBe('reviewer')
    expect(unchanged.isActive).toBe(true)

    expect((await rest(`companies/${companyIds.A}`, keys.secretariat, 'PATCH', { status: 'invalid' })).status).toBe(403)
  })

  it('never infers operational authority from editorial privilege', async () => {
    expect(hasCmsRole(reqFor({ operationalRole: 'central-secretariat', isActive: true }))).toBe(true)
    expect(hasCmsRole(reqFor({ operationalRole: 'chief-reviewer', isActive: true }))).toBe(false)
    expect(hasCmsRole(reqFor({ operationalRole: 'representative', contentEditor: true, isActive: true }))).toBe(true)
    expect(operationalRole({ operationalRole: 'representative', contentEditor: true, isActive: true })).toBe('representative')
    expect(operationalRole({ operationalRole: 'representative', contentEditor: true, isActive: false })).toBeNull()
  })
})
