// Client-side data layer for the `/api/dashboard/*` proxy. Replaces the
// hardcoded mock data with typed reads of the backend domain. Pure mappers
// (labels + dates) live here so they are unit-testable; the fetch helpers are
// thin wrappers over the same-origin proxy (the browser forwards the session).

import type { LetterItem } from '@/components/dashboard/inbox-list-view'
import type { MailData } from '@/components/dashboard/mail-detail-view'
import type { RequestItem } from '@/components/dashboard/requests/types'

export type RequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'
export type LetterType = 'rejected' | 'approved' | 'needs_fix' | 'official' | 'notification'

/** Server-derived per role and stage; a control appears only for an action listed here. */
export type RequestAction =
  | 'read'
  | 'submit'
  | 'correct'
  | 'assign'
  | 'reopen'
  | 'triage'
  | 'startReview'
  | 'replaceReviewer'
  | 'replaceEmployer'
  | 'decideReview'
  | 'submitFinancialPackage'
  | 'uploadDocument'
  | 'deleteDocument'

export interface RequestDto {
  id: string
  trackingCode: string
  title: string
  serviceId: string
  serviceKey: string
  serviceName: string
  ownerId: string
  status: RequestStatus
  reviewStage?: string | null
  revision?: number
  currentStepIndex: number
  assignedRole: string | null
  currentStep: string | null
  answers: Record<string, unknown>
  submissionDate: string | null
  dueDate: string | null
  submittedBy?: string | null
  createdAt: string
  updatedAt: string
  allowedActions?: RequestAction[]
}

export interface LetterDto {
  id: string
  type: LetterType
  title: string
  body: string
  senderId: string | null
  senderName: string | null
  senderRole: string | null
  recipientId: string
  requestId: string | null
  read: boolean
  sentAt: string
  attachments: unknown[]
  createdAt: string
  updatedAt: string
}

export interface ActivityDto {
  id: string
  ownerId: string
  requestId: string | null
  letterId: string | null
  type: string
  title: string
  description: string | null
  at: string
}

export interface RequestStats {
  total: number
  in_review: number
  approved: number
  action_needed: number
  rejected: number
}

/** A queue the backend counts for the current role; an unknown key is never shown. */
export interface WorkQueueCountDto {
  key: string
  count: number
}

/** GET /stats/overview: every number comes from the actor's own row scope. */
export interface DashboardOverviewDto {
  counts: RequestStats
  queues: WorkQueueCountDto[]
  events: { id: string; title: string }[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface CompanyInfoDto {
  name: string
  establishmentDate: string
  status: string
  type: string
  registrationNumber: string
  economicCode: string
  nationalId: string
}

export interface ContactInfoDto {
  phone: string
  email: string
}

export interface ExecutiveDto {
  role: string
  name: string
}

export interface AddressDto {
  id: string
  title: string
  province: string
  city: string
  postalCode: string
  address: string
}

export interface ProfileDto {
  company: CompanyInfoDto
  contacts: ContactInfoDto
  executives: ExecutiveDto[]
  addresses: AddressDto[]
  companyId?: string | null
}

/** Safe projection for the current internal user's read-only personal profile. */
export interface DashboardOwnProfileDto {
  name: string
  position: string
  role: string
  contacts: ContactInfoDto
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'پیش‌نویس',
  in_review: 'درحال بررسی',
  action_needed: 'نیاز به اقدام',
  approved: 'تایید شده',
  rejected: 'رد شده',
}

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  rejected: 'رد درخواست',
  approved: 'تایید درخواست',
  needs_fix: 'نیاز به اصلاح',
  official: 'نامه رسمی',
  notification: 'اطلاع رسانی',
}

/** Machine key → display name, for denormalizing a request's `serviceKey`. */
export const SERVICE_KEY_LABELS: Record<string, string> = {
  financing: 'تأمین مالی و سرمایه‌گذاری',
  events: 'رویدادها و رقابت‌ها',
  exhibitions: 'خدمات نمایشگاهی',
  knowledge: 'خدمات دانش‌بنیانی',
  commercialization: 'تجاری‌سازی و ورود به بازار',
}

const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Formats an ISO timestamp as a Jalali date (falls back to a raw slice). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianDate.format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

const persianWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' })
const persianTime = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })

