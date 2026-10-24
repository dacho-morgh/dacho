import { createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'
import type { User } from '@dacho/cms-core'
import { Users } from '@cms-core/collections/Users'
import {
  OPERATIONAL_ROLES,
  isBackendService,
  isInternalAdmin,
  isContentEditor,
} from '@cms-core/access/roles'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'

let payload: Payload
let owner: User
let reviewer: User
let service: User
const prefix = 't08-personnel-'
const password = 't08-synthetic-password'
const serviceKey = 't08-service-key-test-only'
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
/** Drive the real `/api/users/backend-profile/:id` route as the service credential. */
const servicePatch = (id: unknown, body: unknown) =>
  handleEndpoints({
    config,
    request: new Request(`http://localhost/api/users/backend-profile/${String(id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `users API-Key ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  })
const serviceGet = (path: string) =>
  handleEndpoints({
    config,
    request: new Request(`http://localhost/api/users${path}`, {
      headers: { Authorization: `users API-Key ${serviceKey}` },
    }),
  })

describe('owner personnel administration', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    await cleanup()
    owner = await create(1, 'system-owner')
    reviewer = await create(2, 'reviewer')
    service = await payload.create({
      collection: 'users',
      data: {
        email: `${prefix}service@example.com`,
        phone: '09918200000',
        password,
        operationalRole: 'representative',
        isActive: true,
        enableAPIKey: true,
        apiKey: serviceKey,
        backendService: true,
      },
      context: { allowPersonnelProvisioning: true },
    })
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

  it('denies the backend service generic user PATCH while keeping identity reads', async () => {
    expect((await serviceGet('')).status).toBe(200)
    expect(isInternalAdmin(service)).toBe(false)
    expect(isBackendService({ ...service, _strategy: 'local-jwt' })).toBe(false)
    await expect(
      payload.find({
        collection: 'users',
        user: { ...service, _strategy: 'local-jwt' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await payload.update({
      collection: 'users',
      id: owner.id,
      data: { enableAPIKey: true, apiKey: 't08-owner-key-test-only' },
      context: { allowPersonnelProvisioning: true },
    })
    const readOwner = await serviceGet(`/${owner.id}`)
    expect(readOwner.status).toBe(200)
    expect(await readOwner.text()).not.toContain('t08-owner-key-test-only')
    const visible = await payload.findByID({
      collection: 'users',
      id: owner.id,
      user: { ...service, _strategy: 'api-key' },
      overrideAccess: false,
    })
    expect(visible.apiKey).toBeUndefined()
    expect(visible.personnelHistory).toBeUndefined()
    await expect(
      payload.update({
        collection: 'users',
        id: owner.id,
        data: { password: 'stolen-password' },
        user: { ...service, _strategy: 'api-key' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('revokes a retained local session when an account becomes a service account', async () => {
    const staged = await create(7, 'representative')
    const prior = await payload.login({
      collection: 'users',
      data: { email: staged.email!, password },
    })
    await payload.update({
      collection: 'users',
      id: staged.id,
      data: { backendService: true },
      context: { allowPersonnelProvisioning: true },
    })
    const retained = await handleEndpoints({
      config,
      request: new Request('http://localhost/api/users', {
        headers: { Authorization: `JWT ${prior.token}` },
      }),
    })
    expect([401, 403]).toContain(retained.status)
  })

  it('returns only a safe profile projection from an empty service PATCH', async () => {
    const target = await create(3, 'representative')
    await payload.update({
      collection: 'users',
      id: target.id,
      data: { enableAPIKey: true, apiKey: 't08-target-key-test-only' },
      context: { allowPersonnelProvisioning: true },
    })
    const response = await servicePatch(target.id, {})
    expect(response.status).toBe(200)
    const raw = await response.text()
    expect(raw).not.toContain('t08-target-key-test-only')
    for (const forbidden of [
      'apiKey',
      'enableAPIKey',
      'personnelHistory',
      'legacyRoles',
      'sessions',
      'resetPasswordToken',
      '"hash"',
      '"salt"',
    ])
      expect(raw).not.toContain(forbidden)
    const body = JSON.parse(raw) as { doc: Record<string, unknown> }
    expect(Object.keys(body.doc).sort()).toEqual([
      'email',
      'id',
      'name',
      'phone',
      'position',
      'updatedAt',
    ])
  })

  it('refuses service edits to owner, staff, editorial, service and inactive accounts', async () => {
    const editor = await create(4, 'representative')
    await payload.update({
      collection: 'users',
      id: editor.id,
      data: { contentEditor: true },
      context: { allowPersonnelProvisioning: true },
    })
    const inactive = await create(5, 'representative')
    await payload.update({
      collection: 'users',
      id: inactive.id,
      data: { isActive: false },
      context: { allowPersonnelProvisioning: true },
    })
    for (const account of [owner, reviewer, service, editor, inactive]) {
      const before = await payload.findByID({ collection: 'users', id: account.id })
      const response = await servicePatch(account.id, {
        name: 'Hijacked profile',
        email: 'attacker@example.com',
        phone: '09918200999',
      })
      expect(response.status).toBe(403)
      const after = await payload.findByID({ collection: 'users', id: account.id })
      expect({ name: after.name, email: after.email, phone: after.phone }).toEqual({
        name: before.name,
        email: before.email,
        phone: before.phone,
      })
    }
    expect((await servicePatch('unknown-account', { name: 'x' })).status).toBe(403)
  })

  it('updates an ordinary representative profile through the service command', async () => {
    const target = await create(6, 'representative')
    const response = await servicePatch(target.id, {
      name: 'Profile update',
      phone: '09918200006',
      email: 't08-personnel-updated@example.com',
    })
    expect(response.status).toBe(200)
    const body = JSON.parse(await response.text()) as { doc: Record<string, unknown> }
    expect(body.doc).toMatchObject({
      name: 'Profile update',
      phone: '09918200006',
      email: 't08-personnel-updated@example.com',
    })
    expect(body.doc).not.toHaveProperty('apiKey')
    const persisted = await payload.findByID({ collection: 'users', id: target.id })
    expect(persisted.name).toBe('Profile update')
    expect(persisted.operationalRole).toBe('representative')
    expect(persisted.isActive).toBe(true)
    const escalated = await servicePatch(target.id, {
      operationalRole: 'system-owner',
      backendService: true,
      password: 'stolen-password',
    })
    expect(escalated.status).toBe(200)
    const after = await payload.findByID({ collection: 'users', id: target.id })
    expect(after.operationalRole).toBe('representative')
    expect(after.backendService).toBe(false)
    await expect(
      payload.login({
        collection: 'users',
        data: { email: 't08-personnel-updated@example.com', password },
      }),
    ).resolves.toBeTruthy()
  })

  it('requires explicit mapping before activating a legacy account without a role', async () => {
    const hook = Users.hooks?.beforeChange?.[0]
    if (!hook) throw new Error('Missing personnel hook')
    const req = await createLocalReq({ user: owner }, payload)
    await expect(Promise.resolve().then(() => hook({
      operation: 'update', data: { isActive: true },
      originalDoc: { ...reviewer, operationalRole: null, isActive: false, contentEditor: false },
      req, context: {}, collection: payload.collections.users.config,
    } as Parameters<typeof hook>[0]))).rejects.toThrow('نقش عملیاتی')
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
