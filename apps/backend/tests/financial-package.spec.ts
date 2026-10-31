import { describe, expect, it } from 'vitest'

import { FINANCIAL_CATEGORIES } from '../src/access/policy.js'
import {
  foundingYearOf,
  isPackageComplete,
  packageGaps,
  parseStatementYear,
  statementYearPlan,
} from '../src/dashboard/financial-package.js'

const NOW = new Date('2026-10-31T06:00:00Z')

describe('financial package rules (T30)', () => {
  it('reads the founding year from Gregorian, Persian or Persian-digit dates', () => {
    expect(foundingYearOf('2021-03-01')).toBe(2021)
    expect(foundingYearOf('1398/05/12')).toBe(2019)
    expect(foundingYearOf('۱۳۹۸/۰۵/۱۲')).toBe(2019)
    expect(foundingYearOf('')).toBeNull()
    expect(foundingYearOf('نامشخص')).toBeNull()
    expect(foundingYearOf(undefined)).toBeNull()
  })

  it('asks for the last three completed years for an established company', () => {
    expect(statementYearPlan('2010', NOW)).toEqual({ ok: true, years: [2023, 2024, 2025], younger: false })
  })

  it('asks for every completed year since establishment for a younger company', () => {
    expect(statementYearPlan('2024', NOW)).toEqual({ ok: true, years: [2024, 2025], younger: true })
    expect(statementYearPlan('2026', NOW)).toEqual({ ok: true, years: [], younger: true })
  })

  it('refuses to plan without a readable founding date', () => {
    expect(statementYearPlan('', NOW)).toEqual({ ok: false, error: 'establishment_date_unavailable' })
  })

  it('lists every missing checklist category and statement year', () => {
    const gaps = packageGaps(
      [
        { category: 'financialStatements', statementYear: 2023 },
        { category: 'financialStatements', statementYear: null },
        { category: 'debtFacilityEvidence', statementYear: null },
      ],
      [2023, 2024],
    )
    expect(gaps.missingStatementYears).toEqual([2024])
    expect(gaps.missingCategories).toEqual(
      FINANCIAL_CATEGORIES.filter((category) => category !== 'financialStatements' && category !== 'debtFacilityEvidence'),
    )
    expect(isPackageComplete(gaps)).toBe(false)
  })

  it('is complete once every category and every expected year has a file', () => {
    const files = FINANCIAL_CATEGORIES.map((category) => ({
      category,
      statementYear: category === 'financialStatements' ? 2025 : null,
    }))
    expect(isPackageComplete(packageGaps(files, [2025]))).toBe(true)
  })

  it('accepts only four-digit Gregorian years for statement files', () => {
    expect(parseStatementYear('2025')).toBe(2025)
    expect(parseStatementYear(' 2025 ')).toBe(2025)
    expect(parseStatementYear(2025)).toBe(2025)
    expect(parseStatementYear('25')).toBeNull()
    expect(parseStatementYear('1899')).toBeNull()
    expect(parseStatementYear('2025.5')).toBeNull()
    expect(parseStatementYear(undefined)).toBeNull()
  })
})
