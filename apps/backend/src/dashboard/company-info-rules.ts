import type { CompanyInfo } from './profile-repo.js'

/**
 * The registration rules for the company fields a representative can edit on
 * the profile, mirrored from the self-signup endpoint
 * (`packages/cms-core/src/auth/self-signup.ts`) so a company cannot be edited
 * into a state registration would refuse. The register form and the profile
 * form show the same Persian messages (`apps/frontend/src/utilities/company-basic-rules.ts`).
 */

/**
 * Every value the CMS `companies.type` select accepts: the legal forms of
 * Article 20, plus the earlier values existing records may still hold. Kept
 * equal to `COMPANY_TYPE_OPTIONS` in cms-core (`tests/company-info-rules.spec.ts`).
 */
export const COMPANY_TYPE_OPTIONS = [
  'سهامی عام',
  'سهامی خاص',
  'مسئولیت محدود',
  'تضامنی',
  'مختلط غیرسهامی',
  'مختلط سهامی',
  'نسبی',
  'تعاونی',
  'دانش‌بنیان',
  'استارتاپ',
  'سایر',
] as const

export type CompanyInfoReason =
  | 'required'
  | 'registration_number_digits'
  | 'registration_number_length'
  | 'economic_code_digits'
  | 'economic_code_length'
  | 'company_type'
  | 'establishment_date'

export interface CompanyInfoProblem {
  field: keyof CompanyInfo
  reason: CompanyInfoReason
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

const NUMERIC_FIELDS = ['registrationNumber', 'economicCode', 'establishmentDate'] as const

/**
 * Trims the supplied fields and writes numeric ones with ASCII digits, as the
 * signup endpoint stores them. Fields that are absent stay absent.
 */
export function normalizeCompanyEdit(edit: Partial<CompanyInfo>): Partial<CompanyInfo> {
  const out: Partial<CompanyInfo> = {}
  for (const [field, value] of Object.entries(edit) as Array<[keyof CompanyInfo, unknown]>) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    out[field] = (NUMERIC_FIELDS as readonly string[]).includes(field) ? normalizeDigits(trimmed) : trimmed
  }
  return out
}

/**
 * The problems in a (normalized) company edit. Only supplied fields that
 * differ from the stored ones are checked; a field left out keeps its value.
 */
export function companyInfoProblems(
  supplied: Partial<CompanyInfo>,
  current: CompanyInfo,
): CompanyInfoProblem[] {
  // A value sent back unchanged is not re-checked: a record saved under older
  // rules can still have its other fields edited.
  const edit: Partial<CompanyInfo> = {}
  for (const [field, value] of Object.entries(supplied) as Array<[keyof CompanyInfo, string]>) {
    if (value !== current[field]) edit[field] = value
  }
  const problems: CompanyInfoProblem[] = []
  const required = ['name', 'registrationNumber', 'type', 'province', 'city', 'establishmentDate', 'economicCode'] as const
  for (const field of required) {
    if (edit[field] !== undefined && edit[field] === '') problems.push({ field, reason: 'required' })
  }

  const registrationNumber = edit.registrationNumber
  if (registrationNumber) {
    if (!/^\d+$/.test(registrationNumber))
      problems.push({ field: 'registrationNumber', reason: 'registration_number_digits' })
    else if (registrationNumber.length < 3 || registrationNumber.length > 6)
      problems.push({ field: 'registrationNumber', reason: 'registration_number_length' })
  }

  const economicCode = edit.economicCode
  if (economicCode) {
    if (!/^\d+$/.test(economicCode)) problems.push({ field: 'economicCode', reason: 'economic_code_digits' })
    else if (economicCode.length !== 11) problems.push({ field: 'economicCode', reason: 'economic_code_length' })
  }

  const type = edit.type
  if (type && !(COMPANY_TYPE_OPTIONS as readonly string[]).includes(type))
    problems.push({ field: 'type', reason: 'company_type' })

  // The register form stores the Jalali date as YYYY/MM/DD.
  const date = edit.establishmentDate
  if (date && !/^\d{4}\/\d{2}\/\d{2}$/.test(date))
    problems.push({ field: 'establishmentDate', reason: 'establishment_date' })

  return problems
}
