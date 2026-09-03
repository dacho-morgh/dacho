import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'

// Public signup must produce an `applicant` (role) with no CMS role (cmsRole),
// and must be impossible to self-elevate: any `role`/`cmsRole` supplied by an
// anonymous visitor is ignored and forced to the safe defaults.
const TEST_PHONES = ['09910000001', '09910000002', '09910000003']
const TEST_EMAILS = [
  'int-applicant@example.com',
  'int-escalation@example.com',
  'int-admin@example.com',
]

let payload: Payload

const cleanup = async () => {
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

  it('creates an applicant account via anonymous signup', async () => {
    const user = await payload.create({
      collection: 'users',
      overrideAccess: false,
      data: {
        email: TEST_EMAILS[0],
        password: 'int-test-password',
        phone: TEST_PHONES[0],
        name: 'متقاضی تست',
      },
    })

    expect(user.role).toBe('applicant')
    expect(user.cmsRole).toBeNull()
    expect(user.username).toBe(TEST_PHONES[0])
  })

  it('ignores role/cmsRole supplied during self-signup', async () => {
    const user = await payload.create({
      collection: 'users',
      overrideAccess: false,
      data: {
        email: TEST_EMAILS[1],
        password: 'int-test-password',
        phone: TEST_PHONES[1],
        name: 'متقاضی مخرب',
        role: 'staff',
        cmsRole: 'admin',
      },
    })

    expect(user.role).toBe('applicant')
    expect(user.cmsRole).toBeNull()
  })

  it('allows trusted internal writes to assign roles via context', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: TEST_EMAILS[2],
        password: 'int-test-password',
        phone: TEST_PHONES[2],
        name: 'ادمین تست',
        role: 'staff',
        cmsRole: 'admin',
      },
      context: { allowRoleAssignment: true },
    })

    expect(user.role).toBe('staff')
    expect(user.cmsRole).toBe('admin')
  })

  it('hasCmsRole only admits editor/admin', () => {
    const admits = (user: unknown) =>
      hasCmsRole({ req: { user } } as Parameters<typeof hasCmsRole>[0])

    expect(admits(null)).toBe(false)
    expect(admits({ cmsRole: null })).toBe(false)
    expect(admits({ cmsRole: 'editor' })).toBe(true)
    expect(admits({ cmsRole: 'admin' })).toBe(true)
  })
})
