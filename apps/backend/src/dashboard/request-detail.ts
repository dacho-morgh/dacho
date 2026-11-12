import type { Pool } from 'pg'

import { isOperationalRole, operationalRoleOf, type OperationalRole } from '../access/roles.js'
import type { Company, CompanyStore } from '../auth/company-store.js'
import type { User, UserStore } from '../auth/user-store.js'
import type { WorkflowStep } from '../catalog/service-catalog.js'
import type { PublicRecordStore, PublicStatus } from '../exhibitions/exhibition-store.js'
import { isUuid } from '../db/uuid.js'
import { dossierOfCompany, type CompanyDossier } from './dossier.js'
import { foundingYearOf } from './financial-package.js'
import type { Address, CompanyInfo, Executive } from './profile-repo.js'
import type { RequestDto } from './request-repo.js'
import { isReviewerRole, necessaryCompanyProfile } from './review-case-repo.js'

/*
 * The parts of `GET /requests/:id` the Figma request page needs beyond the case
 * itself (#288): the event the application belongs to, the company card, who
 * did each history step, and the fixed stages of an event application. Every
 * block is projected here per role; the route never passes a wider record on.
 */

/** Owner, Secretariat, the event's chief and the investment person: the roles that oversee a case. */
export const SUPERVISORY_ROLES: readonly OperationalRole[] = [
  'system-owner',
  'central-secretariat',
  'chief-reviewer',
  'investment-reviewer',
]

export function isSupervisoryRole(role: OperationalRole): boolean {
  return SUPERVISORY_ROLES.includes(role)
}

/* ── Event ─────────────────────────────────────────────────────────────── */

export interface RequestEventDto {
  id: string
  title: string
  category: { id: string; title: string } | null
  subtopic: { id: string; title: string } | null
  /** The public page's poster, a public media URL; null without one or when the CMS did not answer. */
  image: { url: string; alt: string | null } | null
  /** When and where the event is held, from its public page; null when the CMS did not answer. */
  startDate: string | null
  endDate: string | null
  location: string | null
  status: PublicStatus | null
}

/**
 * The event of an event application, or null for a request of another service.
 * Everything here is public (the event page) or already in the reader's queue
 * (title, subtopic), so it is the same for every role that can read the case.
 */
export async function requestEvent(pool: Pool, publicRecords: PublicRecordStore, requestId: string): Promise<RequestEventDto | null> {
  if (!isUuid(requestId)) return null
  const { rows } = await pool.query<{
    id: string
    title: string
    public_event_id: string | null
    subtopic_id: string | null
    subtopic_title: string | null
    category_id: string | null
    category_title: string | null
  }>(
    `SELECT e.id, e.title, e.public_event_id, s.id AS subtopic_id, s.title AS subtopic_title,
            c.id AS category_id, c.title AS category_title
     FROM dashboard.request_rfps rfp
     JOIN dashboard.events e ON e.id = rfp.event_id
     LEFT JOIN dashboard.event_subtopics s ON s.id = rfp.subtopic_id
     LEFT JOIN dashboard.event_categories c ON c.id = s.category_id
     WHERE rfp.request_id = $1`,
    [requestId],
  )
  const row = rows[0]
  if (!row) return null
  // The public page is CMS content; a slow or failed CMS read leaves its fields empty, not the case page.
  const page = row.public_event_id
    ? await publicRecords.find('events', row.public_event_id).catch(() => undefined)
    : undefined
  return {
    id: row.id,
    title: row.title,
    category: row.category_id && row.category_title ? { id: row.category_id, title: row.category_title } : null,
    subtopic: row.subtopic_id && row.subtopic_title ? { id: row.subtopic_id, title: row.subtopic_title } : null,
    image: page?.image ?? null,
    startDate: page?.startDate || null,
    endDate: page?.endDate || null,
    location: page?.location || null,
    status: page?.status ?? null,
  }
}

/* ── Company card ──────────────────────────────────────────────────────── */

export interface RequestCompanyCard {
  /** The company record's id; null for reviewers and employers, who never get account or company ids. */
  id: string | null
  name: string | null
  type: string | null
  province: string | null
  city: string | null
  /** The company's own «وضعیت شرکت» text, as entered in its profile. */
  status: string | null
  /** False once the company's representative account is deactivated («حذف شرکت»). */
  active: boolean | null
  /** The founding year as entered (dossier year, else the establishment date). */
  foundingYear: string | null
  /** Whole years since the founding year, by the calendar the year was written in. */
  ageYears: number | null
  /** The access-checked download route; null when there is no logo or the reader may not see it. */
  logo: { url: string } | null
  /** `profile`: the live company record. `submission`: the profile pinned when the case was submitted. */
  source: 'profile' | 'submission'
}

