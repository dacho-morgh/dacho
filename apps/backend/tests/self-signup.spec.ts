import express, { type Express } from 'express'
import request from 'supertest'
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
  type SelfSignupStore,
  type SelfSignupUser,
} from '@dacho/cms-core/auth/self-signup'

type StoredUser = SelfSignupUser & Record<string, unknown>
type StoredCompany = SelfSignupCompany & Record<string, unknown>

function uniqueViolation(constraint: string): Error {
  return Object.assign(new Error(`duplicate key value violates unique constraint "${constraint}"`), {
    code: '23505',
    constraint,
  })
}

/**
 * In-memory persistence behind the real signup use case. Transactions are
 * snapshot-based so the test can prove the person is removed when the company
 * write fails.
 */
class MemorySignupStore implements SelfSignupStore {
  users: StoredUser[] = []
  companies: StoredCompany[] = []
  failCompanyCreate?: Error
  private sequence = 0

  async companyNationalIdExists(nationalId: string): Promise<boolean> {
    return this.companies.some((company) => company.nationalId === nationalId)
  }

  async inTransaction<T>(run: () => Promise<T>): Promise<T> {
    const users = [...this.users]
    const companies = [...this.companies]
    try {
      return await run()
    } catch (error) {
      this.users = users
      this.companies = companies
      throw error
    }
  }

  async createUser(fields: Record<string, string>): Promise<StoredUser> {
    if (this.users.some((user) => user.phone === fields.phone))
      throw uniqueViolation('users_phone_unique')
    if (this.users.some((user) => user.email === fields.email))
      throw uniqueViolation('users_email_unique')
    const user: StoredUser = { id: `u${++this.sequence}`, ...fields }
    this.users.push(user)
    return user
  }

  async createCompany(fields: Record<string, string | number>): Promise<StoredCompany> {
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

  authenticate(identifier: string, password: string): StoredUser | undefined {
    const normalized = identifier.includes('@') ? identifier.toLowerCase() : identifier
    return this.users.find(
      (user) => (user.phone === normalized || user.email === normalized) && user.password === password,
    )
  }
}

function createHarness(store: MemorySignupStore): Express {
  const app = express()
  app.use(express.json())

  app.post('/api/users/self-signup', async (req, res) => {
    const result = await runSelfSignup(req.body, store)
    res.status(result.status).json(result.body)
  })

  app.post('/api/users/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const user = store.authenticate(normalizeLoginIdentifier(username), password)
    if (!user) {
      res.status(401).json({ errors: [{ message: 'Invalid credentials.' }] })
      return
    }
    res.json({ token: `session-${user.id}`, user: { id: user.id, phone: user.phone, email: user.email } })
  })