export function formatWeekday(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianWeekday.format(new Date(iso))
  } catch {
    return ''
  }
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianTime.format(new Date(iso))
  } catch {
    return ''
  }
}

export function serviceNameFor(serviceKey: string): string {
  return SERVICE_KEY_LABELS[serviceKey] ?? serviceKey
}

export class DashboardApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

/**
 * What a failed write means to the person, with the input they typed still on screen.
 * Session, permission and stale-version failures each ask for a different next step,
 * and a dropped connection is not the server's refusal.
 */
export function describeMutationFailure(cause: unknown, fallback: string): string {
  if (cause instanceof TypeError) return 'ارتباط با سرور برقرار نشد. اطلاعات این صفحه حفظ شده است؛ اتصال را بررسی کنید و دوباره تلاش کنید.'
  if (!(cause instanceof DashboardApiError)) return fallback
  if (cause.status === 401) return 'نشست شما پایان یافته است. در برگه‌ای دیگر دوباره وارد شوید و سپس همین‌جا ادامه دهید؛ اطلاعات این صفحه حفظ شده است.'
  if (cause.status === 403) return 'اجازه انجام این کار را ندارید یا دسترسی شما تغییر کرده است.'
  if (cause.status === 409) return 'این مورد پس از باز شدن صفحه تغییر کرده است. صفحه را تازه کنید و وضعیت را دوباره بررسی کنید.'
  return fallback
}

async function dashboardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/dashboard${path}`, { cache: 'no-store', ...init })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new DashboardApiError(
      res.status,
      typeof body?.error === 'string' ? body.error : 'request_failed',
    )
  }
  return res.json() as Promise<T>
}

/* ── Secretariat follow-up and published result (T33) ─────────────────── */

export interface PublishedResultDto {
  body: string
  publishedAt: string
}

export interface CompanySupplementaryRequestDto {
  id: string
  body: string
  createdAt: string
}

export interface FollowUpQueueItemDto {
  requestId: string
  trackingCode: string
  title: string
  companyName: string | null
  latestMemoVersion: number
  latestMemoSentAt: string
  publishedAt: string | null
}

export type FollowUpQueueDto = Paginated<FollowUpQueueItemDto>

export interface ResultVersionDto {
  id: string
  version: number
  body: string
  authorName: string | null
  createdAt: string
  publishedByName: string | null
  publishedAt: string | null
}

export interface CaseFollowUpDto {
  stageOpen: boolean
  canAct: boolean
  memos: {
    id: string
    version: number
    body: string
    authorName: string | null
    sentAt: string | null
  }[]
  supplementaryRequests: CompanySupplementaryRequestDto[]
  files: {
    id: string
    filename: string
    createdAt: string
    deliveredAt: string | null
    downloadUrl: string
  }[]
  results: ResultVersionDto[]
  published: PublishedResultDto | null
}

const postJson = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export function getCaseFollowUp(id: string): Promise<CaseFollowUpDto> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/follow-up`)
}

export function requestSupplementaryDocuments(id: string, body: string): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/supplementary-requests`, postJson({ body }))
}

export function deliverSupplementaryFile(id: string, documentId: string): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/supplementary-files`, postJson({ documentId }))
}

export function saveResult(id: string, body: string): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/result`, postJson({ body }))
}

export function publishResult(id: string, version: number): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/result/publish`, postJson({ version }))
}

/* ── Role actions on the shared dossier (T21, T22, T28, T32) ──────────── */

export type TriageAction = 'accept' | 'return' | 'reject'
export type ReviewDecisionAction = 'advance' | 'return' | 'reject'