const blank = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

/** Current year in the Persian calendar, for founding years written as Persian years. */
function currentPersianYear(now: Date): number {
  const text = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year: 'numeric', timeZone: 'Asia/Tehran' }).format(now)
  return Number.parseInt(text, 10)
}

/**
 * Whole years since founding. A Persian year (1200–1450) is compared with the
 * current Persian year and a Gregorian year with the current Gregorian year, so
 * the age is never a year off because of the calendar it was written in.
 */
export function companyAgeYears(foundingYear: string | null, now: Date = new Date()): number | null {
  if (!foundingYear) return null
  const gregorian = foundingYearOf(foundingYear)
  if (gregorian === null) return null
  const normalized = foundingYear.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  const written = Number(/(?<!\d)(\d{4})(?!\d)/.exec(normalized)?.[1])
  const age = written >= 1200 && written <= 1450
    ? currentPersianYear(now) - written
    : now.getUTCFullYear() - gregorian
  return age >= 0 ? age : null
}

export function companyLogoUrl(requestId: string): string {
  return `/api/dashboard/requests/${requestId}/company/logo`
}

/** The case's company: its own record, else the one its submitting representative holds. */
export async function companyOfRequest(companies: CompanyStore, request: Pick<RequestDto, 'companyId' | 'ownerId'>): Promise<Company | undefined> {
  if (request.companyId) return companies.findById(request.companyId).catch(() => undefined)
  return companies.findByRepresentative(request.ownerId).catch(() => undefined)
}

/**
 * The company card per role:
 * - Owner, Secretariat, chief and investment person: the live record's card
 *   fields, the representative account's active flag and the logo route.
 * - The company itself: the same card of its own record, without the logo
 *   (the logo collection is managed by the Secretariat and Owner only).
 * - Reviewers and employers: only name, type, province and city from the profile
 *   pinned at submission, the necessary profile they already read elsewhere.
 */
export async function requestCompanyCard(
  deps: { pool: Pool; companyStore: CompanyStore; userStore: UserStore },
  role: OperationalRole,
  request: Pick<RequestDto, 'id' | 'companyId' | 'ownerId'>,
): Promise<RequestCompanyCard | null> {
  if (isReviewerRole(role)) {
    const pinned = await deps.pool.query<{ snapshot: unknown }>(
      'SELECT snapshot FROM dashboard.request_verifications WHERE request_id = $1',
      [request.id],
    )
    if (!pinned.rows[0]) return null
    const { company } = necessaryCompanyProfile(pinned.rows[0].snapshot)
    return {
      id: null,
      name: blank(company.name),
      type: blank(company.type),
      province: blank(company.province),
      city: blank(company.city),
      status: null,
      active: null,
      foundingYear: null,
      ageYears: null,
      logo: null,
      source: 'submission',
    }
  }

  const company = await companyOfRequest(deps.companyStore, request)
  if (!company) return null
  const foundingYear = blank(company.foundingYear) ?? blank(company.establishmentDate)
  const supervisory = isSupervisoryRole(role)
  let active: boolean | null = null
  if (company.representativeId) {
    const representative = await deps.userStore.findById(company.representativeId).catch(() => undefined)
    active = representative ? representative.isActive !== false : null
  }
  return {
    id: company.id,
    name: blank(company.name),
    type: blank(company.type),
    province: blank(company.province),
    city: blank(company.city),
    status: blank(company.status),
    active,
    foundingYear,
    ageYears: companyAgeYears(foundingYear),
    logo: supervisory && company.logo?.filename ? { url: companyLogoUrl(request.id) } : null,
    source: 'profile',
  }
}

/**
 * The company's own name for each listed case (#288 QA), never the
 * representative's. Reviewers and employers get the name pinned at submission,
 * which their queue already shows; every other reader of the list gets the live
 * company record's name, falling back to the pinned one when the CMS has none.
 */