  return app
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

describe('self-signup HTTP contract', () => {
  it('creates person and company, persists activity domain, and issues a session after login', async () => {
    const store = new MemorySignupStore()
    const app = createHarness(store)

    const res = await request(app)
      .post('/api/users/self-signup')
      .send({ ...validBody, operationalRole: 'system-owner', isActive: true })

    expect(res.status).toBe(201)
    expect(res.body.user.id).toBeTruthy()
    expect(res.body.company).toMatchObject({
      representative: res.body.user.id,
      activityDomain: 'انرژی‌های تجدیدپذیر',
    })
    expect(store.users).toHaveLength(1)
    expect(store.companies).toHaveLength(1)
    expect(store.users[0]?.operationalRole).toBeUndefined()

    const login = await request(app)
      .post('/api/users/login')
      .send({ username: validBody.phone, password: validBody.password })
    expect(login.status).toBe(200)
    expect(login.body.token).toBeTruthy()
  })

  it('accepts an omitted activity domain during the temporary compatibility window', async () => {
    const store = new MemorySignupStore()
    const app = createHarness(store)
    const { activityDomain: _omitted, ...bodyWithoutDomain } = validBody

    const res = await request(app).post('/api/users/self-signup').send(bodyWithoutDomain)

    expect(res.status).toBe(201)
    expect(store.companies).toHaveLength(1)
    expect(store.companies[0]?.activityDomain).toBeUndefined()
  })

  it('returns a clear conflict for a duplicate national ID and leaves no orphan user', async () => {
    const store = new MemorySignupStore()
    store.companies.push({ id: 'c-existing', nationalId: validBody.companyNationalId, name: 'Existing Co' })
    const app = createHarness(store)

    const res = await request(app).post('/api/users/self-signup').send(validBody)

    expect(res.status).toBe(409)
    expect(res.body.errors[0]).toMatchObject({
      code: 'duplicate_national_id',
      field: 'companyNationalId',
    })
    expect(store.users).toHaveLength(0)
    expect(store.companies).toHaveLength(1)
  })

  it('rolls the user creation back completely when the company write fails', async () => {
    const store = new MemorySignupStore()
    store.failCompanyCreate = new Error('database unavailable')
    const app = createHarness(store)

    const res = await request(app).post('/api/users/self-signup').send(validBody)

    expect(res.status).toBe(500)
    expect(res.body.errors[0]?.code).toBe('signup_failed')
    expect(store.users).toHaveLength(0)
    expect(store.companies).toHaveLength(0)
  })

  it('logs in with phone and with email plus password, including Persian digits', async () => {
    const store = new MemorySignupStore()
    const app = createHarness(store)
    expect((await request(app).post('/api/users/self-signup').send(validBody)).status).toBe(201)

    const byPhone = await request(app)
      .post('/api/users/login')
      .send({ username: validBody.phone, password: validBody.password })
    expect(byPhone.status).toBe(200)

    const byPersianPhone = await request(app)
      .post('/api/users/login')
      .send({ username: '۰۹۱۲۳۴۵۶۷۸۹', password: validBody.password })
    expect(byPersianPhone.status).toBe(200)

    const byEmail = await request(app)
      .post('/api/users/login')
      .send({ username: 'Representative@Example.com', password: validBody.password })
    expect(byEmail.status).toBe(200)

    const wrongPassword = await request(app)
      .post('/api/users/login')
      .send({ username: validBody.phone, password: 'wrong-password' })
    expect(wrongPassword.status).toBe(401)
  })

  it('rejects invalid phone and national-ID syntax with 400 before any write', async () => {
    const store = new MemorySignupStore()
    const app = createHarness(store)

    const badPhone = await request(app)
      .post('/api/users/self-signup')
      .send({ ...validBody, phone: '12345' })
    expect(badPhone.status).toBe(400)
    expect(badPhone.body.errors[0]).toMatchObject({ code: 'invalid_field', field: 'phone' })

    const badNationalId = await request(app)
      .post('/api/users/self-signup')
      .send({ ...validBody, companyNationalId: '123456789' })
    expect(badNationalId.status).toBe(400)
    expect(badNationalId.body.errors[0]).toMatchObject({
      code: 'invalid_field',
      field: 'companyNationalId',
    })

    expect(store.users).toHaveLength(0)
    expect(store.companies).toHaveLength(0)
  })

  it('does not turn a malformed national ID into a duplicate conflict', async () => {
    const store = new MemorySignupStore()
    store.companies.push({ id: 'c-malformed', nationalId: '123', name: 'Legacy malformed row' })
    const app = createHarness(store)

    const res = await request(app)
      .post('/api/users/self-signup')
      .send({ ...validBody, companyNationalId: '123' })

    expect(res.status).toBe(400)
    expect(res.body.errors[0]?.code).toBe('invalid_field')
    expect(store.users).toHaveLength(0)
  })

  it('does not reveal whether a phone or email account already exists', async () => {
    const store = new MemorySignupStore()
    store.users.push({
      id: 'u-existing',
      email: 'taken@example.com',
      phone: '09120000000',
      password: 'existing-password',
    })
    const app = createHarness(store)

    const res = await request(app)
      .post('/api/users/self-signup')
      .send({ ...validBody, email: 'TAKEN@example.com', phone: '09129999999' })

    expect(res.status).toBe(400)
    expect(res.body.errors[0]?.code).toBe('signup_rejected')
    const serialized = JSON.stringify(res.body).toLowerCase()
    expect(serialized).not.toContain('taken@example.com')
    expect(serialized).not.toContain('duplicate')
    expect(serialized).not.toContain('already')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('phone')
    expect(store.users).toHaveLength(1)
    expect(store.companies).toHaveLength(0)
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
    expect(invalidSignupFields({ ...validBody, phone: '0912345678', companyNationalId: '12345678901' })).toEqual([
      'phone',
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
    expect(isDuplicateNationalId({ code: '23505', constraint: 'companies_national_id_unique' })).toBe(true)
    expect(
      isDuplicateNationalId({
        errors: [{ path: 'national_id', message: 'Invalid national ID.' }],
      }),
    ).toBe(false)
    expect(isDuplicateNationalId({ errors: [{ path: 'phone', message: 'Value must be unique' }] })).toBe(false)
  })
})
