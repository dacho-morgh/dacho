import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { Users } from '@cms-core/collections/Users'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'

// Public signup must produce an `applicant` (role) with no CMS role (cmsRole),
// and must be impossible to self-elevate: any `role`/`cmsRole` supplied by an
// anonymous visitor is ignored and forced to the safe defaults.
const TEST_PHONES = [
  '09910000001',
  '09910000002',
  '09910000003',
  '09910000004',
  '09910000005',
  '09910000006',
]
const TEST_EMAILS = [
  'int-applicant@example.com',
  'int-escalation@example.com',
  'int-applicant-without-company@example.com',
  'int-registration-admin@example.com',
  'int-registration-result@example.com',
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
        companyName: 'شرکت تست',
        companyNationalId: '12345678901',
        companyRegistrationNumber: '12345',
        companyType: 'دانش‌بنیان',
        companyProvince: 'بوشهر',
        companyCity: 'بوشهر',
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
        companyName: 'شرکت تست',
        companyNationalId: '12345678901',
        companyRegistrationNumber: '12345',
        companyType: 'دانش‌بنیان',
        companyProvince: 'بوشهر',
        companyCity: 'بوشهر',
        role: 'staff',
        cmsRole: 'admin',
      },
    })

    expect(user.role).toBe('applicant')
    expect(user.cmsRole).toBeNull()
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
        role: 'staff',
        cmsRole: 'admin',
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
        name: 'متقاضی ایجادشده در نشست ادمین',
        companyName: 'شرکت تست',
        companyNationalId: '12345678901',
        companyRegistrationNumber: '12345',
        companyType: 'دانش‌بنیان',
        companyProvince: 'بوشهر',
        companyCity: 'بوشهر',
        role: 'staff',
        cmsRole: 'admin',
      }),
    })

    const endpoint = Array.isArray(Users.endpoints)
      ? Users.endpoints.find((candidate) => candidate.path === '/self-signup')
      : undefined
    expect(endpoint).toBeDefined()
    const response = await endpoint!.handler(req)
    expect(response.status).toBe(201)

    const body = (await response.json()) as {
      doc: { role: string; cmsRole: string | null; roles: unknown[] }
    }
    expect(body.doc.role).toBe('applicant')
    expect(body.doc.cmsRole).toBeNull()
    expect(body.doc.roles).toEqual([])
  })

  it('allows trusted internal writes to assign roles via context', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        username: 'int-staff-user',
        password: 'int-test-password',
        phone: TEST_PHONES[2],
        name: 'ادمین تست',
        role: 'staff',
      },
      context: { allowRoleAssignment: true },
    })

    expect(user.role).toBe('staff')
    expect(user.companyName).toBeNull()
  })

  it('requires company details for an applicant account', async () => {
    await expect(
      payload.create({
        collection: 'users',
        overrideAccess: false,
        data: {
          email: TEST_EMAILS[2],
          password: 'int-test-password',
          phone: TEST_PHONES[3],
          name: 'متقاضی بدون شرکت',
        },
      }),
    ).rejects.toThrow()
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
