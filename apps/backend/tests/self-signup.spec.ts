import { describe, expect, it } from 'vitest'

import {
  DuplicateNationalIdError,
  isDuplicateNationalId,
  missingCompanyFields,
  missingUserFields,
  normalizeDigits,
  normalizeLoginIdentifier,
  pickCompanyFields,
  pickUserFields,
  type SelfSignupBody,
} from '@dacho/cms-core/auth/self-signup'

const body: SelfSignupBody = {
  email: '  Representative@Example.COM ',
  password: 'password123',
  phone: '۰۹۱۲۳۴۵۶۷۸۹',
  name: '  نماینده شرکت ',
  position: 'مدیرعامل',
  companyName: 'شرکت نمونه',
  companyNationalId: '۱۲۳۴۵۶۷۸۹۰۱',
  activityDomain: 'انرژی‌های تجدیدپذیر',
  companyRegistrationNumber: '۵۴۳۲۱',
  companyEconomicCode: '۹۸۷۶۵',
  operationalRole: 'system-owner',
  isActive: false,
}

describe('self-signup contract', () => {
  it('keeps only person fields and normalizes email and phone', () => {
    expect(pickUserFields(body)).toEqual({
      email: 'representative@example.com',
      password: 'password123',
      phone: '09123456789',
      name: 'نماینده شرکت',
      position: 'مدیرعامل',
    })
  })

  it('maps the stage-1 company fields, including activity domain', () => {
    expect(pickCompanyFields(body, 7)).toEqual({
      representative: 7,
      name: 'شرکت نمونه',
      nationalId: '12345678901',
      activityDomain: 'انرژی‌های تجدیدپذیر',
      registrationNumber: '54321',
      economicCode: '98765',
    })
  })

  it('requires every stage-1 company and representative field', () => {
    expect(missingCompanyFields({})).toEqual([
      'companyName',
      'companyNationalId',
      'activityDomain',
    ])
    expect(missingUserFields({})).toEqual(['name', 'position', 'phone', 'email', 'password'])
    expect(missingCompanyFields(body)).toEqual([])
    expect(missingUserFields(body)).toEqual([])
  })

  it('normalizes Persian and Arabic-Indic digits without changing other text', () => {
    expect(normalizeDigits('۰۱۲۳/۴۵۶٧٨٩')).toBe('0123/456789')
  })

  it('normalizes a phone identifier but leaves an email alone for Payload', () => {
    expect(normalizeLoginIdentifier(' ۰۹۱۲۳۴۵۶۷۸۹ ')).toBe('09123456789')
    expect(normalizeLoginIdentifier(' Person@Example.com ')).toBe('Person@Example.com')
  })
})

describe('duplicate national id detection', () => {
  it('recognizes Payload’s ValidationError path after a unique violation', () => {
    expect(isDuplicateNationalId({ errors: [{ path: 'national_id', message: 'Value must be unique' }] })).toBe(true)
  })

  it('recognizes the legacy field spelling and a raw driver constraint', () => {
    expect(isDuplicateNationalId({ errors: [{ field: 'companyNationalId' }] })).toBe(true)
    expect(
      isDuplicateNationalId({ code: '23505', constraint: 'companies_national_id_unique' }),
    ).toBe(true)
  })

  it('looks through the wrapped driver cause', () => {
    expect(
      isDuplicateNationalId({
        cause: { code: '23505', constraint: 'companies_national_id_unique' },
      }),
    ).toBe(true)
    expect(isDuplicateNationalId(new DuplicateNationalIdError('123'))).toBe(true)
  })

  it('does not confuse another unique violation with a duplicate company', () => {
    expect(isDuplicateNationalId({ errors: [{ path: 'phone', message: 'Value must be unique' }] })).toBe(false)
    expect(isDuplicateNationalId(new Error('database unavailable'))).toBe(false)
    expect(isDuplicateNationalId(null)).toBe(false)
  })
})
