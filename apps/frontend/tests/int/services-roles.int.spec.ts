import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

// CMS definitions: the `services` display fields (key/icon/tag/gradient) and
// the multi-valued `users.roles` select.
const TEST_PHONE = '09910000021'
const TEST_EMAIL = 'int-roles-m2m@example.com'
const COMPANY_PHONE = '09910000022'
const COMPANY_EMAIL = 'int-company-rep@example.com'
const TEST_COMPANY_NAME = 'شرکت نماینده تست'
const TEST_SERVICE_TITLE = 'سرویس تست'
const TEST_FORM_TITLE = 'فرم تست'

let payload: Payload

const cleanup = async () => {
  await payload.delete({ collection: 'services', where: { title: { equals: TEST_SERVICE_TITLE } } })
  await payload.delete({ collection: 'forms', where: { title: { equals: TEST_FORM_TITLE } } })
  // Companies reference their representative, so they must go before the users.
  await payload.delete({ collection: 'companies', where: { name: { equals: TEST_COMPANY_NAME } } })
  await payload.delete({ collection: 'users', where: { phone: { in: [TEST_PHONE, COMPANY_PHONE] } } })
}

describe('dashboard CMS definitions (services + user roles)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
  })

  it('stores a service display key, icon, tag and gradient', async () => {
    const service = await payload.create({
      collection: 'services',
      data: {
        title: TEST_SERVICE_TITLE,
        key: 'financing',
        icon: 'coins',
        tag: 'سرمایه‌گذاری',
        gradient: 'blue-cyan',
      },
    })

    expect(service.key).toBe('financing')
    expect(service.icon).toBe('coins')
    expect(service.tag).toBe('سرمایه‌گذاری')
    expect(service.gradient).toBe('blue-cyan')
  })

  it('assigns multiple roles to a single user', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: TEST_EMAIL,
        password: 'int-test-password',
        phone: TEST_PHONE,
        name: 'کاربر دارای نقش',
        roles: ['representative', 'referee'],
      },
      context: { allowRoleAssignment: true },
    })

    expect(user.roles).toEqual(expect.arrayContaining(['representative', 'referee']))
  })

  it('creates a company linked to its representative user', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: COMPANY_EMAIL,
        password: 'int-test-password',
        phone: COMPANY_PHONE,
        name: 'نماینده شرکت',
        roles: ['representative'],
      },
      context: { allowRoleAssignment: true },
    })

    const company = await payload.create({
      collection: 'companies',
      data: {
        name: TEST_COMPANY_NAME,
        nationalId: `10${Date.now()}`,
        representative: user.id,
      },
    })

    expect(company.representative).toBeDefined()
  })
})
