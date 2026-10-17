import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { Users } from '@cms-core/collections/Users'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'

// Public signup must produce a `representative` and must be impossible to
// self-elevate: any `role` supplied by an anonymous visitor is ignored and forced
// to the safe default. The signup endpoint also creates the company the new user
// represents.
const TEST_PHONES = [
  '09910000001',
  '09910000002',
  '09910000003',
  '09910000004',
  '09910000005',
  '09910000006',
]
const TEST_EMAILS = [
  'int-representative@example.com',
  'int-escalation@example.com',
  'int-internal@example.com',
  'int-registration-admin@example.com',
  'int-registration-result@example.com',
]

let payload: Payload

const cleanup = async () => {
  await payload.delete({
    collection: 'companies',
    where: { nationalId: { like: 'int-nid-' } },
  })
  await payload.delete({
    collection: 'users',
    where: { phone: { in: TEST_PHONES } },
  })
}

describe('users roles & access control', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
  })

  it('creates a representative account via anonymous signup', async () => {
    const user = await payload.create({
      collection: 'users',
      overrideAccess: false,
      data: {
        email: TEST_EMAILS[0],
        password: 'int-test-password',
        phone: TEST_PHONES[0],
        name: 'نماینده تست',
      },
    })

    expect(user.roles).toEqual(['representative'])
    expect(user.username).toBe(TEST_PHONES[0])
  })

  it('ignores a role supplied during self-signup', async () => {
    const user = await payload.create({
      collection: 'users',
      overrideAccess: false,
      data: {
        email: TEST_EMAILS[1],
        password: 'int-test-password',
        phone: TEST_PHONES[1],
        name: 'متقاضی مخرب',
        roles: ['admin'],
      },
    })

    expect(user.roles).toEqual(['representative'])
  })

  it('forces safe roles through signup even when the request has an admin session', async () => {
    const admin = await payload.create({
      collection: 'users',
      data: {
        email: TEST_EMAILS[3],
        username: TEST_PHONES[4],
        password: 'int-test-password',
        phone: TEST_PHONES[4],
        name: 'ادمین تست ثبت‌نام',
        roles: ['admin'],
      },
      context: { allowRoleAssignment: true },
    })
    const req = await createLocalReq({ user: admin }, payload)
    Object.assign(req, {
      json: async () => ({
        email: TEST_EMAILS[4],
        username: TEST_PHONES[5],
        password: 'int-test-password',
        phone: TEST_PHONES[5],
        name: 'نماینده ایجادشده در نشست ادمین',
        companyName: 'شرکت تست',
        companyNationalId: 'int-nid-escalation',
        roles: ['admin'],
      }),
    })

    const endpoint = Array.isArray(Users.endpoints)
      ? Users.endpoints.find((candidate) => candidate.path === '/self-signup')
      : undefined
    expect(endpoint).toBeDefined()
    const response = await endpoint!.handler(req)
    expect(response.status).toBe(201)

    const body = (await response.json()) as {
      user: { roles: string[] }
      company: { representative: { id?: unknown } | number | string }
    }
    // The escalation attempt is discarded...
    expect(body.user.roles).toEqual(['representative'])
    // ...and the company is linked to that new user as its representative.
    const representative =
      typeof body.company.representative === 'object'
        ? body.company.representative.id
        : body.company.representative
    expect(representative).toBeDefined()
  })

  it('allows trusted internal writes to assign roles via context', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        username: 'int-internal-user',
        password: 'int-test-password',
        phone: TEST_PHONES[2],
        name: 'ادمین تست',
        roles: ['admin', 'referee'],
      },
      context: { allowRoleAssignment: true },
    })

    // A user may hold several roles at once.
    expect(user.roles).toEqual(expect.arrayContaining(['admin', 'referee']))
  })

  it('hasCmsRole admits only the admin role', () => {
    const admits = (user: unknown) =>
      hasCmsRole({ req: { user } } as Parameters<typeof hasCmsRole>[0])

    expect(admits(null)).toBe(false)
    expect(admits({ roles: [] })).toBe(false)
    expect(admits({ roles: ['representative'] })).toBe(false)
    expect(admits({ roles: ['referee'] })).toBe(false)
    expect(admits({ roles: ['admin'] })).toBe(true)
  })
})