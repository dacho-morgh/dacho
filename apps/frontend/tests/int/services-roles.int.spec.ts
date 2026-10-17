import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

// Slice 1 — CMS definitions: the `roles` collection, the `services` display
// fields (key/icon/tag/gradient), the inline `workflow` array, and the
// `users.roles` many-to-many relation.
const TEST_ROLE = 'داور فنی تست'
const ROLE_WORKFLOW = `${TEST_ROLE} ۲`
const ROLE_M2M = `${TEST_ROLE} ۳`
const TEST_PHONE = '09910000021'
const TEST_EMAIL = 'int-roles-m2m@example.com'
const COMPANY_PHONE = '09910000022'
const COMPANY_EMAIL = 'int-company-rep@example.com'
const TEST_COMPANY_NAME = 'شرکت نماینده تست'
const TEST_SERVICE_TITLE = 'سرویس تست'
const TEST_FORM_TITLE = 'فرم تست'

let payload: Payload

const cleanup = async () => {
  // Order matters: services cascade-delete their workflow steps (which reference
  // roles), so delete services/forms/users before roles to avoid the NOT NULL
  // `services_workflow.role_id` + ON DELETE set null constraint.
  await payload.delete({ collection: 'services', where: { title: { equals: TEST_SERVICE_TITLE } } })
  await payload.delete({ collection: 'forms', where: { title: { equals: TEST_FORM_TITLE } } })
  // Companies reference their representative, so they must go before the users.
  await payload.delete({ collection: 'companies', where: { name: { equals: TEST_COMPANY_NAME } } })
  await payload.delete({ collection: 'users', where: { phone: { in: [TEST_PHONE, COMPANY_PHONE] } } })
  await payload.delete({
    collection: 'roles',
    where: { name: { in: [TEST_ROLE, ROLE_WORKFLOW, ROLE_M2M] } },
  })
}

describe('dashboard CMS definitions (roles + services)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
  })

  it('creates and finds a role', async () => {
    const role = await payload.create({ collection: 'roles', data: { name: TEST_ROLE } })
    expect(role.id).toBeDefined()
    expect(role.name).toBe(TEST_ROLE)

    const found = await payload.find({ collection: 'roles', where: { name: { equals: TEST_ROLE } } })
    expect(found.docs).toHaveLength(1)
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

  it('stores an inline workflow of ordered role-gated steps', async () => {
    const role = await payload.create({ collection: 'roles', data: { name: ROLE_WORKFLOW } })
    const service = await payload.create({
      collection: 'services',
      data: {
        title: TEST_SERVICE_TITLE,
        key: 'events',
        workflow: [{ title: 'بررسی دبیرخانه', role: role.id, order: 1 }],
      },
    })

    expect(service.workflow).toHaveLength(1)
    const step = service.workflow?.[0] as { title?: string; order?: number; role?: unknown }
    expect(step.title).toBe('بررسی دبیرخانه')
    expect(step.order).toBe(1)
    const stepRole = step.role as { id?: unknown } | string | undefined
    const stepRoleId = typeof stepRole === 'string' ? stepRole : stepRole?.id
    expect(stepRoleId).toBe(role.id)
  })

  it('relates a service to a form-builder form', async () => {
    const form = await payload.create({
      collection: 'forms',
      data: {
        title: TEST_FORM_TITLE,
        confirmationType: 'message',
        confirmationMessage: {
          root: {
            type: 'root',
            version: 1,
            direction: 'rtl',
            format: '',
            indent: 0,
            children: [
              {
                type: 'paragraph',
                version: 1,
                direction: 'rtl',
                format: '',
                indent: 0,
                children: [{ type: 'text', version: 1, text: 'پیام تست' }],
              },
            ],
          },
        },
        fields: [{ blockType: 'text', name: 'subject', label: 'موضوع', required: true, width: 100 }],
      },
    })

    const service = await payload.create({
      collection: 'services',
      data: { title: TEST_SERVICE_TITLE, key: 'knowledge', form: form.id },
    })

    const serviceForm = service.form as { id?: unknown } | string | undefined
    const serviceFormId = typeof serviceForm === 'string' ? serviceForm : serviceForm?.id
    expect(serviceFormId).toBe(form.id)
  })

  it('assigns multiple roles to a single user', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: TEST_EMAIL,
        password: 'int-test-password',
        phone: TEST_PHONE,
        name: 'کاربر دارای نقش',
        role: ['representative', 'referee'],
      },
      context: { allowRoleAssignment: true },
    })

    expect(user.role).toEqual(expect.arrayContaining(['representative', 'referee']))
  })

  it('creates a company linked to its representative user', async () => {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: COMPANY_EMAIL,
        password: 'int-test-password',
        phone: COMPANY_PHONE,
        name: 'نماینده شرکت',
        role: ['representative'],
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
