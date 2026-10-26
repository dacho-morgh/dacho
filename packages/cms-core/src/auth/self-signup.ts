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

/**
 * The company fields the server actually requires for stage 1.
 *
 * `activityDomain` is deliberately absent for a temporary compatibility
 * window: the current register form does not collect it yet. It is persisted
 * whenever supplied, and FE03 will start sending it before this becomes a
 * required field.
 */
export function missingCompanyFields(body: SelfSignupBody): string[] {
  const missing: string[] = []
  if (!str(body.companyName)) missing.push('companyName')
  if (!str(body.companyNationalId)) missing.push('companyNationalId')
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

/**
 * Interim boundary syntax pending the T03 technical validation dictionary.
 * The national ID is only required to be non-empty digits after normalization;
 * no length or checksum rule is inferred. The phone shape matches the current
 * client, but the exact phone dictionary is also pending T03.
 */
export const IRANIAN_MOBILE_RE = /^09\d{9}$/
export const NATIONAL_ID_RE = /^\d+$/

/** Fields present but with the wrong normalized syntax; missing fields win. */
export function invalidSignupFields(body: SelfSignupBody): string[] {
  const invalid: string[] = []
  const phone = digits(body.phone)
  if (phone !== undefined && !IRANIAN_MOBILE_RE.test(phone)) invalid.push('phone')
  const nationalId = digits(body.companyNationalId)
  if (nationalId !== undefined && !NATIONAL_ID_RE.test(nationalId)) invalid.push('companyNationalId')
  return invalid
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

const asText = (value: unknown): string =>
  typeof value === 'string' ? value.toLowerCase() : ''

const mentionsNationalId = (value: unknown): boolean =>
  /national[_ ]?id/i.test(asText(value))

/** Unique-constraint evidence, not merely a field named `national_id`. */
const hasUniqueEvidence = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const e = value as { code?: unknown; constraint?: unknown; detail?: unknown; message?: unknown }
  const code = asText(e.code)
  if (code === '23505' || code.includes('sqlite_constraint')) return true
  const evidence = [e.code, e.constraint, e.detail, e.message].map(asText).join(' ')
  return /unique|duplicate|already (?:registered|exists)|constraint failed/.test(evidence)
}

const isNationalIdUniqueError = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const e = value as {
    code?: unknown
    constraint?: unknown
    detail?: unknown
    field?: unknown
    message?: unknown
    path?: unknown
  }
  const target = [e.field, e.path, e.constraint, e.detail, e.message].some(mentionsNationalId)
  return target && hasUniqueEvidence(value)
}

/**
 * Payload turns a PostgreSQL unique violation into a `ValidationError` whose
 * `errors[].path` is the offending column, and keeps the driver error on
 * `cause`; a raw driver failure exposes `constraint` instead. Evidence of a
 * unique violation is required in addition to the national-id field, so a
 * format or required-field error on the same column stays a 400 rather than
 * being reported as an existing company. Unrelated unique violations on the
 * person (phone/email) are never misreported as this company.
 */
export function isDuplicateNationalId(error: unknown): boolean {
  if (error instanceof DuplicateNationalIdError) return true

  const seen = new Set<object>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)

    const errors = (current as { errors?: unknown }).errors
    if (Array.isArray(errors) && errors.some(isNationalIdUniqueError)) return true
    if (isNationalIdUniqueError(current)) return true

    current = (current as { cause?: unknown }).cause
  }

  return false
}

export interface SelfSignupUser {
  id: number | string
}

export interface SelfSignupCompany {
  id: number | string
  name?: string | null
  nationalId?: string | null
  activityDomain?: string | null
}

/**
 * Minimal persistence seam for the signup use case. The CMS endpoint adapts
 * Payload to it; unit tests use an in-memory implementation to exercise the
 * use case and its transaction/rollback decisions.
 */
export interface SelfSignupStore {
  companyNationalIdExists(nationalId: string): Promise<boolean>
  inTransaction<T>(run: () => Promise<T>): Promise<T>
  createUser(fields: Record<string, string>): Promise<SelfSignupUser>
  createCompany(fields: Record<string, string | number>): Promise<SelfSignupCompany>
}

export interface SelfSignupResponse {
  status: number
  body: {
    user?: SelfSignupUser
    company?: SelfSignupCompany
    errors?: Array<{ code: string; field?: string; message: string }>
  }
}

const signupRejected = (): SelfSignupResponse => ({
  status: 400,
  body: {
    errors: [
      {
        code: 'signup_rejected',
        message: 'Registration could not be completed with the supplied details.',
      },
    ],
  },
})

const duplicateNationalId = (): SelfSignupResponse => ({
  status: 409,
  body: {
    errors: [
      {
        code: 'duplicate_national_id',
        field: 'companyNationalId',
        message: 'This company is already registered.',
      },
    ],
  },
})

/**
 * A user-level conflict (phone/email/username) is intentionally collapsed into
 * the same generic rejection as any other validation failure. The signup
 * response must not tell an anonymous visitor which account already exists.
 */
function isAccountConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; detail?: unknown; errors?: unknown; message?: unknown }
  if (asText(e.code) === '23505') return true
  if (Array.isArray(e.errors)) {
    return e.errors.some((entry) => {
      if (!entry || typeof entry !== 'object') return false
      const field = (entry as { field?: unknown; path?: unknown })
      return [field.field, field.path].some((value) => /^(phone|email|username)$/i.test(asText(value)))
    })
  }
  const text = [e.detail, e.message].map(asText).join(' ')
  return /unique|duplicate/.test(text) && /phone|email|username/.test(text)
}

/**
 * Framework-agnostic `/self-signup` use case: validate, pre-check, create the
 * person and company atomically, and map failures to safe HTTP responses.
 */
export async function runSelfSignup(
  input: unknown,
  store: SelfSignupStore,
  onError?: (error: unknown) => void,
): Promise<SelfSignupResponse> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return signupRejected()
  const body = input as SelfSignupBody

  const missing = [...missingUserFields(body), ...missingCompanyFields(body)]
  if (missing.length > 0) {
    return {
      status: 400,
      body: {
        errors: missing.map((field) => ({
          code: 'missing_field',
          field,
          message: `Missing required field: ${field}`,
        })),
      },
    }
  }

  const invalid = invalidSignupFields(body)
  if (invalid.length > 0) {
    return {
      status: 400,
      body: {
        errors: invalid.map((field) => ({
          code: 'invalid_field',
          field,
          message: field === 'phone' ? 'Invalid mobile number.' : 'Invalid national ID.',
        })),
      },
    }
  }

  const nationalId = normalizeDigits(String(body.companyNationalId).trim())
  if (await store.companyNationalIdExists(nationalId)) return duplicateNationalId()

  try {
    const result = await store.inTransaction(async () => {
      const user = await store.createUser(pickUserFields(body))
      const company = await store.createCompany(pickCompanyFields(body, user.id))
      return { user, company }
    })
    return { status: 201, body: result }
  } catch (error) {
    if (isDuplicateNationalId(error)) return duplicateNationalId()
    onError?.(error)
    if (isAccountConflict(error)) return signupRejected()
    const payloadErrors = (error as { errors?: unknown })?.errors
    if (Array.isArray(payloadErrors) && payloadErrors.length > 0) return signupRejected()
    return {
      status: 500,
      body: {
        errors: [{ code: 'signup_failed', message: 'Registration failed. Please try again.' }],
      },
    }
  }
}
