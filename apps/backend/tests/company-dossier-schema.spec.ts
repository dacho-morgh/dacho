import { describe, expect, it } from 'vitest'

import { validateCompanyAbsenceList } from '../../../packages/cms-core/src/collections/companyAbsence.js'
import type { Company } from '../src/auth/company-store.js'
import { dossierOfCompany } from '../src/dashboard/dossier.js'

describe('company notAvailable collection boundary', () => {
  it('accepts only the permitted absence keys', () => {
    expect(validateCompanyAbsenceList(undefined)).toBe(true)
    expect(validateCompanyAbsenceList([])).toBe(true)
    expect(validateCompanyAbsenceList(['website', 'centerEstablishment'])).toBe(true)
  })

  it('rejects malformed direct writes instead of admitting arbitrary JSON', () => {
    expect(validateCompanyAbsenceList({ website: true })).toMatch(/array/)
    expect(validateCompanyAbsenceList('website')).toMatch(/array/)
    expect(validateCompanyAbsenceList(['website', 'notAField'])).toMatch(/unsupported/)
    expect(validateCompanyAbsenceList([42])).toMatch(/unsupported/)
  })

  it('does not crash when malformed data already exists in storage', () => {
    const malformed = {
      id: '1',
      representativeId: '1',
      notAvailable: { website: true },
    } as unknown as Company

    expect(dossierOfCompany(malformed).notAvailable).toEqual([])
  })
})
