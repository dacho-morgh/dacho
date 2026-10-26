/**
 * `/self-signup` — public company registration.
 *
 * Registration is one atomic act: a person joins the system **as the
 * representative of a new company**. Both records are created in a single
 * transaction, so a rejected company (a duplicate national id, say) never
 * leaves a half-registered person behind who can no longer sign up again
 * because their phone and username are unique.
 */

export interface SelfSignupBody {
  [key: string]: unknown
  // Person → `users`
  email?: string
  password?: string
  phone?: string
  name?: string
  position?: string
  // Company → `companies`. The `company` prefixes are what the register form
  // posts; they map onto the company record's own field names below.
  companyName?: string
  companyNationalId?: string
  activityDomain?: string
  companyRegistrationNumber?: string
  companyType?: string
  companyProvince?: string
  companyCity?: string
  companyEstablishmentDate?: string
  companyStatus?: string
  companyEconomicCode?: string
}

export interface SelfSignupResult {
  user: { id: number | string }
  company: { id: number | string; name?: string | null; nationalId?: string | null }
}

/** Only the person fields are forwarded; role fields are never accepted. */
const USER_FIELDS = ['email', 'password', 'phone', 'name', 'position'] as const

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/**
 * Normalizes Persian/Arabic-Indic digits to ASCII. Numeric identifiers keep
 * their string type and leading zeroes; every other character is unchanged.
 */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const digits = (value: unknown): string | undefined => {
  const text = str(value)
  return text === undefined ? undefined : normalizeDigits(text)
}

/** Emails are stored lower-case because Payload's login lookup lower-cases them. */
const email = (value: unknown): string | undefined => str(value)?.toLowerCase()

/**
 * Login accepts either the representative's phone or email. Payload already
 * lower-cases and trims the identifier; phone digits are normalized here so a
 * Persian/Arabic keyboard produces the stored ASCII number.
 */
export function normalizeLoginIdentifier(value: string): string {
  const trimmed = value.trim()
  return trimmed.includes('@') ? trimmed : normalizeDigits(trimmed)
}

/** Picks the person fields, dropping anything absent or blank. */
export function pickUserFields(body: SelfSignupBody): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of USER_FIELDS) {
    const value =
      field === 'email' ? email(body[field]) : field === 'phone' ? digits(body[field]) : str(body[field])
    if (value !== undefined) out[field] = value
  }
  return out
}

/**
 * Maps the form's `company`-prefixed body onto the `companies` record. The
 * representative is not taken from the body — it is always the user created in
 * the same transaction.
 */
export function pickCompanyFields(
  body: SelfSignupBody,
  representativeId: number | string,
): Record<string, string | number> {
  const fields: Record<string, string | number> = { representative: representativeId }
  const mapping: Record<string, string> = {
    companyName: 'name',
    companyNationalId: 'nationalId',
    activityDomain: 'activityDomain',
    companyRegistrationNumber: 'registrationNumber',
    companyType: 'type',
    companyProvince: 'province',
    companyCity: 'city',
    companyEstablishmentDate: 'establishmentDate',
    companyStatus: 'status',
    companyEconomicCode: 'economicCode',
  }
  // Numeric identifiers are normalized at the API boundary so all clients and
  // login/duplicate lookups agree on one representation.
  const numericSources = new Set([
    'companyNationalId',
    'companyRegistrationNumber',
    'companyEstablishmentDate',
    'companyEconomicCode',
  ])
  for (const [from, to] of Object.entries(mapping)) {
    const value = numericSources.has(from) ? digits(body[from]) : str(body[from])
    if (value !== undefined) fields[to] = value
  }
  return fields
}

/** The company fields the server actually requires for stage 1. */
export function missingCompanyFields(body: SelfSignupBody): string[] {
  const missing: string[] = []
  if (!str(body.companyName)) missing.push('companyName')
  if (!str(body.companyNationalId)) missing.push('companyNationalId')
  if (!str(body.activityDomain)) missing.push('activityDomain')
  return missing
}

/** The person fields the server actually requires for stage 1. */
export function missingUserFields(body: SelfSignupBody): string[] {
  const missing: string[] = []
  if (!str(body.name)) missing.push('name')
  if (!str(body.position)) missing.push('position')
  if (!str(body.phone)) missing.push('phone')
  if (!str(body.email)) missing.push('email')
  if (!str(body.password)) missing.push('password')
  return missing
}

/** A national id that already belongs to a company. */
export class DuplicateNationalIdError extends Error {
  readonly nationalId: string
  constructor(nationalId: string) {
    super(`A company with national id ${nationalId} is already registered.`)
    this.name = 'DuplicateNationalIdError'
    this.nationalId = nationalId
  }
}

const mentionsNationalId = (value: unknown): boolean =>
  typeof value === 'string' && /national[_ ]?id/i.test(value)

/**
 * Payload turns a PostgreSQL unique violation into a `ValidationError` whose
 * `errors[].path` is the offending column, and keeps the driver error on
 * `cause`; a raw driver failure exposes `constraint` instead. Both shapes (and
 * the legacy `field` spelling) must be recognised, otherwise the duplicate
 * national id would leak through as an opaque 500 after the transaction rolls
 * back. Only a national-id-shaped error is accepted, so an unrelated unique
 * violation on the person (phone/email) is never misreported as this company.
 */
export function isDuplicateNationalId(error: unknown): boolean {
  if (error instanceof DuplicateNationalIdError) return true

  const seen = new Set<object>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)

    const errors = (current as { errors?: unknown }).errors
    if (Array.isArray(errors)) {
      const duplicate = errors.some((entry) => {
        if (!entry || typeof entry !== 'object') return false
        const e = entry as { field?: unknown; path?: unknown }
        return mentionsNationalId(e.field) || mentionsNationalId(e.path)
      })
      if (duplicate) return true
    }

    if (mentionsNationalId((current as { constraint?: unknown }).constraint)) return true
    current = (current as { cause?: unknown }).cause
  }

  return false
}
