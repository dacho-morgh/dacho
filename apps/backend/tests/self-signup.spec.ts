import { describe, expect, it } from 'vitest'

import {
  DuplicateNationalIdError,
  invalidSignupFields,
  isDuplicateNationalId,
  isValidLegalEntityNationalId,
  legalEntityCheckDigit,
  missingCompanyFields,
  missingUserFields,
  nationalIdProblem,
  normalizeDigits,
  normalizeLoginIdentifier,
  pickCompanyFields,
  pickUserFields,
  runSelfSignup,
  signupFieldProblems,
  type SelfSignupCompany,
  type SelfSignupResponse,
  type SelfSignupStore,
  type SelfSignupUser,
  type SignupCredentials,
  type SignupSession,
} from '@dacho/cms-core/auth/self-signup'

type StoredUser = SelfSignupUser & Record<string, unknown>
type StoredCompany = SelfSignupCompany & Record<string, unknown>
type StoreCall = 'precheck' | 'begin' | 'user' | 'company' | 'commit' | 'rollback' | 'session'

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
  // A real-format legal-entity national ID (11 digits, valid check digit).
  companyNationalId: '10380284790',
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

  it.each([undefined, '', '   '])(
    'rejects a missing activity domain (%j) before any write now that FE03 collects it',
    async (activityDomain) => {
      const store = new MemorySignupStore()
      const { activityDomain: _omitted, ...bodyWithoutDomain } = validBody
      const body = activityDomain === undefined ? bodyWithoutDomain : { ...validBody, activityDomain }

      const response = await runSelfSignup(body, store)

      expect(response.status).toBe(400)
      expect(response.body.errors).toEqual([
        expect.objectContaining({ code: 'missing_field', field: 'activityDomain' }),
      ])
      expect(store.users).toHaveLength(0)
      expect(store.companies).toHaveLength(0)
      expect(store.calls).toEqual([])
    },
  )

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

  it('rejects invalid phone, email and national-ID syntax before any write, naming the rule', async () => {
    const store = new MemorySignupStore()

    const badPhone = await runSelfSignup({ ...validBody, phone: '12345' }, store)
    expect(badPhone.status).toBe(400)
    expect(badPhone.body.errors).toEqual([
      expect.objectContaining({ code: 'invalid_field', field: 'phone', reason: 'mobile_format' }),
    ])

    const badEmail = await runSelfSignup({ ...validBody, email: 'person@example' }, store)
    expect(badEmail.status).toBe(400)
    expect(badEmail.body.errors).toEqual([
      expect.objectContaining({ code: 'invalid_field', field: 'email', reason: 'email_format' }),
    ])

    const badNationalId = await runSelfSignup(
      { ...validBody, companyNationalId: '1038028479a' },
      store,
    )
    expect(badNationalId.status).toBe(400)
    expect(badNationalId.body.errors).toEqual([
      expect.objectContaining({
        code: 'invalid_field',
        field: 'companyNationalId',
        reason: 'digits_only',
      }),
    ])

    expect(store.users).toHaveLength(0)
    expect(store.companies).toHaveLength(0)
    expect(store.calls).toEqual([])
  })

  it.each([
    ['1038028479', 'length'],
    ['103802847900', 'length'],
    ['10380284792', 'checksum'],
    ['00000000000', 'checksum'],
  ])('rejects the national ID %s (%s) before any write', async (companyNationalId, reason) => {
    const store = new MemorySignupStore()

    const response = await runSelfSignup({ ...validBody, companyNationalId }, store)

    expect(response.status).toBe(400)
    expect(response.body.errors).toEqual([
      expect.objectContaining({ code: 'invalid_field', field: 'companyNationalId', reason }),
    ])
    expect(store.calls).toEqual([])
  })

  it('reports every invalid field at once, in a stable order', async () => {
    const response = await runSelfSignup(
      { ...validBody, phone: '0912', email: 'no-at-sign', companyNationalId: '123' },
      new MemorySignupStore(),
    )

    expect(response.body.errors?.map(({ field, reason }) => [field, reason])).toEqual([
      ['phone', 'mobile_format'],
      ['email', 'email_format'],
      ['companyNationalId', 'length'],
    ])
  })

  it('accepts a valid national ID typed with Persian digits and stores ASCII digits', async () => {
    const store = new MemorySignupStore()

    const response = await runSelfSignup(
      { ...validBody, companyNationalId: '۱۰۳۸۰۲۸۴۷۹۰' },
      store,
    )

    expect(response.status).toBe(201)
    expect(store.companies[0]?.nationalId).toBe('10380284790')
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

/** The public endpoint's store: it can also sign the new person in. */
class SessionSignupStore extends MemorySignupStore {
  sessions: SignupCredentials[] = []
  failSession?: Error

  async startSession(credentials: SignupCredentials): Promise<SignupSession> {
    this.calls.push('session')
    if (this.failSession) throw this.failSession
    // Sign-in reads committed rows, exactly as the Payload login does.
    const user = this.users.find((candidate) => candidate.email === credentials.email)
    if (!user || user.password !== credentials.password) throw new Error('invalid credentials')
    this.sessions.push(credentials)
    return { exp: 1_900_000_000, headers: { 'Set-Cookie': 'payload-token=signed; Path=/; HttpOnly=true' } }
  }
}

describe('self-signup session (#278 auto-login)', () => {
  it('signs the new representative in only after the transaction commits', async () => {
    const store = new SessionSignupStore()

    const response = await runSelfSignup(
      { ...validBody, email: ' Representative@Example.COM ', password: ' password123 ' },
      store,
    )

    expect(response.status).toBe(201)
    expect(store.calls).toEqual(['precheck', 'begin', 'user', 'company', 'commit', 'session'])
    // The stored, normalized credentials are the ones used to sign in.
    expect(store.sessions).toEqual([{ email: 'representative@example.com', password: 'password123' }])
    expect(response.headers).toEqual({ 'Set-Cookie': 'payload-token=signed; Path=/; HttpOnly=true' })
    expect(response.body.session).toEqual({ established: true, exp: 1_900_000_000 })
    expect(response.body.user?.id).toBe(store.users[0]?.id)
    // The token is carried by the cookie only.
    expect(JSON.stringify(response.body)).not.toContain('payload-token')
  })

  it('keeps a committed signup successful when signing in fails', async () => {
    const store = new SessionSignupStore()
    store.failSession = new Error('session store unavailable')
    const errors: unknown[] = []

    const response = await runSelfSignup(validBody, store, (error) => errors.push(error))

    expect(response.status).toBe(201)
    expect(response.headers).toBeUndefined()
    expect(response.body.session).toEqual({ established: false })
    expect(response.body.company).toBeDefined()
    expect(store.users).toHaveLength(1)
    expect(store.companies).toHaveLength(1)
    expect(errors).toEqual([store.failSession])
  })

  it.each([
    ['a missing field', { ...validBody, name: '' }],
    ['an invalid national ID', { ...validBody, companyNationalId: '10380284791' }],
  ])('never signs anyone in for %s', async (_label, body) => {
    const store = new SessionSignupStore()

    const response = await runSelfSignup(body, store)

    expect(response.status).toBe(400)
    expect(response.headers).toBeUndefined()
    expect(response.body.session).toBeUndefined()
    expect(store.calls).not.toContain('session')
  })

  it('never signs anyone in for a duplicate company, an existing account or a rolled-back write', async () => {
    const duplicate = new SessionSignupStore()
    duplicate.companies.push({ id: 'c-existing', nationalId: validBody.companyNationalId })
    expect((await runSelfSignup(validBody, duplicate)).status).toBe(409)

    const existing = new SessionSignupStore()
    existing.users.push({ id: 'u-existing', email: validBody.email, phone: '09120000000', password: 'other' })
    const rejected = await runSelfSignup(validBody, existing)
    expect(rejected.status).toBe(400)
    expect(rejected.body.errors?.[0]?.code).toBe('signup_rejected')

    const failing = new SessionSignupStore()
    failing.failCompanyCreate = new Error('database unavailable')
    expect((await runSelfSignup(validBody, failing)).status).toBe(500)

    for (const store of [duplicate, existing, failing]) {
      expect(store.calls).not.toContain('session')
      expect(store.sessions).toEqual([])
    }
  })

  it('omits the session entirely when the caller does not sign in (owner enrolment)', async () => {
    const response = await runSelfSignup(validBody, new MemorySignupStore())

    expect(response.status).toBe(201)
    expect(response.body).not.toHaveProperty('session')
    expect(response.headers).toBeUndefined()
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

  it('requires the stage-1 person fields and the three stage-1 company fields', () => {
    expect(missingUserFields({})).toEqual(['name', 'position', 'phone', 'email', 'password'])
    expect(missingCompanyFields({})).toEqual(['companyName', 'companyNationalId', 'activityDomain'])
    expect(
      invalidSignupFields({ ...validBody, phone: '0912345678', companyNationalId: '1234abc' }),
    ).toEqual(['phone', 'companyNationalId'])
  })

  it('validates the legal-entity national ID: 11 digits and the check digit', () => {
    // Published real-format examples.
    expect(nationalIdProblem('10380284790')).toBeUndefined()
    expect(nationalIdProblem('14007650912')).toBeUndefined()
    expect(nationalIdProblem('10100834460')).toBeUndefined()
    expect(isValidLegalEntityNationalId(' ۱۴۰۰۷۶۵۰۹۱۲ ')).toBe(true)

    expect(nationalIdProblem('1')).toBe('length')
    expect(nationalIdProblem('1234567890')).toBe('length')
    expect(nationalIdProblem('1234a')).toBe('digits_only')
    expect(nationalIdProblem('14007650913')).toBe('checksum')
    expect(nationalIdProblem('00000000000')).toBe('checksum')
    // A zero six-digit serial is never issued, even when the digit would match.
    expect(nationalIdProblem(`1020000000${legalEntityCheckDigit('1020000000')}`)).toBe('checksum')
  })

  it('computes the check digit, writing a remainder of 10 as 0', () => {
    expect(legalEntityCheckDigit('1038028479')).toBe(0)
    expect(legalEntityCheckDigit('1400765091')).toBe(2)
    // The weighted sum of this prefix leaves a remainder of 10.
    expect(legalEntityCheckDigit('1410234505')).toBe(0)
    expect(nationalIdProblem('14102345050')).toBeUndefined()
    expect(() => legalEntityCheckDigit('123')).toThrow()
    // Every prefix maps to exactly one accepted ID.
    for (const prefix of ['1410234501', '9917420100', '1010101010']) {
      const valid = `${prefix}${legalEntityCheckDigit(prefix)}`
      expect(nationalIdProblem(valid)).toBeUndefined()
      const others = [...'0123456789'].filter((digit) => `${prefix}${digit}` !== valid)
      for (const digit of others) expect(nationalIdProblem(`${prefix}${digit}`)).toBe('checksum')
    }
  })

  it('validates the mobile and email shapes', () => {
    const problems = (body: Record<string, string>) =>
      signupFieldProblems({ ...validBody, ...body }).map((problem) => problem.reason)
    expect(problems({ phone: '۰۹۱۲۳۴۵۶۷۸۹' })).toEqual([])
    expect(problems({ phone: '9123456789' })).toEqual(['mobile_format'])
    expect(problems({ phone: '+989123456789' })).toEqual(['mobile_format'])
    expect(problems({ phone: '091234567890' })).toEqual(['mobile_format'])
    expect(problems({ email: 'Person.Name+tag@Sub.Example.IR' })).toEqual([])
    for (const email of ['person', 'person@', '@example.com', 'a b@example.com', 'a..b@example.com', 'a@example.c'])
      expect(problems({ email })).toEqual(['email_format'])
    expect(problems({ email: `${'a'.repeat(250)}@example.com` })).toEqual(['email_format'])
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