const decisionBody = (action: string, reason: string, expectedRevision?: number) => ({
  action,
  ...(reason ? { reason } : {}),
  ...(expectedRevision ? { expectedRevision } : {}),
})

export function decideTriage(id: string, action: TriageAction, reason: string, expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/triage`, postJson(decisionBody(action, reason, expectedRevision)))
}

export function decideReview(id: string, action: ReviewDecisionAction, reason: string, expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/review-decision`, postJson(decisionBody(action, reason, expectedRevision)))
}

export function reopenRequest(id: string, reason: string, expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(
    `/admin/requests/${encodeURIComponent(id)}/reopen`,
    postJson({ reason, ...(expectedRevision ? { expectedRevision } : {}) }),
  )
}

export interface ReviewCandidatesDto {
  items: { id: string; name: string | null }[]
  employerId: string | null
}

export function getReviewCandidates(id: string): Promise<ReviewCandidatesDto> {
  return dashboardFetch(`/requests/${encodeURIComponent(id)}/review-round/candidates`)
}

export function startReviewRound(id: string, reviewerIds: string[], expectedRevision?: number): Promise<unknown> {
  return dashboardFetch(
    `/requests/${encodeURIComponent(id)}/review-round`,
    postJson({ reviewerIds, ...(expectedRevision ? { expectedRevision } : {}) }),
  )
}

/** Oversight's view of the latest round; progress only, without who holds a slot. */
export interface ReviewRoundDto {
  id: string
  requestRevision: number
  proposalRevision: number
  startedAt: string
  completion: { required: number; finalized: number; ready: boolean; completedAt: string | null }
  decision: { action: ReviewDecisionAction; decidedAt: string; reason: string | null } | null
}

/** Unfinished evaluations reach oversight without scores or answers. */
export interface EvaluationSummaryDto {
  id: string
  variant: 'ordinary' | 'employer'
  state: 'draft' | 'final'
  scoreA?: number
  scoreB?: number
  scoreC?: number
  weightedHundredths?: number
  finalizedAt: string | null
}

export interface EvaluationListDto {
  items: EvaluationSummaryDto[]
  completedCount: number
  requiredCount: number
}

export interface InvestmentMemoDto {
  id: string
  version: number
  body: string
  createdAt: string
  sentAt: string | null
}

export function listInvestmentMemos(id: string): Promise<{ memos: InvestmentMemoDto[] }> {
  return dashboardFetch(`/investment/cases/${encodeURIComponent(id)}`)
}

export function saveInvestmentMemo(id: string, body: string): Promise<unknown> {
  return dashboardFetch(`/investment/cases/${encodeURIComponent(id)}/memo`, postJson({ body }))
}

export function sendInvestmentMemo(id: string, version: number): Promise<unknown> {
  return dashboardFetch(`/investment/cases/${encodeURIComponent(id)}/memo/send`, postJson({ version }))
}

export function getStats(): Promise<RequestStats> {
  return dashboardFetch<RequestStats>('/stats')
}

export function listRequests(params?: {
  status?: RequestStatus
  page?: number
  limit?: number
}): Promise<Paginated<RequestDto>> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<RequestDto>>(`/requests${suffix}`)
}

export interface RequestDetail {
  request: RequestDto
  timeline: ActivityDto[]
  workflow: { title: string; role: string; roleName: string; order: number }[]
  /** Absent for reviewers and employers, who are not told whose case it is. */
  owner?: { id: string; name: string | null } | null
}

export function getRequest(id: string): Promise<RequestDetail> {
  return dashboardFetch<RequestDetail>(`/requests/${encodeURIComponent(id)}`)
}

export function listLetters(params?: {
  read?: boolean
  page?: number
  limit?: number
}): Promise<Paginated<LetterDto>> {
  const qs = new URLSearchParams()
  if (params?.read !== undefined) qs.set('read', String(params.read))
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<LetterDto>>(`/letters${suffix}`)
}

