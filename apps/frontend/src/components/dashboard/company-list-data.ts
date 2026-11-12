/**
 * What the companies table reads: shared by the server page (which fetches the first page so the
 * table renders with its rows) and the client list (which fetches every later page, queue or search).
 */

import { toPersianDigits } from '@/utilities/digits'
import { jalaliAgeInYears, parseJalali, toJalali, todayJalali } from '@/utilities/jalali'

export type VerificationStatus =
  | 'unsubmitted'
  | 'pending'
  | 'approved'
  | 'returned'
  | 'rejected'

export type VerificationQueue = 'all' | 'pending' | 'approved' | 'returned' | 'rejected'

export type Company = {
  id: string
  name: string
  /** The company's picture (its access-checked file route); null when it has none. */
  logoUrl: string | null
  ceo: string
  companyType: string
  address: string
  activityAge: string
  verificationStatus: VerificationStatus
  verificationRevision: number
  submittedAt: string | null
  /** Version stamp of the representative's account, needed to deactivate it. */
  updatedAt: string | null
  /** A company being created: shown at once, before the server has answered. */
  optimistic?: boolean
}

export type CompaniesPage = {
  companies: Company[]
  page: number
  totalPages: number
  counts: Record<VerificationQueue, number>
}

/** The first page as the server read it, with the query it answers. */
export type InitialCompanies = CompaniesPage & { key: string }

export const COMPANY_QUEUES: VerificationQueue[] = ['all', 'pending', 'approved', 'returned', 'rejected']
export const COMPANIES_PAGE_SIZE = 10
export const EMPTY_COUNTS: Record<VerificationQueue, number> = {
  all: 0,
  pending: 0,
  approved: 0,
  returned: 0,
  rejected: 0,
}

export type CompaniesApiResponse = {
  page?: number
  totalPages?: number
  counts?: Partial<Record<VerificationQueue, number>>
  items?: {
    id: string
    companyId?: string | null
    companyName?: string
    logo?: { id: string; url: string } | null
    name?: string
    updatedAt?: string | null
    companyType?: string
    companyProvince?: string
    companyCity?: string
    companyEstablishmentDate?: string
    executives?: { role?: string; name?: string }[]
    verificationStatus?: VerificationStatus
    verificationRevision?: number
    verificationSubmittedAt?: string | null
  }[]
}

/** Reads the URL's `status`, `page` and `search` the same way on the server and in the browser. */
export function companiesParams(params: { status?: string | null; page?: string | null; search?: string | null }) {
  const status = COMPANY_QUEUES.find((queue) => queue === params.status) ?? 'all'
  const page = Math.max(1, Number.parseInt(params.page ?? '', 10) || 1)
  const search = (params.search ?? '').trim()
  return { status, page, search }
}

export function companiesQuery({ status, page, search }: ReturnType<typeof companiesParams>): string {
  const query = new URLSearchParams({ page: String(page), limit: String(COMPANIES_PAGE_SIZE) })
  if (status !== 'all') query.set('status', status)
  if (search) query.set('search', search)
  return query.toString()
}

/** Null when the answer is not a list (the caller shows its error state). */
export function toCompaniesPage(data: CompaniesApiResponse, requestedPage: number): CompaniesPage | null {
  if (!Array.isArray(data.items)) return null
  return {
    companies: data.items.map((item) => ({
      id: item.id,
      name: item.companyName || item.name || '—',
      logoUrl: item.logo?.url ?? null,
      ceo:
        item.executives?.find((executive) => /مدیر\s*عامل/i.test(executive.role || ''))?.name ||
        item.name ||
        '—',
      companyType: item.companyType || '—',
      address: [item.companyProvince, item.companyCity].filter(Boolean).join('، ') || '—',
      activityAge: activityAgeLabel(item.companyEstablishmentDate),
      verificationStatus: item.verificationStatus || 'unsubmitted',
      verificationRevision: item.verificationRevision || 0,
      submittedAt: item.verificationSubmittedAt ?? null,
      updatedAt: item.updatedAt ?? null,
    })),
    page: data.page ?? requestedPage,
    totalPages: data.totalPages ?? 1,
    counts: { ...EMPTY_COUNTS, all: data.items.length, ...data.counts },
  }
}

/** Companies store the founding date as Jalali (`1380/05/15`); an ISO date is still understood. */
function activityAgeLabel(value?: string): string {
  const text = value?.trim()
  if (!text) return '—'
  const jalali = parseJalali(text)
  if (jalali) {
    const age = jalaliAgeInYears(jalali)
    return age === null ? '—' : `${toPersianDigits(age)} سال`
  }
  const date = new Date(text)
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return '—'
  const today = todayJalali()
  const from = toJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  const age = jalaliAgeInYears(from, today)
  return age === null ? '—' : `${toPersianDigits(age)} سال`
}
