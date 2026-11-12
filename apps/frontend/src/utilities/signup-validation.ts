import { toEnglishDigits } from '@/utilities/digits'

/**
 * Client-side mirror of the signup identifier rules the server enforces
 * (`packages/cms-core/src/auth/self-signup.ts`, design QA #278). The server stays
 * authoritative; these checks only spare the person a round trip. The messages
 * are keyed by the server's stable `reason` values so a server rejection reads
 * the same as a client one. tests/int/signup-validation.int.spec.ts compares
 * this file with the server implementation.
 */

export type SignupFieldReason =
  | 'digits_only'
  | 'length'
  | 'checksum'
  | 'mobile_format'
  | 'email_format'

export const LEGAL_ENTITY_NATIONAL_ID_LENGTH = 11
const WEIGHTS = [29, 27, 23, 19, 17, 29, 27, 23, 19, 17] as const

export const IRANIAN_MOBILE_RE = /^09\d{9}$/
// Same shape as the server's (Payload's own `email` validator), so a value
// accepted here is never rejected later as an opaque error.
export const EMAIL_RE =
  /^(?!.*\.\.)[\w!#$%&'*+/=?^`{|}~-](?:[\w!#$%&'*+/=?^`{|}~.-]*[\w!#$%&'*+/=?^`{|}~-])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i
const EMAIL_MAX_LENGTH = 254

export const SIGNUP_REASON_MESSAGES: Record<SignupFieldReason, string> = {
  digits_only: 'شناسه ملی باید فقط شامل رقم باشد.',
  length: 'شناسه ملی باید ۱۱ رقم باشد.',
  checksum: 'شناسه ملی معتبر نیست؛ ارقام را دوباره بررسی کنید.',
  mobile_format: 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
  email_format: 'ایمیل معتبر نیست؛ آن را به شکل name@example.com وارد کنید.',
}

/** Registration number and economic code: digits only once digits are normalized. */
export const DIGITS_ONLY_MESSAGE = 'این فیلد باید فقط شامل رقم باشد.'

export function legalEntityCheckDigit(firstTenDigits: string): number {
  const offset = Number(firstTenDigits[9]) + 2
  let sum = 0
  for (let index = 0; index < 10; index++) {
    sum += (Number(firstTenDigits[index]) + offset) * WEIGHTS[index]!
  }
  const remainder = sum % 11
  return remainder === 10 ? 0 : remainder
}

/** Why a company national ID (any digit script) is rejected, if it is. */
export function nationalIdProblem(value: string): SignupFieldReason | undefined {
  const nationalId = toEnglishDigits(value.trim())
  if (!/^\d+$/.test(nationalId)) return 'digits_only'
  if (nationalId.length !== LEGAL_ENTITY_NATIONAL_ID_LENGTH) return 'length'
  if (/^0+$/.test(nationalId) || /^0{6}$/.test(nationalId.slice(3, 9))) return 'checksum'
  return legalEntityCheckDigit(nationalId.slice(0, 10)) === Number(nationalId[10])
    ? undefined
    : 'checksum'
}

export function mobileProblem(value: string): SignupFieldReason | undefined {
  return IRANIAN_MOBILE_RE.test(toEnglishDigits(value.trim())) ? undefined : 'mobile_format'
}

export function emailProblem(value: string): SignupFieldReason | undefined {
  const email = value.trim()
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email) ? undefined : 'email_format'
}

/** The economic code (کد اقتصادی) is 11 digits, like the company national ID. */
export const ECONOMIC_CODE_LENGTH = 11
export const ECONOMIC_CODE_MESSAGES = {
  digits_only: 'کد اقتصادی باید فقط شامل رقم باشد.',
  length: 'کد اقتصادی باید ۱۱ رقم باشد.',
} as const

export function economicCodeProblem(value: string): keyof typeof ECONOMIC_CODE_MESSAGES | undefined {
  const code = toEnglishDigits(value.trim())
  if (!/^\d+$/.test(code)) return 'digits_only'
  return code.length === ECONOMIC_CODE_LENGTH ? undefined : 'length'
}

/** The registration number (شماره ثبت) is 3 to 6 digits: older companies have 3-4, newer ones up to 6. */
export const REGISTRATION_NUMBER_MIN_LENGTH = 3
export const REGISTRATION_NUMBER_MAX_LENGTH = 6
export const REGISTRATION_NUMBER_MESSAGES = {
  digits_only: 'شماره ثبت باید فقط شامل رقم باشد.',
  length: 'شماره ثبت باید بین ۳ تا ۶ رقم باشد.',
} as const

export function registrationNumberProblem(
  value: string,
): keyof typeof REGISTRATION_NUMBER_MESSAGES | undefined {
  const number = toEnglishDigits(value.trim())
  if (!/^\d+$/.test(number)) return 'digits_only'
  return number.length >= REGISTRATION_NUMBER_MIN_LENGTH &&
    number.length <= REGISTRATION_NUMBER_MAX_LENGTH
    ? undefined
    : 'length'
}

export function isDigitsOnly(value: string): boolean {
  return /^\d+$/.test(toEnglishDigits(value.trim()))
}
