import { type CompanyInfoDto, type ContactInfoDto, type ExecutiveDto, type AddressDto, type ProfileDto, dashboardFetch } from './core'

export function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
}

export const DOSSIER_FIELD_LABELS: Record<string, string> = {
  registrationNumber: 'شماره ثبت',
  legalEntityType: 'نوع شخصیت حقوقی',
  foundingYear: 'سال تأسیس',
  status: 'وضعیت شرکت',
  classification: 'طبقه‌بندی شرکت',
  knowledgeBasedStatus: 'وضعیت دانش‌بنیانی',
  activityDomain: 'حوزه فعالیت',
  productsServices: 'محصولات و خدمات',
  addresses: 'آدرس‌ها',
  articlesOfAssociation: 'اساس‌نامه',
  establishmentNotices: 'آگهی تأسیس',
  centerEstablishment: 'استقرار در مرکز رشد یا پارک علم و فناوری',
  website: 'وب‌سایت رسمی',
  insuredEmployeeCount: 'تعداد کارکنان بیمه‌شده',
  pastProjectsCustomers: 'سوابق پروژه‌ها و مشتریان',
  requestedServices: 'خدمات مورد تقاضا',
  catalogues: 'کاتالوگ شرکت',
  certificatesLicenses: 'گواهی‌ها و مجوزها',
  amendmentNotices: 'آگهی‌های تغییرات',
}

export function dossierFieldLabel(key: string): string {
  return DOSSIER_FIELD_LABELS[key] ?? key
}

/** Where a dossier field is filled in: the profile page and the section on it. */
export interface DossierFieldLocation {
  page: string
  section: string
}

const COMPANY_PAGE = 'پروفایل شرکت'
const RESUME_PAGE = 'رزومه'

export const DOSSIER_FIELD_LOCATIONS: Record<string, DossierFieldLocation> = {
  registrationNumber: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  status: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  legalEntityType: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  knowledgeBasedStatus: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  classification: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  foundingYear: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  activityDomain: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  website: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  centerEstablishment: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  insuredEmployeeCount: { page: COMPANY_PAGE, section: 'اطلاعات پایه' },
  articlesOfAssociation: { page: COMPANY_PAGE, section: 'مدارک رسمی شرکت' },
  establishmentNotices: { page: COMPANY_PAGE, section: 'مدارک رسمی شرکت' },
  amendmentNotices: { page: COMPANY_PAGE, section: 'مدارک رسمی شرکت' },
  addresses: { page: COMPANY_PAGE, section: 'آدرس‌ها' },
  productsServices: { page: RESUME_PAGE, section: 'محصولات و خدمات' },
  pastProjectsCustomers: { page: RESUME_PAGE, section: 'سوابق پروژه‌ها و مشتریان' },
  requestedServices: { page: RESUME_PAGE, section: 'خدمات مورد تقاضا' },
  certificatesLicenses: { page: RESUME_PAGE, section: 'گواهی‌ها و مجوزها' },
  catalogues: { page: RESUME_PAGE, section: 'کاتالوگ و معرفی شرکت' },
}

const UNKNOWN_LOCATION: DossierFieldLocation = { page: COMPANY_PAGE, section: 'سایر اطلاعات' }

export interface MissingItemGroup {
  page: string
  section: string
  keys: string[]
}

/**
 * Groups missing dossier keys by the page and section where the form lives, in
 * the order the keys first appear.
 */
export function groupMissingByLocation(keys: readonly string[]): MissingItemGroup[] {
  const groups: MissingItemGroup[] = []
  for (const key of keys) {
    const { page, section } = DOSSIER_FIELD_LOCATIONS[key] ?? UNKNOWN_LOCATION
    const group = groups.find((item) => item.page === page && item.section === section)
    if (group) group.keys.push(key)
    else groups.push({ page, section, keys: [key] })
  }
  return groups
}

export interface KeyMemberDto {
  name: string
  role: string
  /** Degree or field of study. */
  education?: string
  /** Where the degree was obtained. */
  degreePlace?: string
}