export async function requestCompanyNames(
  deps: { pool: Pool; companyStore: CompanyStore },
  role: OperationalRole,
  requests: readonly Pick<RequestDto, 'id' | 'companyId' | 'ownerId'>[],
): Promise<Map<string, string | null>> {
  const ids = requests.map((item) => item.id).filter(isUuid)
  const pinned = new Map<string, string | null>()
  if (ids.length > 0) {
    const { rows } = await deps.pool.query<{ request_id: string; name: string | null }>(
      `SELECT request_id, snapshot -> 'company' ->> 'name' AS name
       FROM dashboard.request_verifications WHERE request_id = ANY($1::uuid[])`,
      [ids],
    )
    for (const row of rows) pinned.set(row.request_id, blank(row.name))
  }
  if (isReviewerRole(role)) return new Map(requests.map((item) => [item.id, pinned.get(item.id) ?? null]))

  // One CMS read per distinct company (or representative without a company id), not per row.
  const byCompany = new Map<string, Promise<Company | undefined>>()
  const byOwner = new Map<string, Promise<Company | undefined>>()
  for (const item of requests) {
    if (item.companyId) {
      if (!byCompany.has(item.companyId)) byCompany.set(item.companyId, deps.companyStore.findById(item.companyId).catch(() => undefined))
    } else if (!byOwner.has(item.ownerId)) {
      byOwner.set(item.ownerId, deps.companyStore.findByRepresentative(item.ownerId).catch(() => undefined))
    }
  }
  const names = new Map<string, string | null>()
  for (const item of requests) {
    const company = await (item.companyId ? byCompany.get(item.companyId) : byOwner.get(item.ownerId))
    names.set(item.id, blank(company?.name) ?? pinned.get(item.id) ?? null)
  }
  return names
}

/* ── The company's own profile and resume (representative only) ───────── */

export interface OwnCompanyProfile {
  company: CompanyInfo
  activityDomain: string
  province: string
  city: string
  executives: Executive[]
  addresses: Address[]
  /** Stage-2 completion and resume: products, key members, past projects, certificates. */
  dossier: CompanyDossier
}

/** The representative's own current profile, for «رزومه و اطلاعات شرکت» beside the case. */
export function ownCompanyProfile(company: Company): OwnCompanyProfile {
  return {
    company: {
      name: company.name ?? '',
      establishmentDate: company.establishmentDate ?? '',
      status: company.status ?? '',
      type: company.type ?? '',
      registrationNumber: company.registrationNumber ?? '',
      economicCode: company.economicCode ?? '',
      nationalId: company.nationalId ?? '',
      province: company.province ?? '',
      city: company.city ?? '',
    },
    activityDomain: company.activityDomain ?? '',
    province: company.province ?? '',
    city: company.city ?? '',
    executives: (company.executives ?? []).map((item) => ({ role: String(item.position ?? ''), name: String(item.name ?? '') })),
    addresses: (company.addresses ?? []).map((item, index) => ({
      id: String(item.id ?? `address-${index}`),
      title: String(item.title ?? ''),
      province: String(item.province ?? ''),
      city: String(item.city ?? ''),
      postalCode: String(item.postalCode ?? ''),
      address: String(item.address ?? ''),
    })),
    dossier: dossierOfCompany(company),
  }
}

/* ── History actors ────────────────────────────────────────────────────── */

/** The actor id the backend records for steps it takes itself; not a CMS account. */
export const SYSTEM_ACTOR_ID = 'system'

const actorIdOf = (row: object): string | null => {
  const id = (row as { actorId?: unknown }).actorId
  return typeof id === 'string' && id !== '' ? id : null
}

/**
 * Who did each history step («توسط …»). Reviewers and employers already get rows
 * without the actor, so nothing is added for them. The company sees names (and
 * `actorId`) only for steps its own account took; for Fund staff it gets the
 * role, never the name or account id, so a chief or reviewer is not identified
 * to the applicant.
 */
