import { randomUUID } from 'node:crypto'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { getPayload, handleEndpoints, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { validNationalId } from '../helpers/nationalId'
import { changesCompanyDossier } from '@cms-core/hooks/invalidateCompanyVerification'

/**
 * Slice S4 (#242) CMS contracts: own account edit and password change for every
 * role (T58), owner-created companies (T57) and re-verification on any company
 * dossier edit made directly in the CMS (T59). Real REST handlers and Postgres.
 */
const rest = (path: string, cookie?: string, method = 'GET', body?: unknown) =>
  handleEndpoints({
    config,
    request: new Request(`http://localhost/api/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  })

const suffix = randomUUID().slice(0, 8)
const password = 's4-account-test-only'
let payload: Payload
const users: number[] = []
const companies: number[] = []
const cookies: Record<'owner' | 'secretariat' | 'reviewer' | 'representative', string> = {
  owner: '', secretariat: '', reviewer: '', representative: '',
}
const phones = { owner: '09917420001', secretariat: '09917420002', reviewer: '09917420003', representative: '09917420004' }

const db = () => (payload.db as unknown as PostgresAdapter).drizzle

async function login(username: string, secret = password): Promise<Response> {
  return rest('users/login', undefined, 'POST', { username, password: secret })
}
const cookieOf = (response: Response) => response.headers.get('set-cookie')!.split(';')[0]
async function me(cookie: string) {
  const response = await rest('users/me', cookie)
  return (await response.json()).user as { id: number; updatedAt: string; name: string; phone: string; email: string }
}

describe('S4 account and company CMS contracts', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    const roles = {
      owner: 'system-owner', secretariat: 'central-secretariat', reviewer: 'reviewer', representative: 'representative',
    } as const
    for (const key of Object.keys(roles) as (keyof typeof roles)[]) {
      const user = await payload.create({
        collection: 'users',
        data: {
          name: `S4 ${key}`,
          phone: phones[key],
          email: `s4-${key}-${suffix}@example.invalid`,
          password,
          operationalRole: roles[key],
          isActive: true,
        },
        context: { allowPersonnelProvisioning: true },
      })
      users.push(user.id)
      const response = await login(phones[key])
      expect(response.status).toBe(200)
      cookies[key] = cookieOf(response)
    }
    const company = await payload.create({
      collection: 'companies',
      data: {
        name: `شرکت S4 ${suffix}`,
        // Signup now validates the check digit (#278); the seed must be claimable.
        nationalId: validNationalId(`99174${Date.now() % 100000}`),
        representative: users[3],
        economicCode: '411',
        addresses: [{ title: 'دفتر', address: 'نشانی' }],
        executives: [{ name: 'مدیر', position: 'مدیرعامل' }],
      },
    })
    companies.push(company.id)
  }, 60_000)

  afterAll(async () => {
    for (const id of companies) {
      await db().execute(sql`DELETE FROM dashboard.company_verifications WHERE company_id = ${String(id)}`)
      await payload.delete({ collection: 'companies', id })
    }
    for (const id of users) {
      await db().execute(sql`DELETE FROM dashboard.activities WHERE owner_id = ${String(id)}`)
      await payload.delete({ collection: 'users', id })
    }
  })

  describe('T58 own account', () => {
    it('lets every role edit its own name, mobile and email and records the change', async () => {
      for (const key of ['reviewer', 'representative'] as const) {
        const before = await me(cookies[key])
        const response = await rest('users/me/account', cookies[key], 'PATCH', {
          expectedUpdatedAt: before.updatedAt,
          name: `ویرایش ${key}`,
          email: `S4-${key}-edited-${suffix}@example.invalid`,
        })
        expect(response.status).toBe(200)
        const { doc } = await response.json()
        expect(doc).toMatchObject({ id: before.id, name: `ویرایش ${key}`, email: `s4-${key}-edited-${suffix}@example.invalid` })
        expect(doc.updatedAt > before.updatedAt).toBe(true)
        const history = await db().execute(sql`
          SELECT title, description FROM dashboard.activities WHERE owner_id = ${String(before.id)} AND type = 'account' AND title = 'ویرایش اطلاعات کاربری'
        `)
        expect(history.rows).toContainEqual({ title: 'ویرایش اطلاعات کاربری', description: 'نام، ایمیل' })
      }
    })

    it('changes the login phone with Persian digits normalized', async () => {
      const before = await me(cookies.secretariat)
      const response = await rest('users/me/account', cookies.secretariat, 'PATCH', {
        expectedUpdatedAt: before.updatedAt, phone: '۰۹۹۱۷۴۲۰۰۹۲',
      })
      expect(response.status).toBe(200)
      expect((await response.json()).doc.phone).toBe('09917420092')
      expect((await login('09917420092')).status).toBe(200)
      expect((await login(phones.secretariat)).status).not.toBe(200)
      phones.secretariat = '09917420092'
    })

    it('refuses a mobile or email that belongs to someone else with 409 and the field', async () => {
      const before = await me(cookies.reviewer)
      const response = await rest('users/me/account', cookies.reviewer, 'PATCH', {
        expectedUpdatedAt: before.updatedAt, phone: phones.owner, email: `s4-owner-${suffix}@example.invalid`,
      })
      expect(response.status).toBe(409)
      expect((await response.json()).errors).toEqual([
        { field: 'phone', code: 'taken' },
        { field: 'email', code: 'taken' },
      ])
      expect((await me(cookies.reviewer)).phone).toBe(phones.reviewer)
    })

    it('rejects a stale edit with 409 and invalid values with 400', async () => {
      const before = await me(cookies.reviewer)
      const first = await rest('users/me/account', cookies.reviewer, 'PATCH', { expectedUpdatedAt: before.updatedAt, name: 'اول' })
      expect(first.status).toBe(200)
      const stale = await rest('users/me/account', cookies.reviewer, 'PATCH', { expectedUpdatedAt: before.updatedAt, name: 'دوم' })
      expect(stale.status).toBe(409)
      expect((await stale.json()).error).toBe('stale_account')
      const current = await me(cookies.reviewer)
      const invalid = await rest('users/me/account', cookies.reviewer, 'PATCH', {
        expectedUpdatedAt: current.updatedAt, phone: '12345', email: 'not-an-email', name: ' ',
      })
      expect(invalid.status).toBe(400)
      expect((await invalid.json()).errors.map((error: { field: string }) => error.field).sort()).toEqual(['email', 'name', 'phone'])
    })

    it('never edits role or another person, and refuses anonymous callers', async () => {
      const before = await me(cookies.reviewer)
      const response = await rest('users/me/account', cookies.reviewer, 'PATCH', {
        expectedUpdatedAt: before.updatedAt, id: users[0], operationalRole: 'system-owner', isActive: false, position: 'x',
      })
      expect(response.status).toBe(200)
      const saved = await payload.findByID({ collection: 'users', id: before.id })
      expect(saved).toMatchObject({ operationalRole: 'reviewer', isActive: true })
      expect((await payload.findByID({ collection: 'users', id: users[0] })).name).toBe('S4 owner')
      expect((await rest('users/me/account', undefined, 'PATCH', { expectedUpdatedAt: before.updatedAt })).status).toBe(401)
    })

    it('changes the password only with the current one and revokes the other sessions', async () => {
      const other = cookieOf(await login(phones.reviewer))
      const wrong = await rest('users/me/password', cookies.reviewer, 'POST', {
        currentPassword: 'not-the-password', newPassword: 's4-new-password',
      })
      expect(wrong.status).toBe(403)
      expect((await wrong.json()).error).toBe('invalid_current_password')
      const short = await rest('users/me/password', cookies.reviewer, 'POST', { currentPassword: password, newPassword: 'short' })
      expect(short.status).toBe(400)

      const changed = await rest('users/me/password', cookies.reviewer, 'POST', {
        currentPassword: password, newPassword: 's4-new-password',
      })
      expect(changed.status).toBe(204)
      expect((await rest('users/me', cookies.reviewer)).status).toBe(200)
      expect((await me(cookies.reviewer))?.id).toBe(users[2])
      expect((await (await rest('users/me', other)).json()).user).toBeNull()
      expect((await login(phones.reviewer)).status).not.toBe(200)
      expect((await login(phones.reviewer, 's4-new-password')).status).toBe(200)
      const history = await db().execute(sql`
        SELECT 1 FROM dashboard.activities WHERE owner_id = ${String(users[2])} AND type = 'account' AND title = 'تغییر رمز عبور'
      `)
      expect(history.rows).toHaveLength(1)
    })
  })

  describe('T57 owner-created company', () => {
    const body = (n: string) => ({
      name: `نماینده ${n}`,
      position: 'مدیرعامل',
      phone: `0991742010${n}`,
      email: `s4-created-${n}-${suffix}@example.invalid`,
      password: 'temporary-password',
      companyName: `شرکت ساخته‌شده ${n} ${suffix}`,
      companyNationalId: validNationalId(`99${n}${Date.now() % 10_000_000}`),
      activityDomain: 'انرژی',
    })

    it('lets only the System Owner create a company and its representative atomically', async () => {
      for (const key of ['secretariat', 'reviewer', 'representative'] as const) {
        expect((await rest('companies/owner-create', cookies[key], 'POST', body('1'))).status).toBe(403)
      }
      const response = await rest('companies/owner-create', cookies.owner, 'POST', body('1'))
      expect(response.status).toBe(201)
      const created = await response.json()
      users.push(Number(created.user.id))
      companies.push(Number(created.company.id))

      const representative = await payload.findByID({ collection: 'users', id: created.user.id, showHiddenFields: true })
      expect(representative).toMatchObject({ operationalRole: 'representative', isActive: true })
      expect(representative.personnelHistory).toEqual([
        expect.objectContaining({ actorId: String(users[0]), source: 'owner' }),
      ])
      const company = await payload.findByID({ collection: 'companies', id: created.company.id, depth: 0 })
      expect(company.representative).toBe(Number(created.user.id))
      const verification = await db().execute(sql`
        SELECT 1 FROM dashboard.company_verifications WHERE company_id = ${String(created.company.id)}
      `)
      expect(verification.rows).toHaveLength(0)
      expect((await login(body('1').phone, 'temporary-password')).status).toBe(200)
    })

    it('reports a duplicate national id or account without leaving a half-created record', async () => {
      const existing = await payload.findByID({ collection: 'companies', id: companies[0] })
      const duplicateCompany = await rest('companies/owner-create', cookies.owner, 'POST', {
        ...body('2'), companyNationalId: existing.nationalId,
      })
      expect(duplicateCompany.status).toBe(409)
      expect((await duplicateCompany.json()).errors[0]).toMatchObject({ code: 'duplicate_national_id' })
      expect((await payload.find({ collection: 'users', where: { phone: { equals: body('2').phone } } })).totalDocs).toBe(0)

      const duplicatePhone = await rest('companies/owner-create', cookies.owner, 'POST', { ...body('3'), phone: phones.owner })
      expect(duplicatePhone.status).toBe(409)
      expect((await duplicatePhone.json()).errors).toEqual([expect.objectContaining({ code: 'phone_taken', field: 'phone' })])

      const missing = await rest('companies/owner-create', cookies.owner, 'POST', { ...body('4'), companyName: '' })
      expect(missing.status).toBe(400)
    })
  })

  describe('T59 direct CMS edits', () => {
    it('treats any dossier field as a change but ignores no-op saves and generated row ids', () => {
      const original = {
        name: 'A', economicCode: '1', website: null,
        addresses: [{ id: 'r1', title: 'دفتر', address: 'نشانی', city: null }],
        representative: 7, updatedAt: '2026-01-01',
      }
      expect(changesCompanyDossier({ economicCode: '2' }, original)).toBe(true)
      expect(changesCompanyDossier({ addresses: [{ title: 'دفتر', address: 'نشانی جدید' }] }, original)).toBe(true)
      expect(changesCompanyDossier({ addresses: [{ title: 'دفتر', address: 'نشانی', city: '' }] }, original)).toBe(false)
      expect(changesCompanyDossier({ name: 'A', website: '', representative: 8, updatedAt: 'x' }, original)).toBe(false)
    })

    it('returns an approved company to re-verification when a non-identity field is edited', async () => {
      const id = String(companies[0])
      await db().execute(sql`
        INSERT INTO dashboard.company_verifications (company_id, representative_id, status, snapshot)
        VALUES (${id}, ${String(users[3])}, 'approved', '{}'::jsonb)
      `)
      const same = await rest(`companies/${id}`, cookies.representative, 'PATCH', { economicCode: '411' })
      expect(same.status).toBe(200)
      let current = await db().execute(sql`SELECT status FROM dashboard.company_verifications WHERE company_id = ${id}`)
      expect(current.rows).toEqual([{ status: 'approved' }])

      const edited = await rest(`companies/${id}`, cookies.representative, 'PATCH', { economicCode: '422' })
      expect(edited.status).toBe(200)
      current = await db().execute(sql`SELECT status, reason FROM dashboard.company_verifications WHERE company_id = ${id}`)
      expect(current.rows).toEqual([{ status: 'returned', reason: 'ویرایش اطلاعات شرکت؛ نیازمند احراز مجدد' }])
    })
  })
})
