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

export interface KeyMemberDto {
  name: string
  role: string
}

export interface PastProjectCustomerDto {
  project: string
  customer?: string
  summary?: string
}

export interface CertificateLicenceDto {
  title: string
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
  productsServices: string[]
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
}

export function fetchCompanyVerification(): Promise<CompanyVerificationDto> {
  return dashboardFetch<CompanyVerificationDto>('/profile/verification')
}

export function submitCompanyVerification(): Promise<unknown> {
  return dashboardFetch<unknown>('/profile/verification/submit', { method: 'POST' })
}
