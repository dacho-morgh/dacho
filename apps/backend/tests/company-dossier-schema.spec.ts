import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { validateCompanyAbsenceList } from '../../../packages/cms-core/src/collections/companyAbsence.js'
import type { Company } from '../src/auth/company-store.js'
import { dossierOfCompany } from '../src/dashboard/dossier.js'

describe('company notAvailable collection boundary', () => {
  it('keeps activity_domain ownership solely in the dossier migration', () => {
    const signupMigration = readFileSync(new URL('../../../packages/cms-core/src/migrations/20261026_100000_add_company_activity_domain.ts', import.meta.url), 'utf8')
    expect(signupMigration).not.toMatch(/ALTER TABLE/i)
    const dossierMigration = readFileSync(new URL('../../../packages/cms-core/src/migrations/20261026_120000_company_dossier.ts', import.meta.url), 'utf8')
    expect(dossierMigration).toContain('ADD COLUMN IF NOT EXISTS "activity_domain"')
    expect(dossierMigration).toContain('DROP COLUMN IF EXISTS "activity_domain"')
  })

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
