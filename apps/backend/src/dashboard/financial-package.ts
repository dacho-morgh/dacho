import type { DocumentCategory } from '../access/policy.js'
import { FINANCIAL_CHECKLIST } from './financial-invitation.js'

/** Statement years asked for: the last three completed years, or every year since establishment for a younger company. */
export const STATEMENT_YEARS_BACK = 3

export type StatementYearPlan =
  | { ok: true; years: number[]; younger: boolean }
  | { ok: false; error: 'establishment_date_unavailable' }

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

/**
 * The founding year from the profile's free-text date. The first four-digit group
 * wins. A Persian year (1200–1450) becomes Gregorian by adding 621, which is exact
 * for dates after 20 March and one year early before it; that is accepted for a
 * year-level rule. Anything else returns null.
 */
export function foundingYearOf(text: string | null | undefined): number | null {
  const normalized = (text ?? '').replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
  const match = /(?<!\d)(\d{4})(?!\d)/.exec(normalized)
  if (!match) return null
  const year = Number(match[1])
  if (year >= 1200 && year <= 1450) return year + 621
  if (year >= 1900 && year <= 2200) return year
  return null
}

/**
 * The statement years the package must cover. Fiscal years are taken as calendar
 * years (an open product question), and only completed years count.
 */
export function statementYearPlan(establishmentDate: string | null | undefined, now: Date = new Date()): StatementYearPlan {
  const founded = foundingYearOf(establishmentDate)
  if (founded === null) return { ok: false, error: 'establishment_date_unavailable' }
  const lastCompleted = now.getUTCFullYear() - 1
  const firstRequired = lastCompleted - STATEMENT_YEARS_BACK + 1
  const younger = founded > firstRequired
  const from = younger ? founded : firstRequired
  const years: number[] = []
  for (let year = from; year <= lastCompleted; year += 1) years.push(year)
  return { ok: true, years, younger }
}

export interface PackageFileFact {
  category: DocumentCategory
  statementYear: number | null
}

export interface PackageGaps {
  missingCategories: DocumentCategory[]
  missingStatementYears: number[]
}

/** Every checklist category needs a file, and every expected statement year needs one statement file. */
export function packageGaps(files: readonly PackageFileFact[], expectedYears: readonly number[]): PackageGaps {
  const present = new Set(files.map((file) => file.category))
  const coveredYears = new Set(
    files.filter((file) => file.category === 'financialStatements').map((file) => file.statementYear),
  )
  return {
    missingCategories: FINANCIAL_CHECKLIST.map((item) => item.category).filter((category) => !present.has(category)),
    missingStatementYears: expectedYears.filter((year) => !coveredYears.has(year)),
  }
}

export function isPackageComplete(gaps: PackageGaps): boolean {
  return gaps.missingCategories.length === 0 && gaps.missingStatementYears.length === 0
}

/** Accepts only a plain four-digit Gregorian year, so an empty or stray value never reaches storage. */
export function parseStatementYear(value: unknown): number | null {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
  if (!/^\d{4}$/.test(text)) return null
  const year = Number(text)
  return year >= 1900 && year <= 2200 ? year : null
}

export interface FinancialPackageDocumentDto {
  id: string
  category: DocumentCategory
  filename: string
  sizeBytes: number
  logicalVersion: number
  statementYear: number | null
}

export interface FinancialPackageDto {
  id: string
  requestId: string
  invitationId: string
  packageVersion: number
  checklistVersion: string
  statementYears: number[]
  documents: FinancialPackageDocumentDto[]
  submittedBy: string
  submittedAt: string
}
