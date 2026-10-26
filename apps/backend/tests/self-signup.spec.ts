import { describe, expect, it } from 'vitest'

import {
  DuplicateNationalIdError,
  invalidSignupFields,
  isDuplicateNationalId,
  missingCompanyFields,
  missingUserFields,
  normalizeDigits,
  normalizeLoginIdentifier,
  pickCompanyFields,
  pickUserFields,
  runSelfSignup,
  type SelfSignupCompany,
  type SelfSignupResponse,
  type SelfSignupStore,
  type SelfSignupUser,
} from '@dacho/cms-core/auth/self-signup'

type StoredUser = SelfSignupUser & Record<string, unknown>
type StoredCompany = SelfSignupCompany & Record<string, unknown>
type StoreCall = 'precheck' | 'begin' | 'user' | 'company' | 'commit' | 'rollback'

function uniqueViolation(constraint: string): Error {
  return Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code: '23505',
    constraint,
  })
}

function resultOf(response: SelfSignupResponse) {
  if (!response.body.user || !response.body.company)
    throw new Error(`Expected a successful signup, got ${response.status}`)
  return { user: response.body.user, company: response.body.company }
}

/**
 * In-memory implementation of the same persistence seam the Payload adapter
 * implements. It records the call order so the unit tests can assert the
 * pre-check, transaction and rollback decisions made by `runSelfSignup`.
 */
class MemorySignupStore implements SelfSignupStore {
  users: StoredUser[] = []
  companies: StoredCompany[] = []
  calls: StoreCall[] = []
  failCompanyCreate?: Error
  private sequence = 0

  async companyNationalIdExists(nationalId: string): Promise<boolean> {
    this.calls.push('precheck')
    return this.companies.some((company) => company.nationalId === nationalId)
  }

  async inTransaction<T>(run: () => Promise<T>): Promise<T> {
    const users = [...this.users]
    const companies = [...this.companies]
    this.calls.push('begin')
    try {
      const result = await run()
      this.calls.push('commit')
      return result
    } catch (error) {
      this.users = users
      this.companies = companies
      this.calls.push('rollback')
      throw error
    }
  }

  async createUser(fields: Record<string, string>): Promise<StoredUser> {
    this.calls.push('user')
    if (this.users.some((user) => user.phone === fields.phone))
      throw uniqueViolation('users_phone_unique')
    if (this.users.some((user) => user.email === fields.email))
      throw uniqueViolation('users_email_unique')
    const user: StoredUser = { id: `u${++this.sequence}`, ...fields }
    this.users.push(user)
    return user
  }

  async createCompany(fields: Record<string, string | number>): Promise<StoredCompany> {
    this.calls.push('company')
    if (this.failCompanyCreate) {
      const error = this.failCompanyCreate
      this.failCompanyCreate = undefined
      throw error
    }
    if (this.companies.some((company) => company.nationalId === fields.nationalId))
      throw uniqueViolation('companies_national_id_unique')
    const company: StoredCompany = { id: `c${++this.sequence}`, ...fields }
    this.companies.push(company)
    return company
  }
}

const validBody = {
  email: 'representative@example.com',
  password: 'password123',
  phone: '09123456789',
  name: 'نماینده شرکت',
  position: 'مدیرعامل',
  companyName: 'شرکت نمونه',
  companyNationalId: '1234567890',
  activityDomain: 'انرژی‌های تجدیدپذیر',
}

