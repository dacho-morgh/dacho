import { createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'
import type { User } from '@dacho/cms-core'
import { Users } from '@cms-core/collections/Users'
import { OPERATIONAL_ROLES, isInternalAdmin, isContentEditor } from '@cms-core/access/roles'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'

let payload: Payload
let owner: User
let reviewer: User
const prefix = 't08-personnel-'
const password = 't08-synthetic-password'
const cleanup = () => payload.delete({ collection: 'users', where: { email: { like: prefix } } })
const create = (index: number, operationalRole: User['operationalRole']) =>
  payload.create({
    collection: 'users',
    data: {
      email: `${prefix}${index}@example.com`,
      phone: `09918000${String(index).padStart(3, '0')}`,
      password,
      operationalRole,
      isActive: true,
    },
    context: { allowPersonnelProvisioning: true },
  })

describe('owner personnel administration', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = await create(1, 'system-owner')
    reviewer = await create(2, 'reviewer')
  })
  afterAll(async () => {
    await cleanup()
  })

  it('lets the owner create each of the seven scalar roles and retain independent editorial permission', async () => {
    for (const [index, role] of OPERATIONAL_ROLES.entries()) {
      const user = await payload.create({
        collection: 'users',
        overrideAccess: false,
        user: owner,
        data: {
          email: `${prefix}role-${index}@example.com`,
          phone: `09918100${String(index).padStart(3, '0')}`,
          password,
          operationalRole: role,
          contentEditor: role === 'reviewer',
        },
      })
      expect(user.operationalRole).toBe(role)
      expect(user.isActive).toBe(true)
      if (role === 'reviewer') {
        expect(isContentEditor(user)).toBe(true)
        expect(isInternalAdmin(user)).toBe(false)
      }
    }
  })

  it('rejects an array of operational roles with a validation error', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: reviewer.id,
        user: owner,
        overrideAccess: false,
        data: { operationalRole: ['reviewer', 'system-owner'] as never },
      }),
    ).rejects.toThrow()
    expect((await payload.findByID({ collection: 'users', id: reviewer.id })).operationalRole).toBe(
      'reviewer',
    )
  })

  it('denies a reviewer personnel records and silently strips protected self-service changes', async () => {
    await expect(
      payload.findByID({
        collection: 'users',
        id: owner.id,
        user: reviewer,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const updated = await payload.update({
      collection: 'users',
      id: reviewer.id,
      user: reviewer,
      overrideAccess: false,
      data: {
        operationalRole: 'system-owner',
        contentEditor: true,
        backendService: true,
        roles: ['admin'],
      },
    })
    expect(updated.operationalRole).toBe('reviewer')
    expect(updated.contentEditor).toBe(false)
    expect(updated.backendService).toBe(false)
    expect(updated.roles).toEqual(['referee'])
  })

  it('limits the service credential to read and a whitelisted profile command', async () => {
    const service = await payload.create({
      collection: 'users',
      data: {
        email: `${prefix}service@example.com`,
        phone: '09918200000',
        password,
        operationalRole: 'representative',
        isActive: true,
        backendService: true,
      },
      context: { allowPersonnelProvisioning: true },
    })
    expect(isInternalAdmin(service)).toBe(false)
    await payload.update({
      collection: 'users',
      id: owner.id,
      data: { enableAPIKey: true, apiKey: 't08-owner-key-test-only' },
      context: { allowPersonnelProvisioning: true },
    })
    const visible = await payload.findByID({
      collection: 'users',
      id: owner.id,
      user: service,
      overrideAccess: false,
    })
    expect(visible.apiKey).toBeUndefined()
    expect(visible.personnelHistory).toBeUndefined()
    await expect(
      payload.update({
        collection: 'users',
        id: owner.id,
        data: { password: 'stolen-password' },
        user: service,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const req = await createLocalReq({ user: service }, payload)
    Object.assign(req, {
      routeParams: { id: reviewer.id },
      json: async () => ({
        name: 'Profile update',
        operationalRole: 'system-owner',
        password: 'stolen-password',
        backendService: true,
      }),
    })
    const endpoint =
      Array.isArray(Users.endpoints) &&
      Users.endpoints.find((e) => e.path === '/backend-profile/:id')
    if (!endpoint) throw new Error('Missing backend profile endpoint')
    expect((await endpoint.handler(req)).status).toBe(200)
    const updated = await payload.findByID({ collection: 'users', id: reviewer.id })
    expect(updated.name).toBe('Profile update')
    expect(updated.operationalRole).toBe('reviewer')
    expect(updated.backendService).toBe(false)
  })

  it('deactivates without deletion and revokes login, CMS access and privileged compatibility roles', async () => {
    const login = await payload.login({
      collection: 'users',
      data: { email: reviewer.email!, password },
    })
    const user = await payload.update({
      collection: 'users',
      id: reviewer.id,
      user: owner,
      overrideAccess: false,
      data: { isActive: false, personnelHistory: [] },
    })
    expect(user.roles).toEqual([])
    const staleSession = await handleEndpoints({
      config,
      request: new Request(`http://localhost/api/users/${reviewer.id}`, {
        headers: { Authorization: `JWT ${login.token}` },
      }),
    })
    expect([401, 403]).toContain(staleSession.status)
    expect(isInternalAdmin(user)).toBe(false)
    expect(isContentEditor(user)).toBe(false)
    await expect(
      payload.login({ collection: 'users', data: { email: reviewer.email!, password } }),
    ).rejects.toThrow()
    await expect(
      payload.findByID({ collection: 'users', id: owner.id, user, overrideAccess: false }),
    ).rejects.toThrow()
    await expect(
      payload.delete({ collection: 'users', id: reviewer.id, user: owner, overrideAccess: false }),
    ).rejects.toThrow()
    const retained = await payload.findByID({ collection: 'users', id: reviewer.id })
    expect(retained.id).toBe(reviewer.id)
    const history = retained.personnelHistory as Array<{
      actorId: string
      after: { isActive: boolean }
    }>
    expect(history.length).toBeGreaterThan(1)
    expect(history.at(-1)).toMatchObject({ actorId: String(owner.id), after: { isActive: false } })
  })
})