/** A product or service, with an optional private file (PDF, Word or image). */
export interface ProductServiceDto {
  title: string
  documentId?: string
}

export interface PastProjectCustomerDto {
  project: string
  customer?: string
  summary?: string
}

export interface CertificateLicenceDto {
  title: string
  /** An optional private file (PDF, Word or image) of the certificate. */
  documentId?: string
  /** No longer asked for; a value entered earlier is kept and sent back as it is. */
  issuer?: string
  reference?: string
}

export type AbsenceField =
  | 'centerEstablishment'
  | 'website'
  | 'insuredEmployeeCount'
  | 'pastProjectsCustomers'
  | 'requestedServices'
  | 'certificatesLicenses'
  | 'catalogues'
  | 'amendmentNotices'

export interface CompanyDossierDto {
  legalEntityType: string
  knowledgeBasedStatus: string
  classification: string
  foundingYear: string
  activityDomain: string
  website: string
  centerEstablishment: string
  insuredEmployeeCount: number | null
  productsServices: ProductServiceDto[]
  keyMembers: KeyMemberDto[]
  pastProjectsCustomers: PastProjectCustomerDto[]
  requestedServices: string[]
  certificatesLicenses: CertificateLicenceDto[]
  notAvailable: AbsenceField[]
}

export interface DossierDocumentDto {
  id: string
  category: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface MissingDossierItemsDto {
  required: string[]
  optional: string[]
  canRequestVerification: boolean
}

export interface DossierResponseDto {
  profile?: ProfileDto
  dossier: CompanyDossierDto
  documents: DossierDocumentDto[]
  missing: MissingDossierItemsDto
}

export function fetchProfile(): Promise<ProfileDto | undefined> {
  return dashboardFetch<ProfileDto>('/profile')
}

export function updateProfile(data: {
  company?: Partial<CompanyInfoDto>
  contacts?: Partial<ContactInfoDto>
  executives?: ExecutiveDto[]
  dossier?: Partial<CompanyDossierDto>
}): Promise<ProfileDto | undefined> {
  return dashboardFetch<ProfileDto>('/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function addAddress(
  address: Omit<AddressDto, 'id'>,
): Promise<{ address: AddressDto } | undefined> {
  return dashboardFetch<{ address: AddressDto }>('/profile/addresses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(address),
  })
}

export function updateAddress(
  id: string,
  address: Partial<Omit<AddressDto, 'id'>>,
): Promise<{ address: AddressDto } | undefined> {
  return dashboardFetch<{ address: AddressDto }>(`/profile/addresses/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(address),
  })
}

export function deleteAddress(id: string): Promise<{ success: boolean } | undefined> {
  return dashboardFetch<{ success: boolean }>(`/profile/addresses/${id}`, {
    method: 'DELETE',
  })
}

export function fetchProfileDossier(): Promise<DossierResponseDto | undefined> {
  return dashboardFetch<DossierResponseDto>('/profile/dossier')
}

export function updateProfileDossier(
  data: Partial<CompanyDossierDto>
): Promise<DossierResponseDto | undefined> {
  return dashboardFetch<DossierResponseDto>('/profile/dossier', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/* ── Display mappers (backend DTO → component prop shapes) ─────────────── */

export type CompanyVerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'returned' | 'rejected'

/** The representative's own current verification, as the server derives it. */
export interface CompanyVerificationDto {
  status: CompanyVerificationStatus
  revision: number
  submittedAt: string | null
  decidedAt: string | null
  reason: string | null
  canRequestVerification: boolean
  /** Every submission of the company, newest last or first as the server orders them; no snapshot is read from it. */
  history?: CompanyVerificationHistoryDto[]
}

export interface CompanyVerificationHistoryDto {
  revision: number
  status: CompanyVerificationStatus
  submittedAt: string
  decidedAt: string | null
  reason: string | null
}

export function fetchCompanyVerification(): Promise<CompanyVerificationDto> {
  return dashboardFetch<CompanyVerificationDto>('/profile/verification')
}

export function submitCompanyVerification(): Promise<unknown> {
  return dashboardFetch<unknown>('/profile/verification/submit', { method: 'POST' })
}