// These are unit tests of the exported signup contract. The production Payload
// endpoint is a thin adapter over `runSelfSignup`; genuine endpoint/database
// coverage remains in the CMS integration suite.
describe('self-signup contract (unit)', () => {
  it('creates person and company atomically and persists the activity domain', async () => {
    const store = new MemorySignupStore()

    const response = await runSelfSignup(
      { ...validBody, operationalRole: 'system-owner', isActive: true },
      store,
    )

    expect(response.status).toBe(201)
    const { user, company } = resultOf(response)
    expect(company).toMatchObject({
      representative: user.id,
      activityDomain: 'انرژی‌های تجدیدپذیر',
    })
    expect(store.users).toHaveLength(1)
    expect(store.companies).toHaveLength(1)
    expect(store.users[0]?.operationalRole).toBeUndefined()
    expect(store.calls).toEqual(['precheck', 'begin', 'user', 'company', 'commit'])
  })

  it('accepts an omitted activity domain during the temporary compatibility window', async () => {
    const store = new MemorySignupStore()
    const { activityDomain: _omitted, ...bodyWithoutDomain } = validBody

    const response = await runSelfSignup(bodyWithoutDomain, store)

    expect(response.status).toBe(201)
    expect(store.companies).toHaveLength(1)
    expect(store.companies[0]?.activityDomain).toBeUndefined()
  })

  it('returns a clear conflict for a duplicate national ID and never starts a transaction', async () => {
    const store = new MemorySignupStore()
    store.companies.push({ id: 'c-existing', nationalId: validBody.companyNationalId, name: 'Existing Co' })

    const response = await runSelfSignup(validBody, store)

    expect(response.status).toBe(409)
    expect(response.body.errors?.[0]).toMatchObject({
      code: 'duplicate_national_id',
      field: 'companyNationalId',
    })
    expect(store.users).toHaveLength(0)
    expect(store.companies).toHaveLength(1)
    expect(store.calls).toEqual(['precheck'])
  })

  it('rolls the user creation back completely when the company write fails', async () => {
    const store = new MemorySignupStore()
    store.failCompanyCreate = new Error('database unavailable')

    const response = await runSelfSignup(validBody, store)

    expect(response.status).toBe(500)
    expect(response.body.errors?.[0]?.code).toBe('signup_failed')
    expect(store.users).toHaveLength(0)
    expect(store.companies).toHaveLength(0)
    expect(store.calls).toEqual(['precheck', 'begin', 'user', 'company', 'rollback'])
  })

  it('rejects invalid phone and national-ID syntax before any write', async () => {
    const store = new MemorySignupStore()

    const badPhone = await runSelfSignup({ ...validBody, phone: '12345' }, store)
    expect(badPhone.status).toBe(400)
    expect(badPhone.body.errors?.[0]).toMatchObject({ code: 'invalid_field', field: 'phone' })

    const badNationalId = await runSelfSignup(
      { ...validBody, companyNationalId: '1234567890a' },
      store,
    )
    expect(badNationalId.status).toBe(400)
    expect(badNationalId.body.errors?.[0]).toMatchObject({
      code: 'invalid_field',
      field: 'companyNationalId',
    })

    expect(store.users).toHaveLength(0)
    expect(store.companies).toHaveLength(0)
    expect(store.calls).toEqual([])
  })

  it('accepts an 11-digit national ID because the T03 dictionary is pending', async () => {
    const store = new MemorySignupStore()

    const response = await runSelfSignup(
      { ...validBody, companyNationalId: '12345678901' },
      store,
    )

    expect(response.status).toBe(201)
    expect(store.companies[0]?.nationalId).toBe('12345678901')
  })

  it('does not turn a malformed national ID into a duplicate conflict', async () => {
    const store = new MemorySignupStore()
    store.companies.push({ id: 'c-malformed', nationalId: '12a', name: 'Legacy malformed row' })

    const response = await runSelfSignup({ ...validBody, companyNationalId: '12a' }, store)

    expect(response.status).toBe(400)
    expect(response.body.errors?.[0]?.code).toBe('invalid_field')
    expect(store.users).toHaveLength(0)
    expect(store.calls).toEqual([])
  })

  it('does not reveal whether a phone or email account already exists', async () => {
    const store = new MemorySignupStore()
    store.users.push({
      id: 'u-existing',
      email: 'taken@example.com',
      phone: '09120000000',
      password: 'existing-password',
    })

    const response = await runSelfSignup(
      { ...validBody, email: 'TAKEN@example.com', phone: '09129999999' },
      store,
    )

    expect(response.status).toBe(400)
    expect(response.body.errors?.[0]?.code).toBe('signup_rejected')
    const serialized = JSON.stringify(response.body).toLowerCase()
    expect(serialized).not.toContain('taken@example.com')
    expect(serialized).not.toContain('duplicate')
    expect(serialized).not.toContain('already')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('phone')
    expect(store.users).toHaveLength(1)
    expect(store.companies).toHaveLength(0)
    expect(store.calls).toEqual(['precheck', 'begin', 'user', 'rollback'])
  })
})

describe('self-signup helpers', () => {
  it('keeps only person fields and normalizes email, phone and identifiers', () => {
    expect(pickUserFields({ ...validBody, phone: '۰۹۱۲۳۴۵۶۷۸۹', email: 'Rep@Example.COM' })).toEqual({
      email: 'rep@example.com',
      password: 'password123',
      phone: '09123456789',
      name: 'نماینده شرکت',
      position: 'مدیرعامل',
    })
    expect(pickCompanyFields({ ...validBody, companyNationalId: '۱۲۳۴۵۶۷۸۹۰' }, 7)).toMatchObject({
      representative: 7,
      nationalId: '1234567890',
      activityDomain: 'انرژی‌های تجدیدپذیر',
    })
  })

  it('requires the stage-1 person fields and the two core company fields', () => {
    expect(missingUserFields({})).toEqual(['name', 'position', 'phone', 'email', 'password'])
    expect(missingCompanyFields({})).toEqual(['companyName', 'companyNationalId'])
    expect(
      invalidSignupFields({ ...validBody, phone: '0912345678', companyNationalId: '1234abc' }),
    ).toEqual(['phone', 'companyNationalId'])
  })

  it('applies no national-ID length gate until T03 publishes the dictionary', () => {
    expect(invalidSignupFields({ ...validBody, companyNationalId: '1' })).toEqual([])
    expect(invalidSignupFields({ ...validBody, companyNationalId: '12345678901' })).toEqual([])
    expect(invalidSignupFields({ ...validBody, companyNationalId: '۱۲۳۴۵۶۷۸۹۰۱' })).toEqual([])
    expect(invalidSignupFields({ ...validBody, companyNationalId: '1234a' })).toEqual([
      'companyNationalId',
    ])
  })

  it('normalizes digits and login identifiers', () => {
    expect(normalizeDigits('۰۱۲۳/۴۵۶٧٨٩')).toBe('0123/456789')
    expect(normalizeLoginIdentifier(' ۰۹۱۲۳۴۵۶۷۸۹ ')).toBe('09123456789')
    expect(normalizeLoginIdentifier(' Person@Example.com ')).toBe('Person@Example.com')
  })

  it('requires unique-constraint evidence before calling an error a duplicate', () => {
    expect(isDuplicateNationalId(new DuplicateNationalIdError('1234567890'))).toBe(true)
    expect(
      isDuplicateNationalId({
        errors: [{ path: 'national_id', message: 'Value must be unique' }],
      }),
    ).toBe(true)
    expect(isDuplicateNationalId({ code: '23505', constraint: 'companies_national_id_unique' })).toBe(
      true,
    )
    expect(
      isDuplicateNationalId({
        errors: [{ path: 'national_id', message: 'Invalid national ID.' }],
      }),
    ).toBe(false)
    expect(isDuplicateNationalId({ errors: [{ path: 'phone', message: 'Value must be unique' }] })).toBe(
      false,
    )
  })
})