export async function withTimelineActors<T extends object>(
  userStore: UserStore,
  role: OperationalRole,
  timeline: T[],
  ownAccountIds: readonly string[],
): Promise<(T & { actorName: string | null; actorRole: OperationalRole | null })[] | T[]> {
  if (isReviewerRole(role)) return timeline
  // Automatic steps (the investment handoff) carry the actor `system`, which is no account: never look it up.
  const ids = [...new Set(timeline.map(actorIdOf).filter((id): id is string => id !== null && id !== SYSTEM_ACTOR_ID))]
  const people = new Map<string, User | undefined>(
    await Promise.all(ids.map(async (id) => [id, await userStore.findById(id).catch(() => undefined)] as const)),
  )
  const roleOf = (user: User | undefined): OperationalRole | null =>
    !user ? null : isOperationalRole(user.operationalRole) ? user.operationalRole : operationalRoleOf(user)
  return timeline.map((row) => {
    const actorId = actorIdOf(row)
    const user = actorId ? people.get(actorId) : undefined
    const own = actorId !== null && ownAccountIds.includes(actorId)
    const nameVisible = role !== 'representative' || own
    // The company never gets a staff member's account id either; its own steps keep theirs.
    const visibleRow = role === 'representative' && !own ? withoutActorId(row) : row
    return {
      ...visibleRow,
      actorName: nameVisible && user?.name?.trim() ? user.name.trim() : null,
      actorRole: roleOf(user),
    }
  })
}

/** The row without `actorId`, for a reader who may not identify the person who acted. */
export function withoutActorId<T extends object>(row: T): T {
  if (!('actorId' in row)) return row
  const { actorId: _actorId, ...rest } = row as T & { actorId?: unknown }
  return rest as T
}

/**
 * History rows for the company outside the case page (`/requests/:id/history`,
 * `/activities`): Fund staff steps lose their `actorId`; the company's own keep it.
 */
export function companyActivityView<T extends { actorId: string | null; ownerId: string }>(row: T, actorId: string): T {
  return row.actorId === null || row.actorId === actorId || row.actorId === row.ownerId ? row : withoutActorId(row)
}

/* ── Fixed stages of an event application ──────────────────────────────── */

export type WorkflowStepState = 'done' | 'current' | 'upcoming' | 'rejected'

export interface RequestWorkflowStep extends WorkflowStep {
  key: EventStageKey
  state: WorkflowStepState
}

export type EventStageKey = 'submission' | 'chief_triage' | 'review' | 'investment' | 'result'

/*
 * The CMS no longer stores service workflows, so an event application's stages
 * come from the backend's own fixed process (T21–T33). The keys avoid naming the
 * company's package files: the chief and reviewers are not told about them.
 */
export const EVENT_APPLICATION_STAGES: readonly (WorkflowStep & { key: EventStageKey })[] = [
  { key: 'submission', title: 'ثبت و ارسال درخواست', role: 'representative', roleName: 'شرکت', order: 0 },
  { key: 'chief_triage', title: 'بررسی اولیه سردبیر', role: 'chief-reviewer', roleName: 'سردبیر', order: 1 },
  { key: 'review', title: 'داوری و تصمیم سردبیر', role: 'reviewer', roleName: 'داوران', order: 2 },
  { key: 'investment', title: 'بررسی سرمایه‌گذاری', role: 'investment-reviewer', roleName: 'کمیته سرمایه‌گذاری', order: 3 },
  { key: 'result', title: 'اعلام نتیجه', role: 'central-secretariat', roleName: 'دبیرخانه', order: 4 },
]

/** The stage a case is in, from what the server recorded; see the table in docs/system/request-dossier.md. */
export function eventStage(
  request: Pick<RequestDto, 'status' | 'reviewStage'>,
  facts: { resultPublished: boolean; lastAction: string | null },
): { key: EventStageKey; state: WorkflowStepState } {
  if (request.status === 'rejected') {
    return { key: facts.lastAction === 'chief_review_reject' ? 'review' : 'chief_triage', state: 'rejected' }
  }
  if (request.status === 'approved') return { key: 'result', state: 'done' }
  if (facts.resultPublished) return { key: 'result', state: 'current' }
  if (request.status === 'draft' || request.status === 'action_needed') return { key: 'submission', state: 'current' }
  if (request.reviewStage === 'triaged') return { key: 'review', state: 'current' }
  if (request.reviewStage === 'advanced') return { key: 'investment', state: 'current' }
  return { key: 'chief_triage', state: 'current' }
}

export function eventWorkflow(
  request: Pick<RequestDto, 'status' | 'reviewStage'>,
  facts: { resultPublished: boolean; lastAction: string | null },
): RequestWorkflowStep[] {
  const stage = eventStage(request, facts)
  const at = EVENT_APPLICATION_STAGES.findIndex((step) => step.key === stage.key)
  return EVENT_APPLICATION_STAGES.map((step, index) => ({
    ...step,
    state: index < at ? 'done' : index === at ? stage.state : stage.state === 'done' ? 'done' : 'upcoming',
  }))
}
