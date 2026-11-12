import { COMPANY_LEGAL_FORMS } from '@cms-core/collections/companyTypes'
import { IRAN_PROVINCES, isCityOfProvince } from '@/data/iran-locations'
import { compareJalali, parseJalali, todayJalali } from '@/utilities/jalali'
import {
  ECONOMIC_CODE_MESSAGES,
  economicCodeProblem,
  REGISTRATION_NUMBER_MESSAGES,
  registrationNumberProblem,
} from '@/utilities/signup-validation'

/**
 * The company fields the registration form asks for, and their rules. The
 * register page and the company profile both use these, so a company is held
 * to the same rules when it is created and when it is edited later.
 */

/** The legal forms of Article 20 of the Commercial Code (cooperatives included). */
export const COMPANY_TYPES = COMPANY_LEGAL_FORMS

export const PROVINCE_NAMES: readonly string[] = IRAN_PROVINCES.map((province) => province.name)

export type CompanyBasicField =
  | 'name'
  | 'activityDomain'
  | 'registrationNumber'
  | 'type'
  | 'province'
  | 'city'
  | 'establishmentDate'
  | 'economicCode'

export type CompanyBasicValues = Record<CompanyBasicField, string>

export const COMPANY_BASIC_LABELS: Record<CompanyBasicField, string> = {
  name: 'نام شرکت',
  activityDomain: 'حوزه فعالیت',
  registrationNumber: 'شماره ثبت',
  type: 'نوع شرکت',
  province: 'استان',
  city: 'شهر',
  establishmentDate: 'تاریخ تأسیس',
  economicCode: 'کد اقتصادی',
}

/** The placeholders the registration form shows. */
export const COMPANY_BASIC_PLACEHOLDERS: Record<CompanyBasicField, string> = {
  name: 'نام رسمی شرکت را وارد کنید',
  activityDomain: 'حوزه فعالیت شرکت را وارد کنید',
  registrationNumber: 'شماره ثبت شرکت را وارد کنید',
  type: 'نوع شرکت را جستجو یا انتخاب کنید',
  province: 'استان محل ثبت را جستجو یا انتخاب کنید',
  city: 'شهر محل ثبت را جستجو یا انتخاب کنید',
  establishmentDate: 'تاریخ تأسیس را انتخاب کنید',
  economicCode: 'کد اقتصادی ۱۱ رقمی شرکت را وارد کنید',
}

export const CITY_NEEDS_PROVINCE_PLACEHOLDER = 'ابتدا استان را انتخاب کنید'

const typed = (field: CompanyBasicField) => `${COMPANY_BASIC_LABELS[field]} را وارد کنید.`
const chosen = (field: CompanyBasicField) => `${COMPANY_BASIC_LABELS[field]} را انتخاب کنید.`

export const companyNameError = (value: string) => (value.trim() ? undefined : typed('name'))

export const activityDomainError = (value: string) =>
  value.trim() ? undefined : typed('activityDomain')

export function registrationNumberError(value: string): string | undefined {
  if (!value.trim()) return typed('registrationNumber')
  const reason = registrationNumberProblem(value)
  return reason ? REGISTRATION_NUMBER_MESSAGES[reason] : undefined
}

export function economicCodeError(value: string): string | undefined {
  if (!value.trim()) return typed('economicCode')
  const reason = economicCodeProblem(value)
  return reason ? ECONOMIC_CODE_MESSAGES[reason] : undefined
}

/**
 * A company type must be one of the legal forms. `saved` is the value already
 * stored, which stays acceptable unchanged when it predates the current list.
 */
export function companyTypeError(value: string, saved?: string): string | undefined {
  if (!value.trim()) return chosen('type')
  if ((COMPANY_TYPES as readonly string[]).includes(value) || (saved && value === saved)) {
    return undefined
  }
  return 'نوع شرکت را از فهرست انتخاب کنید.'
}

export const provinceError = (value: string) => (value.trim() ? undefined : chosen('province'))

/** The city is checked against the chosen province. */
export function cityError(city: string, province: string): string | undefined {
  if (!city.trim()) return chosen('city')
  if (!province) return 'ابتدا استان را انتخاب کنید.'
  if (!isCityOfProvince(province, city)) return 'این شهر در استان انتخاب‌شده نیست.'
  return undefined
}

export function establishmentDateError(value: string): string | undefined {
  if (!value.trim()) return 'تاریخ تأسیس را انتخاب کنید.'
  const date = parseJalali(value)
  if (!date) return 'تاریخ تأسیس معتبر نیست.'
  if (compareJalali(date, todayJalali()) > 0) return 'تاریخ تأسیس نمی‌تواند در آینده باشد.'
  return undefined
}

/** Every rule at once; `savedType` is the stored company type (see `companyTypeError`). */
export function companyBasicErrors(
  values: CompanyBasicValues,
  savedType?: string,
): Partial<Record<CompanyBasicField, string>> {
  const errors: Partial<Record<CompanyBasicField, string>> = {
    name: companyNameError(values.name),
    activityDomain: activityDomainError(values.activityDomain),
    registrationNumber: registrationNumberError(values.registrationNumber),
    type: companyTypeError(values.type, savedType),
    province: provinceError(values.province),
    city: cityError(values.city, values.province),
    establishmentDate: establishmentDateError(values.establishmentDate),
    economicCode: economicCodeError(values.economicCode),
  }
  for (const field of Object.keys(errors) as CompanyBasicField[]) {
    if (!errors[field]) delete errors[field]
  }
  return errors
}

/** Knowledge-based status choices (kept equal to the backend's `KNOWLEDGE_BASED_STATUS_OPTIONS`). */
export const KNOWLEDGE_BASED_STATUS_OPTIONS = [
  'دانش‌بنیان نوع یک',
  'دانش‌بنیان نوع دو',
  'دانش‌بنیان نوپا',
  'غیر دانش‌بنیان',
] as const

/** Company classification choices (kept equal to the backend's `CLASSIFICATION_OPTIONS`). */
export const CLASSIFICATION_OPTIONS = ['نوپا', 'فناور', 'صنعتی', 'سایر'] as const

/** What a ticked center-establishment checkbox stores (the backend's `CENTER_ESTABLISHED`). */
export const CENTER_ESTABLISHED = 'مستقر در مرکز رشد / پارک علم و فناوری'