export function getLetter(id: string): Promise<{ letter: LetterDto }> {
  return dashboardFetch<{ letter: LetterDto }>(`/letters/${id}`)
}

export function listActivities(params?: {
  page?: number
  limit?: number
}): Promise<Paginated<ActivityDto>> {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<ActivityDto>>(`/activities${suffix}`)
}

export function createRequest(input: {
  serviceId: string
  title: string
  answers?: Record<string, unknown>
}): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>('/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function updateRequest(
  id: string,
  input: { title?: string; answers?: Record<string, unknown> },
): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>(`/requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function submitRequest(
  id: string,
  body?: {
    nonCompeteAcceptance?: { accepted: boolean; textVersionId: string }
    eventRulesAcceptance?: { accepted: boolean; textVersionId: string }
  },
): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>(`/requests/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

export interface AgreementDefinition {
  type: 'non_compete' | 'event_rules'
  version: string
  title: string
  /** False while the text is unapproved: acceptance must not be presented as final. */
  approved: boolean
}

export function listAgreements(): Promise<{ agreements: AgreementDefinition[] }> {
  return dashboardFetch<{ agreements: AgreementDefinition[] }>('/agreements')
}

export interface RequestProposalDetail {
  proposal: {
    requestId: string
    revision: number
    formVersion: string
    applicationTeam: Array<{ name: string; role: string; relation?: string }>
    proposalDocuments: Array<{
      id: string
      filename: string
      mimeType: string
      sizeBytes: number
      logicalVersion: number
      createdAt: string
    }>
    createdAt: string
  } | null
  agreements: Array<{
    id: string
    requestId: string
    revision: number
    agreementType: 'non_compete' | 'event_rules'
    textVersionId: string
    acceptedBy: string
    acceptedAt: string
  }>
}

export function getRequestProposal(id: string, revision?: number): Promise<RequestProposalDetail> {
  const qs = revision ? `?revision=${revision}` : ''
  return dashboardFetch<RequestProposalDetail>(`/requests/${encodeURIComponent(id)}/proposal${qs}`)
}

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

export function canUploadDocuments(request: Pick<RequestDto, 'allowedActions'>): boolean {
  return request.allowedActions?.includes('uploadDocument') === true
}

export function canDeleteDocuments(request: Pick<RequestDto, 'allowedActions'>): boolean {
  return request.allowedActions?.includes('deleteDocument') === true
}

export function mapRequestItem(dto: RequestDto): RequestItem {
  return {
    id: dto.id,
    trackingCode: dto.trackingCode,
    title: dto.title,
    status: dto.status as RequestItem['status'],
    statusLabel: REQUEST_STATUS_LABELS[dto.status],
    currentStep: dto.currentStep ?? '',
    allowedActions: dto.allowedActions ?? [],
    dueDate: formatDate(dto.dueDate),
    createdDate: formatDate(dto.createdAt),
  }
}

export function mapLetterItem(dto: LetterDto): LetterItem {
  return {
    id: dto.id,
    title: dto.title,
    status: dto.type,
    statusLabel: LETTER_TYPE_LABELS[dto.type],
    senderName: dto.senderName ?? 'کارخانه نوآوری',
    senderRole: dto.senderRole ?? '',
    sentDate: formatDate(dto.sentAt),
    read: dto.read,
  }
}

export function mapMailData(dto: LetterDto): MailData {
  return {
    id: dto.id,
    title: dto.title,
    category: LETTER_TYPE_LABELS[dto.type],
    senderName: dto.senderName ?? 'کارخانه نوآوری',
    senderRole: dto.senderRole ?? '',
    datePersian: formatDate(dto.sentAt),
    dayOfWeek: formatWeekday(dto.sentAt),
    timeStr: formatTime(dto.sentAt),
    body: dto.body,
    attachments: [],
  }
}

export function deleteLetter(id: string): Promise<{ success: boolean }> {
  return dashboardFetch<{ success: boolean }>(`/letters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export interface SupportTicketDto {
  requesterName?: string
  id: string
  requesterId: string
  subject: string
  message: string
  status: 'open' | 'answered' | 'closed'
  response: string | null
  respondedBy?: string | null
  messages?: SupportMessageDto[]
  createdAt: string
  updatedAt: string
}

export interface SupportMessageDto {
  id: string
  authorId: string
  authorRole: 'applicant' | 'staff'
  body: string
  createdAt: string
}

export function createSupportTicket(input: {
  subject: string
  message: string
}): Promise<{ ticket: SupportTicketDto }> {
  return dashboardFetch<{ ticket: SupportTicketDto }>('/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function listSupportTickets(): Promise<Paginated<SupportTicketDto>> {
  return dashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100')
}

export type BoothStatus = 'available' | 'unavailable'
export type PriceUnit = 'toman'

export interface BoothDto {
  id: string
  exhibitionId: string
  identifier: string
  specification: string
  location: string | null
  status: BoothStatus
  active: boolean
  available: boolean
  priceAmount: number
  priceUnit: PriceUnit
  priceVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface ExhibitionCatalogueDto {
  exhibitionId: string
  companyBoothLimit: number | null
  guideMapReference: string | null
  booths: BoothDto[]
}

export interface ExhibitionCatalogueSettingsDto {
  exhibitionId: string
  companyBoothLimit: number
  guideMapReference: string | null
  updatedAt: string
}

export interface CreateBoothInput {
  identifier: string
  specification: string
  location?: string | null
  priceAmount: number
  priceUnit: PriceUnit
  status?: BoothStatus
  active?: boolean
}

export type UpdateBoothInput = Omit<Partial<CreateBoothInput>, 'priceAmount' | 'priceUnit'> &
  ({ priceAmount: number; priceUnit: PriceUnit } | { priceAmount?: never; priceUnit?: never })

export interface UpdateExhibitionSettingsInput {
  companyBoothLimit: number
  guideMapReference?: string | null
}

export function formatToman(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '۰ تومان'
  return `${amount.toLocaleString('fa-IR')} تومان`
}

export function parsePersianNumber(value: string): number {
  const normalized = value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .trim()
    .replace(/\s*تومان$/, '')
    .trim()
  // Reject signs, decimals and arbitrary text instead of silently changing the amount.
  if (!/^(?:[0-9]+|[0-9]{1,3}(?:[,٬][0-9]{3})+)$/.test(normalized)) return 0
  const parsed = Number(normalized.replace(/[,٬]/g, ''))
  return Number.isSafeInteger(parsed) ? parsed : 0
}

export function getExhibitionCatalogue(exhibitionId: string): Promise<ExhibitionCatalogueDto> {
  return dashboardFetch<ExhibitionCatalogueDto>(
    `/exhibitions/${encodeURIComponent(exhibitionId)}/catalogue`,
  )
}

export function getAdminExhibitionCatalogue(exhibitionId: string): Promise<ExhibitionCatalogueDto> {
  return dashboardFetch<ExhibitionCatalogueDto>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/catalogue`,
  )
}

export function updateExhibitionSettings(
  exhibitionId: string,
  input: UpdateExhibitionSettingsInput,
): Promise<{ settings: ExhibitionCatalogueSettingsDto }> {
  return dashboardFetch<{ settings: ExhibitionCatalogueSettingsDto }>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/settings`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function createBooth(
  exhibitionId: string,
  input: CreateBoothInput,
): Promise<{ booth: BoothDto }> {
  return dashboardFetch<{ booth: BoothDto }>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/booths`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}

export function updateBooth(
  exhibitionId: string,
  boothId: string,
  input: UpdateBoothInput,
): Promise<{ booth: BoothDto }> {
  return dashboardFetch<{ booth: BoothDto }>(
    `/admin/exhibitions/${encodeURIComponent(exhibitionId)}/booths/${encodeURIComponent(boothId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
}
