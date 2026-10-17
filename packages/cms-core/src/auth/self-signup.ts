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

/** Only the six person fields are forwarded; role fields are never accepted. */
const USER_FIELDS = ['email', 'password', 'phone', 'name', 'position'] as const

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

/** Picks the person fields, dropping anything absent or blank. */
export function pickUserFields(body: SelfSignupBody): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of USER_FIELDS) {
    const value = str(body[field])
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
    companyRegistrationNumber: 'registrationNumber',
    companyType: 'type',
    companyProvince: 'province',
    companyCity: 'city',
    companyEstablishmentDate: 'establishmentDate',
    companyStatus: 'status',
    companyEconomicCode: 'economicCode',
  }
  for (const [from, to] of Object.entries(mapping)) {
    const value = str(body[from])
    if (value !== undefined) fields[to] = value
  }
  return fields
}

/** The company fields the server actually requires. */
export function missingCompanyFields(body: SelfSignupBody): string[] {
  const missing: string[] = []
  if (!str(body.companyName)) missing.push('companyName')
  if (!str(body.companyNationalId)) missing.push('companyNationalId')
  return missing
}

/** The person fields the server actually requires. */
export function missingUserFields(body: SelfSignupBody): string[] {
  const missing: string[] = []
  if (!str(body.phone)) missing.push('phone')
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

/**
 * Recognises the unique-constraint failure Payload raises when `companies.nationalId`
 * collides, so it can be reported as a 409 rather than an opaque 500. The check
 * is deliberately loose about the message shape and only accepts a `nationalId`
 * / `national_id` field, so an unrelated validation error is never misreported.
 */
export function isDuplicateNationalId(error: unknown): boolean {
  if (error instanceof DuplicateNationalIdError) return true
  const errors = (error as { errors?: unknown })?.errors
  if (!Array.isArray(errors)) return false
  return errors.some((entry) => {
    const e = entry as { field?: unknown; message?: unknown }
    const field = typeof e.field === 'string' ? e.field.toLowerCase() : ''
    const message = typeof e.message === 'string' ? e.message.toLowerCase() : ''
    const mentionsField = field.includes('nationalid') || field.includes('national_id')
    if (!mentionsField) return false
    return message.includes('duplicate') || message.includes('unique') || message.includes('invalid')
  })
}