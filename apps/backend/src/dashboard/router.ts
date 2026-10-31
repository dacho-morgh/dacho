import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import type { Pool } from 'pg'

import {
  allowedEventActions,
  canActOnEvent,
  canManageEvents,
} from '../access/events.js'
import {
  allowedRequestActions,
  bindRequestScope,
  canReadDocument,
  canRequestAction,
  isChiefCorrectionStatus,
  isFinancialStageOpen,
  requestScopeFor,
  type RequestScope,
} from '../access/policy.js'
import {
  isCaseAssignmentRole,
  isInternalOperationalRole,
  isOperationalRole,
  operationalRoleOf,
  type CaseAssignmentRole,
  type OperationalRole,
} from '../access/roles.js'
import type { ServiceCatalog, ServiceDefinition } from '../catalog/service-catalog.js'
import { ActivityRepository } from './activity-repo.js'
import { AssignmentRepository } from './assignment-repo.js'
import { ReviewRoundRepository, type ReplaceSlotResult, type RoundStartContext } from './review-round-repo.js'
import {
  isReviewerRole,
  necessaryCompanyProfile,
  parseQueueView,
  ReviewCaseRepository,
  reviewerActivityView,
  reviewerRequestView,
  type ReviewCaseFile,
} from './review-case-repo.js'
import {
  DossierValidationError,
  dossierOfCompany,
  missingDossierItems,
  mergeDossier,
  pickDossierUpdate,
  SqlDossierDocumentSource,
  type DossierDocumentSource,
} from './dossier.js'
import {
  EventCategoryRepository,
  type EventCategoryStore,
} from './event-category-repo.js'
import {
  EventRepository,
  isEventId,
  type EventConfiguration,
  type EventInput,
  type EventStore,
} from './event-repo.js'
import { LetterRepository, type CreateLetterInput, type LetterAttachmentDto, type LetterDto } from './letter-repo.js'
import { DocumentRepository, type PrivateDocumentRecord } from '../documents/repo.js'
import { canSendLetter } from './letter-policy.js'
import { FinancialPackageRepository } from './financial-package-repo.js'
import { InvestmentCaseRepository } from './investment-case-repo.js'
import { statementYearPlan } from './financial-package.js'
import { ProfileRepository } from './profile-repo.js'
import { actorOf, requireProxyAuth } from './proxy-auth.js'
import {
  AGREEMENT_TEXTS_APPROVED,
  CURRENT_EVENT_RULES_VERSION,
  CURRENT_NON_COMPETE_VERSION,
  RequestRepository,
  parseApplicationTeam,
} from './request-repo.js'
import { StatsRepository } from './stats-repo.js'
import type { CompanyStore } from '../auth/company-store.js'
import type { User, UserStore } from '../auth/user-store.js'
import { SupportRepository } from './support-repo.js'
import { createDocumentRouter } from '../documents/router.js'
import { createRfpRouter } from './rfp-router.js'
import type { PrivateDocumentStorage } from '../documents/storage.js'
import { canOpenDashboardDestination } from './destination-access.js'
import { dashboardSelfProfile } from './self-profile.js'
import {
  isUuid,
  parseBoothCreate,
  parseBoothUpdate,
  parseSettingsInput,
} from '../exhibitions/catalogue.js'
import {
  PostgresBoothCatalogueRepository,
  type BoothCatalogueRepository,
} from '../exhibitions/catalogue-repo.js'
import {
  PostgresBoothReservationRepository,
  type BoothCompanyEligibility,
  type BoothReservationRepository,
} from '../exhibitions/reservation-repo.js'
import type { ExhibitionStore } from '../exhibitions/exhibition-store.js'
import {
  PostgresEvaluationRepository,
  type EvaluationDto,
  type EvaluationStore,
} from '../reviews/evaluation-repo.js'
import { ROUND_REQUIRED_EVALUATIONS } from '../reviews/round-completion.js'
import { validateAndScoreReview } from '../reviews/scoring.js'
import {
  PostgresNotificationOutbox,
  type NotificationOutbox,
} from './notification-outbox.js'
import { PostgresVerificationStore, type VerificationStore } from './verification-repo.js'

export interface DashboardDeps {
  pool: Pool
  serviceCatalog: ServiceCatalog
  proxySecret: string
  userStore: UserStore
  companyStore: CompanyStore
  privateDocumentStorage: PrivateDocumentStorage
  /** Test seam for the company dossier's document inventory. */
  dossierDocuments?: DossierDocumentSource
  eventStore?: EventStore
  eventCategoryStore?: EventCategoryStore
  boothCatalogue?: BoothCatalogueRepository
  boothReservations?: BoothReservationRepository
  boothCompanyEligibility?: BoothCompanyEligibility
  eventCompanyEligibility?: BoothCompanyEligibility
  exhibitionStore?: ExhibitionStore
  evaluationStore?: EvaluationStore
  notificationOutbox?: NotificationOutbox
  verificationStore?: VerificationStore
}

const dashboardRoles = {
  'system-owner': {
    label: 'صاحب سیستم',
    responsibilities: ['مدیریت دسترسی‌های سامانه', 'پیگیری همه درخواست‌ها و نامه‌ها'],
    destinations: ['/dashboard', '/dashboard/companies', '/dashboard/employees', '/dashboard/requests', '/dashboard/letters', '/dashboard/events', '/dashboard/exhibitions', '/dashboard/profile'],
  },
  'central-secretariat': {
    label: 'دبیرخانه مرکزی',
    responsibilities: ['پیگیری درخواست‌های ارجاع‌شده در محدوده دبیرخانه', 'مدیریت اطلاعات شرکت‌ها'],
    destinations: ['/dashboard', '/dashboard/companies', '/dashboard/employees', '/dashboard/requests', '/dashboard/letters', '/dashboard/profile'],
  },
  'chief-reviewer': {
    label: 'سردبیر داوری',
    responsibilities: ['رسیدگی به درخواست‌های منتسب'],
    destinations: ['/dashboard', '/dashboard/requests', '/dashboard/letters', '/dashboard/profile'],
  },
  reviewer: {
    label: 'داور',
    responsibilities: ['مطالعه درخواست‌های منتسب'],
    destinations: ['/dashboard', '/dashboard/requests', '/dashboard/letters', '/dashboard/profile'],
  },
  'employer-reviewer': {
    label: 'کارشناس کارفرما',
    responsibilities: ['رسیدگی به درخواست‌های منتسب کارفرما'],
    destinations: ['/dashboard', '/dashboard/requests', '/dashboard/letters', '/dashboard/profile'],
  },
  'investment-reviewer': {
    label: 'کارشناس سرمایه‌گذاری',
    responsibilities: ['رسیدگی به درخواست‌های منتسب سرمایه‌گذاری'],
    destinations: ['/dashboard', '/dashboard/requests', '/dashboard/letters', '/dashboard/profile'],
  },
  representative: {
    label: 'نماینده شرکت',
    responsibilities: ['مدیریت درخواست‌های شرکت خود', 'پیگیری نامه‌ها و رویدادهای در دسترس'],
    destinations: ['/dashboard', '/dashboard/requests', '/dashboard/letters', '/dashboard/events', '/dashboard/profile'],
  },
} as const

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return n
}

/** Nine digits at most, so the value always fits the integer revision column. */
function parseRevisionQuery(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,8}$/.test(value)) return null
  return Number(value)
}

/** Consent counts only when the submit itself accepts the exact current text. */
function acceptsAgreementVersion(value: unknown, currentVersion: string): boolean {
  if (!value || typeof value !== 'object') return false
  const { accepted, textVersionId } = value as { accepted?: unknown; textVersionId?: unknown }
  return accepted === true && textVersionId === currentVersion
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function eventUpdateBody(body: unknown): Record<string, unknown> | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  return body as Record<string, unknown>
}

function parseEventRevision(body: unknown): number | null {
  const revision = eventUpdateBody(body)?.revision
  return typeof revision === 'number' && Number.isInteger(revision) && revision > 0
    ? revision
    : null
}

function parseEventReason(body: unknown): string | null {
  const reason = eventUpdateBody(body)?.reason
  if (typeof reason !== 'string') return null
  const trimmed = reason.trim()
  return trimmed ? trimmed : null
}

function isRepresentative(role: string): boolean {
  return role === 'representative'
}

function isCompanyAdministrator(role: string): boolean {
  return role === 'system-owner' || role === 'central-secretariat'
}

function requesterDisplayName(user: Awaited<ReturnType<UserStore['findById']>>): string {
  return user?.name || 'شرکت متقاضی'
}

function safeOwner(user: User | undefined | null) {
  return user ? { id: user.id, name: user.name ?? null } : null
}

/** Adds the download routes to a case file's proposal and RFP; each route still authorizes its reader. */
function withDownloadUrls(requestId: string, found: Pick<ReviewCaseFile, 'proposal' | 'rfp'>) {
  return {
    proposal: found.proposal && {
      ...found.proposal,
      documents: found.proposal.documents.map((document) => ({
        ...document,
        downloadUrl: `/api/dashboard/documents/${document.id}/download`,
      })),
    },
    rfp: found.rfp && {
      ...found.rfp,
      files: found.rfp.files.map((file) => ({
        ...file,
        downloadUrl: `/api/dashboard/requests/${requestId}/rfp/files/${file.id}`,
      })),
    },
  }
}

function requestWithActions(
  role: Parameters<typeof allowedRequestActions>[0],
  actorId: string,
  request: Awaited<ReturnType<RequestRepository['findByIdAny']>>,
  companyId?: string | null,
  actorIsResponsibleChief = false,
  reviewRoundStarted = false,
  reviewRoundComplete = false,
  financialPackageSubmitted = false,
) {
  if (!request) return request
  return {
    ...request,
    allowedActions: allowedRequestActions(
      role,
      { ...request, actorIsResponsibleChief, reviewRoundStarted, reviewRoundComplete, financialPackageSubmitted },
      actorId,
      companyId,
    ),
  }
}

function parseExpectedRevision(value: unknown): number | undefined | null {
  if (value === undefined) return undefined
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null
}

/** Optional free-text reason: undefined/blank -> null, a non-string or over-long value -> false. */
function parseOptionalReason(value: unknown): string | null | false {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length > 1000) return false
  return trimmed ? trimmed : null
}

function parseDecisionReason(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

type EventValidation =
  | { ok: true; input: EventInput }
  | { ok: false; error: 'invalid_event'; fields: string[] }
  | { ok: false; error: 'invalid_registration_window' }

function normalizeEventInput(body: unknown, existing?: EventConfiguration): EventValidation {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_event', fields: [] }
  }
  const source = body as Record<string, unknown>
  const valueOf = (key: keyof EventInput, fallback: unknown): unknown =>
    key in source ? source[key] : fallback

  const titleValue = valueOf('title', existing?.title)
  const title = typeof titleValue === 'string' ? titleValue.trim() : ''
  const descriptionValue = valueOf('description', existing?.description ?? '')
  const description = typeof descriptionValue === 'string' ? descriptionValue.trim() : null
  const openValue = valueOf('registrationOpenAt', existing?.registrationOpenAt)
  const openText = typeof openValue === 'string' ? openValue.trim() : ''
  const closeValue = valueOf('registrationCloseAt', existing?.registrationCloseAt)
  const closeText = typeof closeValue === 'string' ? closeValue.trim() : ''
  const chiefValue = valueOf('responsibleChiefId', existing?.responsibleChiefId)
  const chiefId = typeof chiefValue === 'string' ? chiefValue.trim() : ''
  const investmentValue = valueOf('responsibleInvestmentId', existing?.responsibleInvestmentId)
  const investmentId = typeof investmentValue === 'string' ? investmentValue.trim() : ''

  const fields: string[] = []
  if (!title) fields.push('title')
  if (description === null) fields.push('description')
  if (!openText) fields.push('registrationOpenAt')
  if (!closeText) fields.push('registrationCloseAt')
  if (!chiefId) fields.push('responsibleChiefId')
  if (!investmentId) fields.push('responsibleInvestmentId')
  if (fields.length > 0) return { ok: false, error: 'invalid_event', fields }

  const open = Date.parse(openText)
  const close = Date.parse(closeText)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) {
    return { ok: false, error: 'invalid_registration_window' }
  }

  return {
    ok: true,
    input: {
      title,
      description: description ?? '',
      registrationOpenAt: new Date(open).toISOString(),
      registrationCloseAt: new Date(close).toISOString(),
      responsibleChiefId: chiefId,
      responsibleInvestmentId: investmentId,
    },
  }
}

function eventWithActions(
  role: Parameters<typeof allowedEventActions>[0],
  actorId: string,
  event: EventConfiguration,
) {
  return {
    ...event,
    allowedActions: allowedEventActions(role, actorId, event),
  }
}

async function ineligibleResponsibleField(
  userStore: UserStore,
  input: EventInput,
): Promise<'responsibleChiefId' | 'responsibleInvestmentId' | null> {
  const [chief, investment] = await Promise.all(
    [input.responsibleChiefId, input.responsibleInvestmentId].map(async (id) => {
      try {
        return await userStore.findById(id)
      } catch {
        return undefined
      }
    }),
  )
  if (!chief || operationalRoleOf(chief) !== 'chief-reviewer') return 'responsibleChiefId'
  if (!investment || operationalRoleOf(investment) !== 'investment-reviewer') {
    return 'responsibleInvestmentId'
  }
  return null
}

async function resolveRequesterNames(userStore: UserStore, requesterIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(requesterIds)]
  const users = await Promise.all(ids.map(async (id) => {
    try {
      return [id, await userStore.findById(id)] as const
    } catch {
      return [id, undefined] as const
    }
  }))
  const byId = new Map(users)

  if (users.some(([, user]) => !user)) {
    try {
      for (const user of await userStore.list({ role: 'representative' })) {
        if (!byId.get(user.id)) byId.set(user.id, user)
      }
    } catch {
      // Ticket access must remain available when the optional CMS name lookup fails.
    }
  }

  return new Map(ids.map((id) => [id, requesterDisplayName(byId.get(id))]))
}

/** Returns the names of required form fields missing from `answers`, or null when complete. */
function missingRequiredFields(service: ServiceDefinition, answers: Record<string, unknown>): string[] | null {
  const fields = service.formFields
  if (!fields || fields.length === 0) return null

  const missing: string[] = []
  for (const field of fields) {
    if (!field.required) continue
    const value = answers[field.name]
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (empty) missing.push(field.name)
  }
  return missing.length > 0 ? missing : null
}

export function createDashboardRouter(deps: DashboardDeps): Router {
  const router = Router()
  const notificationOutbox =
    deps.notificationOutbox ?? new PostgresNotificationOutbox(deps.pool)
  const repo = new RequestRepository(deps.pool, notificationOutbox)
  const letters = new LetterRepository(deps.pool)
  const activities = new ActivityRepository(deps.pool)
  const stats = new StatsRepository(deps.pool)
  const profileRepo = new ProfileRepository(deps.userStore, deps.companyStore)
  const dossierDocuments = deps.dossierDocuments ?? new SqlDossierDocumentSource(deps.pool)
  const support = new SupportRepository(deps.pool)
  const assignments = new AssignmentRepository(deps.pool)
  const rounds = new ReviewRoundRepository(deps.pool)
  const financialPackages = new FinancialPackageRepository(deps.pool)
  const investmentCases = new InvestmentCaseRepository(deps.pool)
  const reviewCases = new ReviewCaseRepository(deps.pool)
  const evaluations =
    deps.evaluationStore ?? new PostgresEvaluationRepository(deps.pool)
  const eventStore = deps.eventStore ?? new EventRepository(deps.pool)
  const categoryStore =
    deps.eventCategoryStore ?? new EventCategoryRepository(deps.pool)
  const catalogue =
    deps.boothCatalogue ?? new PostgresBoothCatalogueRepository(deps.pool)
  const boothReservations =
    deps.boothReservations ?? new PostgresBoothReservationRepository(deps.pool)
  const verificationStore =
    deps.verificationStore ?? new PostgresVerificationStore(deps.pool)

  async function checkExhibition(
    exhibitionId: string,
  ): Promise<{ ok: true; exists: boolean } | { ok: false }> {
    if (!deps.exhibitionStore) return { ok: true, exists: true }
    try {
      return { ok: true, exists: await deps.exhibitionStore.exists(exhibitionId) }
    } catch {
      return { ok: false }
    }
  }

  const actorCompanyId = async (actorId: string, role: string): Promise<string | null> => {
    if (role !== 'representative') return null
    const company = await deps.companyStore.findByRepresentative(actorId)
    return company?.id ?? null
  }

  /** Adds server-derived actions; chiefs also need event-level responsibility per case. */
  const presentRequests = async <T extends NonNullable<Awaited<ReturnType<RequestRepository['findByIdAny']>>>>(
    actor: { id: string; operationalRole: OperationalRole },
    items: T[],
    companyId?: string | null,
  ) => {
    const reviewable = (item: T) =>
      item.status === 'in_review' && (item.reviewStage === 'chief_triage' || item.reviewStage === 'triaged')
    const chiefCases =
      actor.operationalRole === 'chief-reviewer'
        ? await repo.requestsOfResponsibleChief(items.filter(reviewable).map((item) => item.id), actor.id)
        : new Set<string>()
    // Chiefs act on their own cases; the owner may replace the employer on any triaged case.
    const roundCases = items.filter(
      (item) =>
        item.reviewStage === 'triaged' &&
        (actor.operationalRole === 'system-owner' ? item.status === 'in_review' : chiefCases.has(item.id)),
    )
    const currentRounds = await rounds.currentRoundsOf(roundCases.map((item) => item.id))
    const packaged = await financialPackages.submittedRequestIds(
      items.filter((item) => isFinancialStageOpen(item.status, item.reviewStage)).map((item) => item.id),
    )
    return items.map((item) =>
      requestWithActions(
        actor.operationalRole, actor.id, item, companyId, chiefCases.has(item.id),
        currentRounds.has(item.id), currentRounds.get(item.id) === true, packaged.has(item.id),
      )!,
    )
  }

  /** Reviewers and employers get the minimal case view from the generic request routes (T23). */
  const limitRequest = async <T extends NonNullable<Awaited<ReturnType<RequestRepository['findByIdAny']>>>>(
    actor: { id: string; operationalRole: OperationalRole },
    item: T,
    withAnswers: boolean,
  ) => {
    if (!isReviewerRole(actor.operationalRole)) return item
    let answers: Record<string, unknown> = {}
    if (withAnswers) {
      // Event applications show the reviewed revision; requests with nothing pinned keep their own answers.
      const reviewed = await reviewCases.reviewedProposalRevision(item.id, { id: actor.id, role: actor.operationalRole })
      const proposal = reviewed === null ? null : await repo.findRequestProposal(item.id, reviewed)
      answers = proposal ? (proposal.answers ?? {}) : item.answers
    }
    return reviewerRequestView(item, answers) as unknown as T
  }

  const limitActivities = <A extends Parameters<typeof reviewerActivityView>[0]>(
    actor: { operationalRole: OperationalRole },
    items: A[],
  ) => (isReviewerRole(actor.operationalRole) ? items.map(reviewerActivityView) : items)

  const resolveScope = async (actorId: string, role: OperationalRole): Promise<{ scope: RequestScope; companyId: string | null }> => {
    const companyId = await actorCompanyId(actorId, role)
    const scope = bindRequestScope(requestScopeFor(role), actorId, companyId)
    return { scope, companyId }
  }

  // Mailbox visibility never expands the underlying document audience.
  const canReadAttachment = async (doc: PrivateDocumentRecord, actorId: string, role: OperationalRole): Promise<boolean> => {
    const companyId = await actorCompanyId(actorId, role)
    let assigned = false
    if (doc.requestId && isCaseAssignmentRole(role)) {
      if (isReviewerRole(role)) {
        // Reviewers see only the proposal files pinned to the revision they review (T23).
        const pinned = await reviewCases.reviewableProposalDocumentIds(doc.requestId, { id: actorId, role })
        assigned = pinned === 'unrestricted' || pinned?.has(doc.id) === true
      } else {
        assigned = await assignments.activeFor(doc.requestId, actorId, role)
      }
    }
    return canReadDocument(role, { ...doc, assigned }, actorId, companyId)
  }

  const attachmentMatchesLetter = async (doc: PrivateDocumentRecord, requestId: string | null): Promise<boolean> => {
    if (doc.requestId !== null) return doc.requestId === requestId
    if (requestId === null) return true
    // Dossier files have no request id; bind them to the case's actual company.
    const request = await repo.findByIdScoped(requestId, { kind: 'all' })
    if (!request || !doc.companyId) return false
    const companyId = request.companyId ?? (await deps.companyStore.findByRepresentative(request.ownerId))?.id
    return doc.companyId === companyId
  }

  const attachmentDto = (doc: PrivateDocumentRecord): LetterAttachmentDto => ({
    id: doc.id,
    name: doc.filename,
    filename: doc.filename,
    category: doc.category,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    size: `${Math.max(1, Math.round(doc.sizeBytes / 1024))} KB`,
    downloadUrl: `/api/dashboard/documents/${doc.id}/download`,
  })

  const presentLetter = async (letter: LetterDto, actorId: string, role: OperationalRole): Promise<LetterDto> => {
    const attachments: LetterAttachmentDto[] = []
    const documents = new DocumentRepository(deps.pool)
    for (const value of Array.isArray(letter.attachments) ? letter.attachments : []) {
      const id = value && typeof value === 'object' ? (value as { id?: unknown }).id : null
      if (typeof id !== 'string' || !isUuid(id)) continue
      const doc = await documents.findById(id)
      if (!doc || !(await attachmentMatchesLetter(doc, letter.requestId)) || !(await canReadAttachment(doc, actorId, role))) continue
      attachments.push(attachmentDto(doc))
    }
    return { ...letter, attachments }
  }

  router.use(requireProxyAuth(deps.proxySecret, deps.userStore))
  router.use(createDocumentRouter({ ...deps, verificationStore }))
  router.use(
    createRfpRouter({
      pool: deps.pool,
      companyStore: deps.companyStore,
      privateDocumentStorage: deps.privateDocumentStorage,
    }),
  )

  router.get('/capabilities', (_req, res) => {
    const actor = actorOf(res)
    const role = actor.user.operationalRole
    if (!isOperationalRole(role)) {
      res.set('Cache-Control', 'private, no-store, max-age=0').status(403).json({ error: 'forbidden' })
      return
    }
    const definition = dashboardRoles[role]
    res.set('Cache-Control', 'private, no-store, max-age=0')
    res.set('Vary', 'Cookie')
    res.json({
      role,
      roleLabel: definition.label,
      responsibilities: [...definition.responsibilities],
      destinations: [...definition.destinations],
      // Scope identifiers reveal no assignments or personnel records. Request
      // APIs continue to resolve the current scope independently on every call.
      requestScope: role === 'system-owner' || role === 'central-secretariat'
        ? 'all'
        : role === 'representative' ? 'owned' : 'assigned',
      eventScope: null,
    })
  })

  router.get('/access', (req, res) => {
    const actor = actorOf(res)
    const requestedPath = typeof req.query.path === 'string' ? req.query.path : ''
    const role = actor.user.operationalRole
    res.set('Cache-Control', 'private, no-store, max-age=0')
    if (!isOperationalRole(role)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    res.json({ allowed: canOpenDashboardDestination(role, requestedPath) })
  })

  // The company profile adapter is privileged; only the current representative
  // of an existing company reaches it.
  router.use('/profile', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      if (_req.path === '/me') {
        next()
        return
      }
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!await deps.companyStore.findByRepresentative(actor.id)) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      next()
    } catch (error) { next(error) }
  })

  router.post('/requests', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'representative_only' })
        return
      }
      const { serviceId, title, answers, eventId, subtopicId, rfpVersionId } = req.body ?? {}

      if (typeof serviceId !== 'string' || serviceId.trim() === '') {
        res.status(400).json({ error: 'invalid_service' })
        return
      }
      if (typeof title !== 'string' || title.trim() === '') {
        res.status(400).json({ error: 'invalid_title' })
        return
      }

      const answersValue = answers === undefined ? {} : answers
      if (typeof answersValue !== 'object' || answersValue === null || Array.isArray(answersValue)) {
        res.status(400).json({ error: 'invalid_answers' })
        return
      }

      const service = await deps.serviceCatalog.findById(serviceId)
      if (!service) {
        res.status(404).json({ error: 'service_not_found' })
        return
      }

      const rfpFields = [eventId, subtopicId, rfpVersionId]
      const hasAnyRfp = rfpFields.some((f) => f !== undefined)
      if (hasAnyRfp) {
        if (!rfpFields.every((f) => typeof f === 'string' && isUuid(f))) {
          res.status(400).json({ error: 'invalid_rfp_context' })
          return
        }
      }

      const companyId = await actorCompanyId(actor.id, actor.operationalRole)
      if (actor.operationalRole === 'representative' && !companyId) {
        res.status(403).json({ error: 'company_required' })
        return
      }
      const request = await repo.create({
        serviceId,
        serviceKey: service.key,
        serviceName: service.title,
        title,
        ownerId: actor.id,
        companyId,
        answers: answersValue as Record<string, unknown>,
        rfp: hasAnyRfp ? { eventId, subtopicId, versionId: rfpVersionId } : undefined,
      })
      res.status(201).json({ request: requestWithActions(actor.operationalRole, actor.id, request, companyId) })
    } catch (error) {
      if (error instanceof Error && error.message === 'stale_rfp') {
        res.status(409).json({ error: 'stale_rfp' })
        return
      }
      if (error instanceof Error && error.message === 'duplicate_subtopic_request') {
        res.status(409).json({ error: 'duplicate_subtopic_request' })
        return
      }
      if (error instanceof Error && error.message === 'invalid_event_subtopic') {
        res.status(400).json({ error: 'invalid_event_subtopic' })
        return
      }
      next(error)
    }
  })

  router.get('/agreements', (_req, res) => {
    res.json({
      agreements: [
        {
          type: 'non_compete',
          version: CURRENT_NON_COMPETE_VERSION,
          title: 'قرارداد عدم رقابت',
          approved: AGREEMENT_TEXTS_APPROVED,
        },
        {
          type: 'event_rules',
          version: CURRENT_EVENT_RULES_VERSION,
          title: 'قوانین رویداد',
          approved: AGREEMENT_TEXTS_APPROVED,
        },
      ],
    })
  })

  router.patch('/requests/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { title, answers } = req.body ?? {}
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim() === '') {
          res.status(400).json({ error: 'invalid_title' })
          return
        }
      }
      if (answers !== undefined) {
        if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
          res.status(400).json({ error: 'invalid_answers' })
          return
        }
      }
      const companyId = await actorCompanyId(actor.id, actor.operationalRole)
      const result = await repo.updateDraft(req.params.id, actor.id, companyId, {
        title,
        answers,
      })
      if (result === 'not_found') {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (result === 'not_draft') {
        res.status(409).json({ error: 'request_not_draft' })
        return
      }
      res.json({ request: requestWithActions(actor.operationalRole, actor.id, result, companyId) })
    } catch (error) { next(error) }
  })

  router.get('/requests', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const result = await repo.listScoped(scope, { status, page, limit })
    res.json({
      ...result,
      items: await Promise.all(
        (await presentRequests(actor, result.items, companyId)).map((item) => limitRequest(actor, item, false)),
      ),
    })
    } catch (error) { next(error) }
  })

  router.get('/admin/requests', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const result = await repo.listScoped(scope, {
      status,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 25),
    })
    const presented = await presentRequests(actor, result.items)
    const items = await Promise.all(
      presented.map(async (item) => ({
        ...(await limitRequest(actor, item, false)),
        owner: isReviewerRole(actor.operationalRole) ? null : safeOwner(await deps.userStore.findById(item.ownerId)),
      })),
    )
    res.json({ ...result, items })
    } catch (error) { next(error) }
  })

  router.get('/admin/requests/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    const service = await deps.serviceCatalog.findById(request.serviceId)
    res.json({
      request: await limitRequest(actor, (await presentRequests(actor, [request]))[0]!, true),
      owner: isReviewerRole(actor.operationalRole) ? null : safeOwner(await deps.userStore.findById(request.ownerId)),
      timeline: limitActivities(actor, await activities.listForRequestScoped(request.id, scope)),
      workflow: service?.workflow ?? [],
    })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const service = await deps.serviceCatalog.findById(request.serviceId)
    const timeline = limitActivities(actor, await activities.listForRequestScoped(request.id, scope))
    res.json({
      request: await limitRequest(actor, (await presentRequests(actor, [request], companyId))[0]!, true),
      timeline,
      workflow: service?.workflow ?? [],
      owner: isReviewerRole(actor.operationalRole) ? null : safeOwner(await deps.userStore.findById(request.ownerId)),
    })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/history', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ items: limitActivities(actor, await activities.listForRequestScoped(request.id, scope)) })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/submit', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    // A representative retrying an already-submitted request gets the stable
    // conflict response even though `allowedActions` no longer advertises
    // `submit`. Other roles are denied by the shared action policy.
    const isCompanyRequest =
      actor.operationalRole === 'representative' &&
      ((request.companyId && companyId && request.companyId === companyId) ||
        (!request.companyId && request.ownerId === actor.id))
    if (isCompanyRequest && request.status !== 'draft') {
      res.status(409).json({ error: 'already_submitted' })
      return
    }
    if (!canRequestAction(actor.operationalRole, request, actor.id, 'submit', companyId)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    const currentVerification = companyId
      ? await verificationStore.findCurrentByCompanyId(companyId)
      : null
    if (currentVerification?.status !== 'approved' ||
        (deps.eventCompanyEligibility && !await deps.eventCompanyEligibility.isVerified(companyId!))) {
      res.status(403).json({ error: 'company_not_verified' })
      return
    }

    const rfpEntry = await deps.pool.query<{ version_id: string; current_rfp_version_id: string | null }>(
      `SELECT c.version_id, s.current_rfp_version_id
       FROM dashboard.request_rfps c
       JOIN dashboard.event_subtopics s ON s.id = c.subtopic_id
       WHERE c.request_id = $1`,
      [request.id],
    )
    if (rfpEntry.rows[0] && rfpEntry.rows[0].version_id !== rfpEntry.rows[0].current_rfp_version_id) {
      res.status(409).json({ error: 'stale_rfp' })
      return
    }
    const isEventRequest = rfpEntry.rows.length > 0

    // Validate answers against the service's form schema (required fields present).
    const service = await deps.serviceCatalog.findById(request.serviceId)
    const missing: string[] = []
    if (service) {
      const serviceMissing = missingRequiredFields(service, request.answers)
      if (serviceMissing) {
        missing.push(...serviceMissing)
      }
    }

    if (isEventRequest) {
      if (!parseApplicationTeam(request.answers?.applicationTeam)) {
        missing.push('applicationTeam')
      }

      const proposalDocs = await deps.pool.query(
        `SELECT 1 FROM dashboard.private_documents WHERE request_id = $1 AND category = 'proposal'`,
        [request.id],
      )
      if ((proposalDocs.rowCount ?? 0) === 0) {
        missing.push('proposalDocuments')
      }

      if (!acceptsAgreementVersion(req.body?.nonCompeteAcceptance, CURRENT_NON_COMPETE_VERSION)) {
        missing.push('nonCompeteAcceptance')
      }
      if (!acceptsAgreementVersion(req.body?.eventRulesAcceptance, CURRENT_EVENT_RULES_VERSION)) {
        missing.push('eventRulesAcceptance')
      }
    }

    if (missing.length > 0) {
      res.status(400).json({ error: 'invalid_answers', missingFields: missing })
      return
    }

    const firstStep = service?.workflow[0]
    const result = await repo.submit(
      req.params.id,
      actor.id,
      firstStep ? { assignedRole: firstStep.roleName, currentStep: firstStep.title } : undefined,
      companyId,
      true,
      isEventRequest
        ? { nonCompeteVersion: CURRENT_NON_COMPETE_VERSION, eventRulesVersion: CURRENT_EVENT_RULES_VERSION }
        : undefined,
    )
    if (typeof result === 'object' && 'missingFields' in result) {
      res.status(400).json({ error: 'invalid_answers', missingFields: result.missingFields })
      return
    }
    if (result === 'company_not_verified') {
      res.status(403).json({ error: 'company_not_verified' })
      return
    }
    if (result === 'not_found') {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (result === 'already_submitted') {
      res.status(409).json({ error: 'already_submitted' })
      return
    }
    if (result === 'stale_rfp') {
      res.status(409).json({ error: 'stale_rfp' })
      return
    }
    res.json({ request: requestWithActions(actor.operationalRole, actor.id, result, companyId) })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/verification', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const pinned = await repo.findRequestVerification(request.id)
      if (!pinned) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isCompanyAdministrator(actor.operationalRole) && !isRepresentative(actor.operationalRole)) {
        // Case assignment permits only the profile fields needed for review;
        // it never grants access to the private verification dossier or files.
        pinned.snapshot = { ...necessaryCompanyProfile(pinned.snapshot) }
      }
      res.json({ verification: pinned })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/proposal', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const revision = req.query.revision === undefined ? undefined : parseRevisionQuery(req.query.revision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      if (isReviewerRole(actor.operationalRole)) {
        // A reviewer sees only the proposal revision the assignment covers, never
        // other revisions of the same case or the company's later corrections.
        const reviewed = await reviewCases.reviewedProposalRevision(
          request.id, { id: actor.id, role: actor.operationalRole },
        )
        if (reviewed === null) {
          // Nothing pinned to review (for example a request of another service).
          res.json({ proposal: null, agreements: [], revisions: [] })
          return
        }
        if (revision !== undefined && revision !== reviewed) {
          res.status(404).json({ error: 'not_found' })
          return
        }
        const proposal = await repo.findRequestProposal(request.id, reviewed)
        // The accepting representative's id is not the reviewer's business.
        const agreements = proposal ? await repo.listRequestAgreements(request.id, proposal.revision) : []
        res.json({
          proposal,
          agreements: agreements.map(({ acceptedBy: _acceptedBy, ...agreement }) => agreement),
          revisions: [reviewed],
        })
        return
      }
      const proposal = await repo.findRequestProposal(request.id, revision)
      const agreements = proposal ? await repo.listRequestAgreements(request.id, proposal.revision) : []
      res.json({ proposal, agreements, revisions: await repo.listProposalRevisions(request.id) })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/triage', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { action, reason, expectedRevision } = req.body ?? {}
      if (action !== 'accept' && action !== 'return' && action !== 'reject') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      const trimmedReason = parseDecisionReason(reason)
      if (action !== 'accept' && !trimmedReason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const revision = parseExpectedRevision(expectedRevision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const result = await repo.decideTriage({
        requestId: req.params.id,
        actorId: actor.id,
        action,
        reason: action === 'accept' ? null : trimmedReason,
        expectedRevision: revision,
      })
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'forbidden') { res.status(403).json({ error: 'forbidden' }); return }
      if (result === 'invalid_state') { res.status(409).json({ error: 'invalid_triage_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      res.json({ request: (await presentRequests(actor, [result.request]))[0] })
    } catch (error) { next(error) }
  })

  /** The responsible chief's explicit decision once a round holds its four final evaluations (T28). */
  router.post('/requests/:id/review-decision', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { action, reason, expectedRevision } = req.body ?? {}
      if (action !== 'advance' && action !== 'return' && action !== 'reject') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      const trimmedReason = parseDecisionReason(reason)
      if (action !== 'advance' && !trimmedReason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const revision = parseExpectedRevision(expectedRevision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const result = await repo.decideReview({
        requestId: req.params.id,
        actorId: actor.id,
        action,
        reason: action === 'advance' ? null : trimmedReason,
        expectedRevision: revision,
      })
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'forbidden') { res.status(403).json({ error: 'forbidden' }); return }
      if (result === 'invalid_state') { res.status(409).json({ error: 'invalid_decision_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      if (result === 'round_not_ready') { res.status(409).json({ error: 'round_not_ready' }); return }
      res.json({ request: (await presentRequests(actor, [result.request]))[0] })
    } catch (error) { next(error) }
  })

  /**
   * The financial package invitation (T29) for the owning company, Secretariat and
   * the owner. Chiefs and reviewers are outside the financial audience, and the
   * investment person reads the package through the case dossier (T31).
   */
  router.get('/requests/:id/financial-invitation', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role !== 'representative' && role !== 'central-secretariat' && role !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const invitation = request.reviewStage === 'advanced' ? await repo.findFinancialInvitation(request.id) : null
      if (!invitation) {
        res.status(409).json({ error: 'financial_stage_not_open' })
        return
      }
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ invitation })
    } catch (error) { next(error) }
  })

  /**
   * The company submits its financial package (T30). Every checklist category and
   * every statement year the founding date requires must have a file; otherwise
   * nothing is stored and the response names the gaps. A complete package freezes
   * the financial files and hands the case to the event's investment person (T31).
   * It does not advance the case. A repeated submit returns the stored package.
   */
  router.post('/requests/:id/financial-package', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request || !allowedRequestActions(actor.operationalRole, request, actor.id, companyId).includes('read')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isFinancialStageOpen(request.status, request.reviewStage)) {
        res.status(409).json({ error: 'financial_stage_not_open' })
        return
      }
      const company = request.companyId
        ? await deps.companyStore.findById(request.companyId).catch(() => undefined)
        : await deps.companyStore.findByRepresentative(request.ownerId)
      const plan = statementYearPlan(company?.establishmentDate)
      if (!plan.ok) {
        res.status(422).json({ error: plan.error })
        return
      }
      const result = await financialPackages.submit({
        requestId: request.id,
        actorId: actor.id,
        expectedYears: plan.years,
      })
      switch (result.status) {
        case 'submitted':
          res.status(201).json({ package: result.package })
          return
        case 'already_submitted':
          res.json({ package: result.package })
          return
        case 'incomplete':
          res.status(422).json({
            error: 'financial_package_incomplete',
            missingCategories: result.gaps.missingCategories,
            missingStatementYears: result.gaps.missingStatementYears,
          })
          return
        case 'stage_closed':
          res.status(409).json({ error: 'financial_stage_not_open' })
          return
        case 'not_found':
          res.status(404).json({ error: 'not_found' })
          return
      }
    } catch (error) { next(error) }
  })

  /** The company's latest submitted financial package, for the owning company, Secretariat and the owner. */
  router.get('/requests/:id/financial-package', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role !== 'representative' && role !== 'central-secretariat' && role !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      const pkg = request ? await financialPackages.findLatest(request.id) : null
      if (!pkg) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ package: pkg })
    } catch (error) { next(error) }
  })

  /* ── Assigned reviewer queue and case file (T23) ───────────────────── */

  /** Reviewer and employer inbox, fed only by the actor's active server-side assignments. */
  router.get('/review/queue', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isReviewerRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const view = parseQueueView(req.query.view)
      if (!view) {
        res.status(400).json({ error: 'invalid_view' })
        return
      }
      const queue = await reviewCases.listQueue(
        { id: actor.id, role: actor.operationalRole },
        { view, page: Math.min(parsePositiveInt(req.query.page, 1), 1_000_000), limit: Math.min(parsePositiveInt(req.query.limit, 25), 100) },
      )
      res.set('Cache-Control', 'private, no-store, max-age=0').json(queue)
    } catch (error) { next(error) }
  })

  /**
   * The assigned case file: the reviewed proposal revision with its pinned files,
   * the pinned RFP and the necessary company profile. Another reviewer's work, the
   * round roster, financial files and the private dossier are not part of it.
   */
  router.get('/review/cases/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isReviewerRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const found = await reviewCases.findCase({ id: actor.id, role: actor.operationalRole }, req.params.id)
      if (!found) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.set('Cache-Control', 'private, no-store, max-age=0').json({
        ...found,
        ...withDownloadUrls(found.case.requestId, found),
      })
    } catch (error) { next(error) }
  })

  /* ── Investment queue and dossier (T31) ────────────────────────────── */

  /** The investment person's inbox: only cases whose package reached them. */
  router.get('/investment/queue', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'investment-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const queue = await investmentCases.listQueue(actor.id, {
        page: Math.min(parsePositiveInt(req.query.page, 1), 1_000_000),
        limit: Math.min(parsePositiveInt(req.query.limit, 25), 100),
      })
      res.set('Cache-Control', 'private, no-store, max-age=0').json(queue)
    } catch (error) { next(error) }
  })

  /**
   * The dossier of a handed-off case: the advanced proposal and RFP, the necessary
   * company profile, the frozen package and the round's final evaluations. Drafts and
   * evaluations of people who left their slot stay out, as they do from the count, and
   * authors stay unnamed. The private verification dossier is not part of it.
   */
  router.get('/investment/cases/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'investment-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const found = await investmentCases.findCase(actor.id, req.params.id)
      if (!found) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const { packageDetail, ...summary } = found
      const materials = await reviewCases.caseMaterials(found.requestId, found.proposalRevision)
      const round = await rounds.findByRevision(found.requestId, found.reviewedRevision)
      const counted = (round?.slots ?? []).filter((slot) => slot.active)
      const reviews = (await evaluations.listForRequest(found.requestId, found.reviewedRevision))
        .filter((item) => item.state === 'final' && counted.some((slot) => slot.userId === item.userId && slot.role === item.role))
        .map(({ userId: _userId, ...item }) => item)
      res.set('Cache-Control', 'private, no-store, max-age=0').json({
        case: summary,
        ...materials,
        ...withDownloadUrls(found.requestId, materials),
        package: {
          ...found.package,
          ...packageDetail,
          documents: packageDetail.documents.map((document) => ({
            ...document,
            downloadUrl: `/api/dashboard/documents/${document.id}/download`,
          })),
        },
        evaluations: reviews,
      })
    } catch (error) { next(error) }
  })

  /* ── Review round and the four assignments (T22) ───────────────────── */

  /**
   * The employer for this case: the owner's last substitute (T26) while that
   * person is still a usable employer-reviewer, otherwise the subtopic's own.
   */
  const roundEmployerOf = async (context: RoundStartContext): Promise<string | null> => {
    for (const id of [context.replacementEmployerId, context.employerId]) {
      if (!id) continue
      const user = await deps.userStore.findById(id).catch(() => undefined)
      if (user && operationalRoleOf(user) === 'employer-reviewer') return id
    }
    return null
  }

  const replaceSlotResponse = (res: Response, result: ReplaceSlotResult) => {
    if (typeof result === 'object') { res.json({ round: result.round }); return }
    const rejected: Record<Exclude<ReplaceSlotResult, { round: unknown }>, [number, string]> = {
      not_found: [404, 'not_found'],
      forbidden: [403, 'forbidden'],
      invalid_state: [409, 'invalid_round_state'],
      stale_revision: [409, 'stale_revision'],
      no_round: [409, 'round_not_started'],
      not_assigned: [404, 'not_assigned'],
      evaluation_final: [409, 'evaluation_final'],
      already_assigned: [409, 'already_assigned'],
      previously_assigned: [409, 'previously_assigned'],
    }
    const [status, error] = rejected[result]
    res.status(status).json({ error })
  }

  /** Reviewers the responsible chief may pick: active ordinary reviewers, never other roles. */
  router.get('/requests/:id/review-round/candidates', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      if (context.responsibleChiefId !== actor.id) { res.status(403).json({ error: 'forbidden' }); return }
      const users = await deps.userStore.list({ operationalRole: 'reviewer' })
      // Once a round exists for the current revision the list serves replacement:
      // nobody who already held a slot of it returns. An earlier revision's round
      // does not narrow the pick for a new round.
      const latest = await rounds.findLatest(req.params.id)
      const current = latest && latest.requestRevision === context.revision ? latest : null
      const seen = new Set(current?.slots.map((slot) => slot.userId) ?? [])
      const employerId = current?.employerId ?? (await roundEmployerOf(context)) ?? context.employerId
      const items = users
        .filter((user) => operationalRoleOf(user) === 'reviewer' && user.id !== employerId && !seen.has(user.id))
        .map((user) => ({ id: user.id, name: user.name ?? null }))
      res.json({ items, employerId })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/review-round', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) { res.status(400).json({ error: 'invalid_revision' }); return }
      const rawReviewers: unknown = req.body?.reviewerIds
      const reviewerIds = Array.isArray(rawReviewers)
        ? rawReviewers.map((value) => (typeof value === 'string' ? value.trim() : ''))
        : []
      if (reviewerIds.length !== 3 || reviewerIds.some((id) => !id)) {
        res.status(400).json({ error: 'three_reviewers_required' })
        return
      }

      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      if (context.responsibleChiefId !== actor.id) { res.status(403).json({ error: 'forbidden' }); return }

      // Four distinct active people: the case's employer plus three other reviewers.
      const employerId = await roundEmployerOf(context)
      if (!employerId) {
        res.status(409).json({ error: 'employer_unavailable' })
        return
      }
      if (new Set([...reviewerIds, employerId]).size !== 4) {
        res.status(400).json({ error: 'duplicate_people' })
        return
      }
      for (const reviewerId of reviewerIds) {
        const reviewer = await deps.userStore.findById(reviewerId).catch(() => undefined)
        if (!reviewer || operationalRoleOf(reviewer) !== 'reviewer') {
          res.status(400).json({ error: 'reviewer_not_eligible', userId: reviewerId })
          return
        }
      }

      const result = await rounds.start({
        requestId: req.params.id,
        actorId: actor.id,
        employerId,
        reviewerIds,
        expectedRevision: revision,
      })
      if (typeof result === 'object') { res.status(201).json({ round: result.round }); return }
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'forbidden') { res.status(403).json({ error: 'forbidden' }); return }
      if (result === 'invalid_state') { res.status(409).json({ error: 'invalid_round_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      if (result === 'round_exists') { res.status(409).json({ error: 'round_already_started' }); return }
      res.status(409).json({ error: result })
    } catch (error) { next(error) }
  })

  /**
   * Oversight (owner, Secretariat, the case's chief) sees all four slots; an
   * assigned reviewer or employer sees only their own slot, never who else was
   * picked. Companies and investment people have no part in a review round.
   */
  router.get('/requests/:id/review-round', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role === 'representative' || role === 'investment-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) { res.status(404).json({ error: 'not_found' }); return }
      const round = await rounds.findLatest(request.id)
      if (!round) { res.json({ round: null }); return }
      if (role === 'reviewer' || role === 'employer-reviewer') {
        const mine = round.slots.find((slot) => slot.userId === actor.id && slot.active)
        if (!mine) { res.status(404).json({ error: 'not_found' }); return }
        const { id, requestId, requestRevision, proposalRevision, startedAt } = round
        res.json({ round: { id, requestId, requestRevision, proposalRevision, startedAt, slots: [mine] } })
        return
      }
      res.json({ round })
    } catch (error) { next(error) }
  })

  /** Every round of the case with its decision, for the people who oversee it. */
  router.get('/requests/:id/review-rounds', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role !== 'system-owner' && role !== 'central-secretariat' && role !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) { res.status(404).json({ error: 'not_found' }); return }
      res.json({ items: await rounds.listForRequest(request.id) })
    } catch (error) { next(error) }
  })

  /* ── Replacing a round slot (T26) ───────────────────────────────────── */

  /** The responsible chief replaces an ordinary reviewer who has not finalized. */
  router.post('/requests/:id/review-round/reviewers/:userId/replace', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) { res.status(400).json({ error: 'invalid_revision' }); return }
      const replacementId = typeof req.body?.replacementId === 'string' ? req.body.replacementId.trim() : ''
      if (!replacementId) { res.status(400).json({ error: 'replacement_required' }); return }
      const reason = parseOptionalReason(req.body?.reason)
      if (reason === false) { res.status(400).json({ error: 'invalid_reason' }); return }

      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      if (context.responsibleChiefId !== actor.id) { res.status(403).json({ error: 'forbidden' }); return }
      if (replacementId === req.params.userId) { res.status(400).json({ error: 'duplicate_people' }); return }
      const incoming = await deps.userStore.findById(replacementId).catch(() => undefined)
      if (!incoming || operationalRoleOf(incoming) !== 'reviewer') {
        res.status(400).json({ error: 'reviewer_not_eligible', userId: replacementId })
        return
      }
      replaceSlotResponse(res, await rounds.replaceSlot({
        requestId: req.params.id,
        actorId: actor.id,
        slot: 'ordinary',
        outgoingUserId: req.params.userId,
        incomingUserId: replacementId,
        reason,
        expectedRevision: revision,
        authority: 'chief',
      }))
    } catch (error) { next(error) }
  })

  /** Employers the owner may put in place of the case's current one. */
  router.get('/requests/:id/review-round/employer-candidates', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const round = await rounds.findLatest(req.params.id)
      if (!round) { res.status(404).json({ error: 'not_found' }); return }
      const seen = new Set(round.slots.map((slot) => slot.userId))
      const users = await deps.userStore.list({ operationalRole: 'employer-reviewer' })
      const items = users
        .filter((user) => operationalRoleOf(user) === 'employer-reviewer' && !seen.has(user.id))
        .map((user) => ({ id: user.id, name: user.name ?? null }))
      res.json({ items, employerId: round.employerId })
    } catch (error) { next(error) }
  })

  /** Only the system owner changes a case's employer, and always with a reason. */
  router.post('/requests/:id/review-round/employer/replace', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) { res.status(400).json({ error: 'invalid_revision' }); return }
      const employerId = typeof req.body?.employerId === 'string' ? req.body.employerId.trim() : ''
      if (!employerId) { res.status(400).json({ error: 'replacement_required' }); return }
      const reason = parseOptionalReason(req.body?.reason)
      if (reason === false) { res.status(400).json({ error: 'invalid_reason' }); return }
      if (reason === null) { res.status(400).json({ error: 'reason_required' }); return }

      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      const incoming = await deps.userStore.findById(employerId).catch(() => undefined)
      if (!incoming || operationalRoleOf(incoming) !== 'employer-reviewer') {
        res.status(400).json({ error: 'employer_not_eligible', userId: employerId })
        return
      }
      replaceSlotResponse(res, await rounds.replaceSlot({
        requestId: req.params.id,
        actorId: actor.id,
        slot: 'employer',
        incomingUserId: employerId,
        reason,
        expectedRevision: revision,
        authority: 'owner',
      }))
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/resubmit', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isChiefCorrectionStatus(request.status, request.reviewStage)) {
        res.status(409).json({ error: 'not_correctable' })
        return
      }

      const missing: string[] = []
      const service = await deps.serviceCatalog.findById(request.serviceId)
      if (service) missing.push(...(missingRequiredFields(service, request.answers) ?? []))
      if (!parseApplicationTeam(request.answers?.applicationTeam)) missing.push('applicationTeam')
      const proposalDocs = await deps.pool.query(
        `SELECT 1 FROM dashboard.private_documents WHERE request_id = $1 AND category = 'proposal'`,
        [request.id],
      )
      if ((proposalDocs.rowCount ?? 0) === 0) missing.push('proposalDocuments')
      if (!acceptsAgreementVersion(req.body?.nonCompeteAcceptance, CURRENT_NON_COMPETE_VERSION)) {
        missing.push('nonCompeteAcceptance')
      }
      if (!acceptsAgreementVersion(req.body?.eventRulesAcceptance, CURRENT_EVENT_RULES_VERSION)) {
        missing.push('eventRulesAcceptance')
      }
      if (missing.length > 0) {
        res.status(400).json({ error: 'invalid_answers', missingFields: missing })
        return
      }

      const result = await repo.resubmitCorrection(request.id, actor.id, companyId, {
        nonCompeteVersion: CURRENT_NON_COMPETE_VERSION,
        eventRulesVersion: CURRENT_EVENT_RULES_VERSION,
      })
      if (typeof result === 'object' && 'missingFields' in result) {
        res.status(400).json({ error: 'invalid_answers', missingFields: result.missingFields })
        return
      }
      if (result === 'company_not_verified') { res.status(403).json({ error: 'company_not_verified' }); return }
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'not_correctable') { res.status(409).json({ error: 'not_correctable' }); return }
      res.json({ request: requestWithActions(actor.operationalRole, actor.id, result, companyId) })
    } catch (error) { next(error) }
  })

  router.post('/admin/requests/:id/reopen', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const reason = parseDecisionReason(req.body?.reason)
      if (!reason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const result = await repo.reopenRejected({
        requestId: req.params.id,
        actorId: actor.id,
        reason,
        expectedRevision: revision,
      })
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'not_rejected') { res.status(409).json({ error: 'invalid_reopen_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      res.json({ request: (await presentRequests(actor, [result]))[0] })
    } catch (error) { next(error) }
  })

  /*
   * Minimal case-assignment primitive used by the shared policy. Full triage and
   * reviewer-slot assignment remain T21/T22; this command deliberately does not
   * start a review round or change request state.
   */
  router.get('/admin/requests/:id/assignments', async (req, res) => {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const request = await repo.findByIdAny(req.params.id)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ items: await assignments.listForRequest(request.id) })
  })

  router.post('/admin/requests/:id/assignments', async (req, res) => {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const request = await repo.findByIdAny(req.params.id)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    if (!canRequestAction(actor.operationalRole, request, actor.id, 'assign')) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : ''
    const role = req.body?.role
    if (!userId || !isCaseAssignmentRole(role)) {
      res.status(400).json({ error: 'invalid_assignment' })
      return
    }
    const target = await deps.userStore.findById(userId).catch(() => undefined)
    if (!target || operationalRoleOf(target) !== role) {
      // The assignment role must match the person's current operational role.
      res.status(400).json({ error: 'assignment_role_mismatch' })
      return
    }
    const created = await assignments.create({
      requestId: request.id,
      userId,
      role: role as CaseAssignmentRole,
      assignedBy: actor.id,
    })
    if (!created.ok) {
      // The four slots belong to the review round; replacement is its own command.
      res.status(409).json({ error: created.reason })
      return
    }
    res.status(201).json({ assignment: created.assignment })
  })

  router.delete('/admin/requests/:id/assignments/:userId', async (req, res) => {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const request = await repo.findByIdAny(req.params.id)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    if (!canRequestAction(actor.operationalRole, request, actor.id, 'assign')) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const held = (await assignments.listForRequest(request.id)).find(
      (item) => item.active && item.userId === req.params.userId,
    )
    if (held?.roundId) {
      res.status(409).json({ error: 'managed_by_review_round' })
      return
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null
    const revoked = await assignments.revoke({
      requestId: request.id,
      userId: req.params.userId,
      revokedBy: actor.id,
      reason: reason || null,
    })
    if (!revoked) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ assignment: revoked })
  })

  /* ── Evaluation routes (T25) ────────────────────────────────────────── */

  async function currentCompletion(requestId: string, items: EvaluationDto[]): Promise<number> {
    const active = (await assignments.listForRequest(requestId)).filter((item) => item.active)
    return items.filter((item) => item.state === 'final' && active.some(
      (assignment) => assignment.userId === item.userId && assignment.role === item.role,
    )).length
  }

  function oversightEvaluation(item: EvaluationDto) {
    if (item.state === 'final') return item
    // Unfinished answer content is visible only to its author, including for owner oversight.
    const { id, requestId, userId, role, variant, state, revision, createdAt, updatedAt, finalizedAt } = item
    return { id, requestId, userId, role, variant, state, revision, createdAt, updatedAt, finalizedAt }
  }

  router.get('/requests/:id/evaluation', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'reviewer' && actor.operationalRole !== 'employer-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!await assignments.activeFor(request.id, actor.id, actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      // The revision this person's round reviews: a decided case has moved past it.
      const revision = await reviewCases.reviewedRequestRevision(
        request.id, { id: actor.id, role: actor.operationalRole },
      ) ?? request.revision
      // Own evaluation only: how far the other three are is not a reviewer's to see.
      const evaluation = await evaluations.findByRequestAndUser(request.id, actor.id, revision)
      res.json({ evaluation, revision })
    } catch (error) { next(error) }
  })

  router.put('/requests/:id/evaluation', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'reviewer' && actor.operationalRole !== 'employer-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!await assignments.activeFor(request.id, actor.id, actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 1) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      if (req.body.revision !== request.revision || request.status !== 'in_review') {
        res.status(409).json({ error: 'stale_evaluation' })
        return
      }
      const variant = actor.operationalRole === 'employer-reviewer' ? 'employer' : 'ordinary'
      const scores = req.body?.scores ?? {}
      const answers = req.body?.answers ?? {}
      const validation = validateAndScoreReview({
        variant,
        state: 'draft',
        scores,
        answers,
        ...(req.body?.calculatedScores ? { calculatedScores: req.body.calculatedScores } : {}),
      })
      if (!validation.valid) {
        res.status(400).json({ error: 'validation_failed', errors: validation.errors })
        return
      }
      const revision = request.revision
      const result = await evaluations.saveDraft({
        requestId: request.id,
        userId: actor.id,
        role: actor.operationalRole,
        variant,
        revision,
        scores,
        scoreA: validation.scores.a,
        scoreB: validation.scores.b,
        scoreC: validation.scores.c,
        weightedHundredths: validation.scores.weightedHundredths,
        answers,
      })
      if (!result.ok) {
        res.status(result.reason === 'forbidden' ? 403 : 409).json({
          error: result.reason === 'locked' ? 'evaluation_locked' : result.reason === 'forbidden' ? 'forbidden' : 'stale_evaluation',
        })
        return
      }
      res.json({ evaluation: result.evaluation })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/evaluation/finalize', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'reviewer' && actor.operationalRole !== 'employer-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!await assignments.activeFor(request.id, actor.id, actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 1) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      if (req.body.revision !== request.revision || request.status !== 'in_review') {
        res.status(409).json({ error: 'stale_evaluation' })
        return
      }
      const variant = actor.operationalRole === 'employer-reviewer' ? 'employer' : 'ordinary'
      const scores = req.body?.scores ?? {}
      const answers = req.body?.answers ?? {}
      const validation = validateAndScoreReview({
        variant,
        state: 'final',
        scores,
        answers,
        ...(req.body?.calculatedScores ? { calculatedScores: req.body.calculatedScores } : {}),
      })
      if (!validation.valid) {
        res.status(400).json({ error: 'validation_failed', errors: validation.errors })
        return
      }
      const revision = request.revision
      const result = await evaluations.finalize({
        requestId: request.id,
        userId: actor.id,
        role: actor.operationalRole,
        variant,
        revision,
        scores,
        scoreA: validation.scores.a,
        scoreB: validation.scores.b,
        scoreC: validation.scores.c,
        weightedHundredths: validation.scores.weightedHundredths,
        answers,
      })
      if (!result.ok) {
        res.status(result.reason === 'forbidden' ? 403 : 409).json({
          error: result.reason === 'locked' ? 'evaluation_locked' : result.reason === 'forbidden' ? 'forbidden' : 'stale_evaluation',
        })
        return
      }
      res.json({ evaluation: result.evaluation })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/evaluations', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const allowedRoles: OperationalRole[] = ['system-owner', 'chief-reviewer', 'central-secretariat']
      if (!allowedRoles.includes(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (actor.operationalRole === 'chief-reviewer' &&
          !await assignments.activeFor(request.id, actor.id, 'chief-reviewer')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      // The current revision by default; `revision` reads the evaluations of a past round.
      const requested = req.query.revision === undefined ? request.revision : parseRevisionQuery(req.query.revision)
      if (requested === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const items = await evaluations.listForRequest(request.id, requested)
      const round = await rounds.findByRevision(request.id, requested)
      const completedCount = requested === request.revision
        ? await currentCompletion(request.id, items)
        : round?.completion.finalized ?? 0
      res.json({
        items: items.map(oversightEvaluation),
        revision: requested,
        completedCount,
        requiredCount: ROUND_REQUIRED_EVALUATIONS,
        readyForChiefDecision: round?.completion.ready ?? false,
      })
    } catch (error) { next(error) }
  })

  router.get('/admin/events', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const events = await eventStore.list()
    const items = events
      .filter((event) => canActOnEvent(actor.operationalRole, actor.id, event, 'read'))
      .map((event) => eventWithActions(actor.operationalRole, actor.id, event))
    res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/admin/events/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    if (!isEventId(req.params.id)) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const event = await eventStore.findById(req.params.id)
    if (!event || !canActOnEvent(actor.operationalRole, actor.id, event, 'read')) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ event: eventWithActions(actor.operationalRole, actor.id, event) })
    } catch (error) { next(error) }
  })

  router.post('/admin/events', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!canManageEvents(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const parsed = normalizeEventInput(req.body)
    if (!parsed.ok) {
      res.status(400).json(
        parsed.error === 'invalid_event'
          ? { error: parsed.error, fields: parsed.fields }
          : { error: parsed.error },
      )
      return
    }
    const ineligible = await ineligibleResponsibleField(deps.userStore, parsed.input)
    if (ineligible) {
      res.status(400).json({ error: 'ineligible_responsible_person', field: ineligible })
      return
    }
    const event = await eventStore.create({ ...parsed.input, createdBy: actor.id })
    res.status(201).json({ event: eventWithActions(actor.operationalRole, actor.id, event) })
    } catch (error) { next(error) }
  })

  router.patch('/admin/events/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!canManageEvents(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    if (!isEventId(req.params.id)) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const existing = await eventStore.findById(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const revision = parseEventRevision(req.body)
    if (revision === null) {
      res.status(400).json({ error: 'invalid_event', fields: ['revision'] })
      return
    }
    const reason = parseEventReason(req.body)
    if (reason === null) {
      res.status(400).json({ error: 'invalid_event', fields: ['reason'] })
      return
    }
    if (existing.revision !== revision) {
      res.status(409).json({ error: 'stale_event', revision: existing.revision })
      return
    }
    const parsed = normalizeEventInput(req.body, existing)
    if (!parsed.ok) {
      res.status(400).json(
        parsed.error === 'invalid_event'
          ? { error: parsed.error, fields: parsed.fields }
          : { error: parsed.error },
      )
      return
    }
    const ineligible = await ineligibleResponsibleField(deps.userStore, parsed.input)
    if (ineligible) {
      res.status(400).json({ error: 'ineligible_responsible_person', field: ineligible })
      return
    }
    const updated = await eventStore.update(existing.id, {
      ...parsed.input,
      expectedRevision: revision,
      actorId: actor.id,
      reason,
    })
    if (!updated.ok) {
      if (updated.error === 'stale') {
        res.status(409).json({ error: 'stale_event', revision: updated.event.revision })
        return
      }
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ event: eventWithActions(actor.operationalRole, actor.id, updated.event) })
    } catch (error) { next(error) }
  })

  router.post('/admin/events/:eventId/categories', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!canManageEvents(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
      if (!title) {
        res.status(400).json({ error: 'invalid_category' })
        return
      }
      const category = await categoryStore.createCategory(req.params.eventId, title)
      res.status(201).json({ category })
    } catch (error) { next(error) }
  })

  router.get('/admin/events/:eventId/categories', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isInternalOperationalRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event || !canActOnEvent(actor.operationalRole, actor.id, event, 'read')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listCategories(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/events/:eventId/categories', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const admin = actor.operationalRole === 'system-owner' || actor.operationalRole === 'central-secretariat'
      const company = actor.operationalRole === 'representative' && (await deps.companyStore.findByRepresentative(actor.id))
      if (!admin && !company) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listCategories(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.post('/admin/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!canManageEvents(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
      const categoryId = typeof req.body?.categoryId === 'string' ? req.body.categoryId.trim() : ''
      const employerId = typeof req.body?.employerId === 'string' ? req.body.employerId.trim() : ''
      if (!title || !categoryId || !isUuid(categoryId) || !employerId) {
        res.status(400).json({ error: 'invalid_subtopic' })
        return
      }
      const category = await categoryStore.findCategoryById(categoryId)
      if (!category || category.eventId !== req.params.eventId) {
        res.status(400).json({ error: 'invalid_category_event' })
        return
      }
      const user = await deps.userStore.findById(employerId)
      // User and company IDs belong to different collections and may overlap.
      // Resolve the employer as a person; an unrelated company's ID is not evidence of its type.
      if (!user || user.companyId) {
        res.status(400).json({ error: 'ineligible_employer' })
        return
      }
      if (operationalRoleOf(user) !== 'employer-reviewer') {
        res.status(400).json({ error: 'ineligible_employer' })
        return
      }
      const subtopic = await categoryStore.createSubtopic({
        eventId: req.params.eventId,
        categoryId,
        title,
        employerId,
      })
      res.status(201).json({ subtopic })
    } catch (error) { next(error) }
  })

  router.get('/admin/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isInternalOperationalRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event || !canActOnEvent(actor.operationalRole, actor.id, event, 'read')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listSubtopics(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const admin = actor.operationalRole === 'system-owner' || actor.operationalRole === 'central-secretariat'
      const company = actor.operationalRole === 'representative' && (await deps.companyStore.findByRepresentative(actor.id))
      if (!admin && !company) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listSubtopics(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/letters', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const read = parseBoolean(req.query.read)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const result = await letters.listScoped(scope, { read, page, limit })
    res.json({ ...result, items: await Promise.all(result.items.map((letter) => presentLetter(letter, actor.id, actor.operationalRole))) })
    } catch (error) { next(error) }
  })

  router.get('/letters/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const letter = await letters.findByIdAndMarkReadScoped(req.params.id, scope, actor.id)
    if (!letter) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ letter: await presentLetter(letter, actor.id, actor.operationalRole) })
    } catch (error) { next(error) }
  })

  router.get('/stats', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await stats.forScope(scope))
    } catch (error) { next(error) }
  })

  router.get('/stats/overview', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await stats.forScope(scope))
    } catch (error) { next(error) }
  })

  router.get('/activities', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const feed = await activities.listScoped(scope, page, limit)
    res.json({ ...feed, items: limitActivities(actor, feed.items) })
    } catch (error) { next(error) }
  })

  router.get('/profile', async (_req, res) => {
    const actor = actorOf(res)
    const profile = await profileRepo.getProfile(actor.id)
    res.json(profile)
  })

  router.get('/profile/me', (_req, res) => {
    const actor = actorOf(res)
    res.set('Cache-Control', 'private, no-store, max-age=0')
    res.json(dashboardSelfProfile(actor.user, actor.operationalRole))
  })

  router.patch('/profile', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { company, contacts } = req.body ?? {}
    let profile = await profileRepo.getProfile(actor.id)
    const initialProfile = profile
    if (company?.nationalId !== undefined && company.nationalId !== profile.company.nationalId) {
      res.status(403).json({ error: 'protected_company_identity' })
      return
    }
    let dossierUpdate
    try {
      dossierUpdate = pickDossierUpdate(req.body?.dossier ?? req.body)
      mergeDossier(profile.dossier, dossierUpdate)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
    }

    let identityChanged = false
    if (company && typeof company === 'object') {
      if (
        (company.name !== undefined && company.name !== initialProfile.company.name) ||
        (company.registrationNumber !== undefined && company.registrationNumber !== initialProfile.company.registrationNumber) ||
        (company.type !== undefined && company.type !== initialProfile.company.type)
      ) {
        identityChanged = true
      }
    }
    if (dossierUpdate) {
      if (
        dossierUpdate.legalEntityType !== undefined &&
        dossierUpdate.legalEntityType !== initialProfile.dossier.legalEntityType
      ) {
        identityChanged = true
      }
    }

    // Invalidate before any external write: a later contact/storage failure
    // must not leave changed identity data eligible under the old approval.
    if (identityChanged && initialProfile.companyId) {
      await verificationStore.invalidateApproval(
        initialProfile.companyId,
        'تغییر اطلاعات هویتی؛ نیازمند احراز مجدد',
      )
    }
    // Write the dossier first: its merge validation is the only 400-producing
    // part of this combined PATCH, so a rejected request must not leave the
    // company, contacts or executives partially updated.
    if (Object.keys(dossierUpdate).length > 0) {
      try {
        profile = await profileRepo.updateDossier(actor.id, dossierUpdate)
      } catch (error) {
        if (error instanceof DossierValidationError) {
          res.status(400).json({ error: error.code })
          return
        }
        throw error
      }
    }
    if (company && typeof company === 'object') {
      profile = await profileRepo.updateBasicInfo(actor.id, company)
    }
    if (contacts && typeof contacts === 'object') {
      profile = await profileRepo.updateContactInfo(actor.id, contacts)
    }
    if (Array.isArray(req.body?.executives)) {
      profile = await profileRepo.updateExecutives(actor.id, req.body.executives)
    }
    res.json(profile)
    } catch (error) { next(error) }
  })

  router.get('/profile/dossier', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const dossier = dossierOfCompany(company)
      const documents = await dossierDocuments.listCompanyDocuments(company.id)
      const currentVerif = await verificationStore.findCurrentByCompanyId(company.id)
      res.json({
        dossier,
        documents,
        missing: missingDossierItems(company, dossier, documents),
        verification: currentVerif
          ? {
              id: currentVerif.id,
              status: currentVerif.status,
              revision: currentVerif.revision,
              submittedAt: currentVerif.submittedAt,
              decidedAt: currentVerif.decidedAt,
              reviewerId: currentVerif.reviewerId,
              reason: currentVerif.reason,
            }
          : { status: 'unsubmitted', revision: 0 },
      })
    } catch (error) { next(error) }
  })

  router.patch('/profile/dossier', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const currentProfile = await profileRepo.getProfile(actor.id)
    let update
    try {
      update = pickDossierUpdate(req.body?.dossier ?? req.body)
      mergeDossier(currentProfile.dossier, update)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
    }
    let identityChanged = false
    if (
      update.legalEntityType !== undefined &&
      update.legalEntityType !== currentProfile.dossier.legalEntityType
    ) {
      identityChanged = true
    }
    if (identityChanged && currentProfile.companyId) {
      await verificationStore.invalidateApproval(
        currentProfile.companyId,
        'تغییر اطلاعات هویتی؛ نیازمند احراز مجدد',
      )
    }
    let profile
    try {
      profile = await profileRepo.updateDossier(actor.id, update)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
    }
    const company = await deps.companyStore.findByRepresentative(actor.id)
    if (!company) {
      res.status(404).json({ error: 'company_not_found' })
      return
    }
    const documents = await dossierDocuments.listCompanyDocuments(company.id)
    res.json({
      dossier: profile.dossier,
      documents,
      missing: missingDossierItems(company, profile.dossier, documents),
    })
    } catch (error) { next(error) }
  })

  router.post('/profile/verification/invalidate', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() !== ''
        ? req.body.reason.trim()
        : 'درخواست احراز مجدد'
      const invalidated = await verificationStore.invalidateApproval(company.id, reason)
      res.json({ invalidated })
    } catch (error) { next(error) }
  })

  router.post('/profile/addresses', async (req, res) => {
    const actor = actorOf(res)
    const { title, province, city, postalCode, address } = req.body ?? {}
    if (!title || !address) {
      res.status(400).json({ error: 'invalid_address' })
      return
    }
    const created = await profileRepo.addAddress(actor.id, {
      title: String(title),
      province: String(province ?? ''),
      city: String(city ?? ''),
      postalCode: String(postalCode ?? ''),
      address: String(address),
    })
    res.status(201).json({ address: created })
  })

  router.put('/profile/addresses/:id', async (req, res) => {
    const actor = actorOf(res)
    const { title, province, city, postalCode, address } = req.body ?? {}
    const updated = await profileRepo.updateAddress(actor.id, req.params.id, {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(province !== undefined ? { province: String(province) } : {}),
      ...(city !== undefined ? { city: String(city) } : {}),
      ...(postalCode !== undefined ? { postalCode: String(postalCode) } : {}),
      ...(address !== undefined ? { address: String(address) } : {}),
    })
    if (!updated) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ address: updated })
  })

  router.delete('/profile/addresses/:id', async (req, res) => {
    const actor = actorOf(res)
    const success = await profileRepo.deleteAddress(actor.id, req.params.id)
    if (!success) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ success: true })
  })

  router.delete('/letters/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const deleted = await letters.deleteScoped(req.params.id, scope)
    if (!deleted) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ success: true })
    } catch (error) { next(error) }
  })

  router.get('/profile/verification', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const current = await verificationStore.findCurrentByCompanyId(company.id)
      const history = await verificationStore.listHistory(company.id)
      const dossier = dossierOfCompany(company)
      const documents = await dossierDocuments.listCompanyDocuments(company.id)
      const missing = missingDossierItems(company, dossier, documents)
      const canRequestVerification =
        missing.canRequestVerification &&
        current?.status !== 'pending' &&
        current?.status !== 'approved'
      res.json({
        status: current?.status ?? 'unsubmitted',
        revision: current?.revision ?? 0,
        submittedAt: current?.submittedAt ?? null,
        decidedAt: current?.decidedAt ?? null,
        reviewerId: current?.reviewerId ?? null,
        reason: current?.reason ?? null,
        canRequestVerification,
        history,
      })
    } catch (error) { next(error) }
  })

  const submitVerification = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const dossier = dossierOfCompany(company)
      const documents = await dossierDocuments.listCompanyDocuments(company.id)
      const missing = missingDossierItems(company, dossier, documents)
      if (!missing.canRequestVerification) {
        res.status(400).json({ error: 'incomplete_dossier', missing: missing.required })
        return
      }
      const profile = await profileRepo.getProfile(actor.id)
      const snapshot = {
        company: { ...profile.company, province: company.province ?? '', city: company.city ?? '' },
        dossier: profile.dossier,
        addresses: profile.addresses,
        executives: profile.executives,
        documents: documents.map((doc) => ({
          id: doc.id,
          category: doc.category,
          filename: doc.filename,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
        })),
        representative: {
          id: actor.id,
          name: actor.user.name ?? null,
          phone: actor.user.phone,
          email: actor.user.email ?? null,
        },
      }
      const result = await verificationStore.submit({
        companyId: company.id,
        representativeId: actor.id,
        snapshot,
      })
      if (!result.ok) {
        if (result.reason === 'already_submitted') {
          res.status(409).json({ error: 'already_submitted' })
          return
        }
        res.status(409).json({ error: 'already_approved' })
        return
      }
      res.status(201).json({ verification: result.verification })
    } catch (error) { next(error) }
  }

  router.post('/profile/verification/submit', submitVerification)
  router.post('/profile/verification', submitVerification)

  router.get('/admin/companies', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const users = await deps.userStore.list({
        role: 'representative',
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      })
      const requestedStatus =
        typeof req.query.verificationStatus === 'string'
          ? req.query.verificationStatus
          : typeof req.query.status === 'string'
            ? req.query.status
            : undefined

      const allItems = await Promise.all(users.map(async (user) => {
        const company = await deps.companyStore.findByRepresentative(user.id).catch(() => undefined)
        const currentVerif = company ? await verificationStore.findCurrentByCompanyId(company.id) : null
        return {
          id: user.id,
          companyId: company?.id ?? null,
          name: user.name ?? null,
          phone: user.phone,
          companyName: company?.name ?? null,
          companyType: company?.type ?? null,
          companyProvince: company?.province ?? null,
          companyCity: company?.city ?? null,
          companyEstablishmentDate: company?.establishmentDate ?? null,
          executives: company?.executives ?? [],
          verificationStatus: currentVerif?.status ?? 'unsubmitted',
          verificationRevision: currentVerif?.revision ?? 0,
        }
      }))
      const items = requestedStatus && requestedStatus !== 'all'
        ? allItems.filter((item) => item.verificationStatus === requestedStatus)
        : allItems
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/admin/companies/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const target = await deps.userStore.findById(req.params.id).catch(() => undefined)
      if (!target || operationalRoleOf(target) !== 'representative') {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const profile = await profileRepo.getProfile(target.id)
      const currentVerif = profile.companyId
        ? await verificationStore.findCurrentByCompanyId(profile.companyId)
        : null
      const allowedActions = currentVerif?.status === 'pending' && target.id !== actor.id && currentVerif.representativeId !== actor.id
        ? ['read', 'approve', 'return', 'reject']
        : ['read']

      res.json({
        representative: {
          id: target.id,
          name: target.name ?? null,
          phone: target.phone,
          email: target.email ?? null,
          position: target.position ?? null,
        },
        companyId: profile.companyId,
        company: profile.company,
        executives: profile.executives,
        addresses: profile.addresses,
        allowedActions,
        verification: currentVerif
          ? {
              id: currentVerif.id,
              status: currentVerif.status,
              revision: currentVerif.revision,
              submittedAt: currentVerif.submittedAt,
              decidedAt: currentVerif.decidedAt,
              reviewerId: currentVerif.reviewerId,
              reason: currentVerif.reason,
            }
          : { status: 'unsubmitted', revision: 0 },
      })
    } catch (error) { next(error) }
  })

  router.get(['/admin/verifications', '/admin/verifications/queue'], async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      const search = typeof req.query.search === 'string' ? req.query.search : undefined
      const items = await verificationStore.listQueue({ status, search })
      res.json({ items, total: items.length })
    } catch (error) { next(error) }
  })

  router.get('/admin/verifications/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const targetId = req.params.id
      if (!targetId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      let verification = await verificationStore.findById(targetId)
      if (!verification) {
        verification = await verificationStore.findCurrentByCompanyId(targetId)
      }
      if (!verification) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const history = await verificationStore.listHistory(verification.companyId)
      const company = await deps.companyStore.findById(verification.companyId)
      const allowedActions = verification.status === 'pending' && verification.representativeId !== actor.id && company?.representativeId !== actor.id
        ? ['read', 'approve', 'return', 'reject']
        : ['read']
      res.json({
        verification,
        history,
        allowedActions,
      })
    } catch (error) { next(error) }
  })

  const handleVerificationDecision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { action, reason, expectedRevision } = req.body ?? {}
      if (action !== 'approve' && action !== 'return' && action !== 'reject') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      if ((action === 'return' || action === 'reject') && (!reason || typeof reason !== 'string' || !reason.trim())) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }

      const targetId = req.params.id
      if (!targetId) {
        res.status(404).json({ error: 'not_found' })
        return
      }

      let verification
      if (req.route.path === '/admin/companies/:id/verification/decision') {
        // Company detail URLs use the representative ID, not the CMS company ID.
        const target = await deps.userStore.findById(targetId)
        const company = target && operationalRoleOf(target) === 'representative'
          ? await deps.companyStore.findByRepresentative(target.id)
          : undefined
        verification = company ? await verificationStore.findCurrentByCompanyId(company.id) : null
      } else {
        verification = await verificationStore.findById(targetId)
      }
      if (!verification) {
        res.status(404).json({ error: 'not_found' })
        return
      }

      // Prohibit self-approval: representative cannot approve their own company even if they hold admin/secretariat role
      const company = await deps.companyStore.findById(verification.companyId)
      if (verification.representativeId === actor.id || company?.representativeId === actor.id) {
        res.status(403).json({ error: 'self_approval_prohibited' })
        return
      }

      const result = await verificationStore.decide({
        id: verification.id,
        companyId: verification.companyId,
        action,
        reviewerId: actor.id,
        reason: typeof reason === 'string' ? reason.trim() : null,
        expectedRevision: expectedRevision ?? verification.revision,
      })
      if (!result.ok) {
        if (result.reason === 'not_found') {
          res.status(404).json({ error: 'not_found' })
          return
        }
        if (result.reason === 'not_pending') {
          res.status(409).json({ error: 'invalid_verification_state' })
          return
        }
        res.status(409).json({ error: 'stale_revision' })
        return
      }
      res.json({ verification: result.verification })
    } catch (error) { next(error) }
  }

  router.post('/admin/verifications/:id/decision', handleVerificationDecision)
  router.post('/admin/companies/:id/verification/decision', handleVerificationDecision)

  router.get('/admin/employees', async (req, res) => {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const users = await deps.userStore.list({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    })
    const items = users.flatMap((user) => {
      const role = operationalRoleOf(user)
      if (!role || role === 'representative') return []
      return [{
        id: user.id,
        name: user.name ?? null,
        operationalRole: role,
        isActive: user.isActive === true,
      }]
    })
    res.json({ items })
  })

  router.get('/admin/letters', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const result = await letters.listAll({ page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25), recipientId: typeof req.query.recipientId === 'string' ? req.query.recipientId : undefined })
    res.json({ ...result, items: await Promise.all(result.items.map((letter) => presentLetter(letter, actor.id, actor.operationalRole))) })
    } catch (error) { next(error) }
  })

  router.get('/admin/letters/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const letter = await letters.findByIdAndMarkReadScoped(req.params.id, { kind: 'all' }, actor.id)
    if (!letter) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ letter: await presentLetter(letter, actor.id, actor.operationalRole) })
    } catch (error) { next(error) }
  })

  const sendLetter = async (req: Request, res: Response, next: NextFunction) => {
    try {
    const actor = actorOf(res)
    const { title, body, recipientId, type, requestId, attachmentIds, attachments: rawAttachments } = req.body ?? {}
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    const trimmedBody = typeof body === 'string' ? body.trim() : ''
    const trimmedRecipientId = typeof recipientId === 'string' ? recipientId.trim() : ''
    if (!trimmedTitle || !trimmedBody || !trimmedRecipientId) { res.status(400).json({ error: 'invalid_letter' }); return }
    if (requestId !== undefined && (typeof requestId !== 'string' || !isUuid(requestId))) { res.status(400).json({ error: 'invalid_request_id' }); return }
    const recipient = await deps.userStore.findById(trimmedRecipientId)
    const recipientRole = operationalRoleOf(recipient)
    if (!recipientRole || !canSendLetter(actor.operationalRole, recipientRole, Boolean(requestId))) { res.status(403).json({ error: 'forbidden' }); return }

    const incomingAttachmentIds: string[] = []
    if (attachmentIds !== undefined) {
      if (!Array.isArray(attachmentIds) || !attachmentIds.every((item) => typeof item === 'string' && isUuid(item))) {
        res.status(400).json({ error: 'invalid_attachment' })
        return
      }
      for (const item of attachmentIds) {
        incomingAttachmentIds.push(item)
      }
    }
    if (rawAttachments !== undefined) {
      if (!Array.isArray(rawAttachments)) {
        res.status(400).json({ error: 'invalid_attachment' })
        return
      }
      for (const item of rawAttachments) {
        const id = typeof item === 'string' ? item : item && typeof item === 'object' ? item.id : undefined
        if (typeof id !== 'string' || !isUuid(id)) {
          res.status(400).json({ error: 'invalid_attachment' })
          return
        }
        incomingAttachmentIds.push(id)
      }
    }

    const resolvedAttachments: LetterAttachmentDto[] = []
    if (incomingAttachmentIds.length > 0) {
      const documentsRepo = new DocumentRepository(deps.pool)
      for (const attId of new Set(incomingAttachmentIds)) {
        const doc = await documentsRepo.findById(attId)
        if (!doc) {
          res.status(404).json({ error: 'attachment_not_found' })
          return
        }
        if (!(await attachmentMatchesLetter(doc, requestId ?? null)) ||
            !(await canReadAttachment(doc, actor.id, actor.operationalRole)) ||
            !(await canReadAttachment(doc, trimmedRecipientId, recipientRole))) {
          res.status(403).json({ error: 'forbidden' })
          return
        }
        resolvedAttachments.push(attachmentDto(doc))
      }
    }

    const letterType = isCompanyAdministrator(actor.operationalRole) && (type === 'approved' || type === 'needs_fix' || type === 'rejected' || type === 'notification') ? type : 'official'
    const input: CreateLetterInput = { type: letterType, title: trimmedTitle, body: trimmedBody, recipientId: trimmedRecipientId,
      senderId: actor.id, senderName: actor.user.name ?? null, senderRole: actor.operationalRole, requestId: requestId ?? null,
      attachments: resolvedAttachments }
    let letter
    if (requestId) {
      const senderScope = await resolveScope(actor.id, actor.operationalRole)
      const recipientScope = await resolveScope(trimmedRecipientId, recipientRole)
      letter = await letters.createScoped(input, senderScope.scope, recipientScope.scope,
        actor.operationalRole === 'reviewer' || actor.operationalRole === 'employer-reviewer')
      if (!letter) { res.status(403).json({ error: 'forbidden' }); return }
    } else {
      letter = await letters.create(input)
    }
    res.status(201).json({ letter })
    } catch (error) { next(error) }
  }
  router.post('/letters', sendLetter)
  router.post('/admin/letters', (req, res, next) => {
    if (!isCompanyAdministrator(actorOf(res).operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    void sendLetter(req, res, next)
  })

  router.get('/letters/:letterId/attachments/:attachmentId/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(res)
      const letterId = String(req.params.letterId ?? '')
      const attachmentId = String(req.params.attachmentId ?? '')
      if (!isUuid(letterId) || !isUuid(attachmentId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const letter = await letters.findByIdScoped(letterId, scope)
      if (!letter) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const att = Array.isArray(letter.attachments)
        ? letter.attachments.find((value) => value && typeof value === 'object' && (value as { id?: unknown }).id === attachmentId)
        : undefined
      if (!att) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const documentsRepo = new DocumentRepository(deps.pool)
      const doc = await documentsRepo.findById(attachmentId)
      if (!doc || !(await attachmentMatchesLetter(doc, letter.requestId)) || !(await canReadAttachment(doc, actor.id, actor.operationalRole))) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const body = await deps.privateDocumentStorage.read(doc.storageKey)
      if (!body) {
        res.status(410).json({ error: 'document_unavailable' })
        return
      }
      const fallback = doc.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
      res.setHeader('Content-Type', doc.mimeType)
      res.setHeader('Content-Length', String(body.length))
      res.setHeader('Content-Disposition', `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
      res.status(200).send(body)
    } catch (error) { next(error) }
  })

  router.get('/admin/notifications/jobs', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const status = typeof req.query.status === 'string' ? (req.query.status as any) : undefined
      const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : undefined
      const recipientId = typeof req.query.recipientId === 'string' ? req.query.recipientId : undefined
      const page = parsePositiveInt(req.query.page, 1)
      const limit = parsePositiveInt(req.query.limit, 25)
      res.json(await notificationOutbox.list({ status, requestId, recipientId, page, limit }))
    } catch (error) { next(error) }
  })

  router.post('/admin/notifications/jobs/:id/retry', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const result = await notificationOutbox.retry(req.params.id)
      res.json({ result })
    } catch (error) { next(error) }
  })

  router.post('/admin/notifications/retry-all', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const results = await notificationOutbox.retryAllUndelivered()
      res.json({ results })
    } catch (error) { next(error) }
  })

  router.post('/admin/notifications/simulate-failure', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const enabled = Boolean(req.body?.enabled)
      notificationOutbox.setSimulationFailure(enabled)
      res.json({ simulationFailure: notificationOutbox.isSimulationFailure() })
    } catch (error) { next(error) }
  })

  router.get('/support', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const result = isCompanyAdministrator(actor.operationalRole)
      ? await support.list({ page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25), status: typeof req.query.status === 'string' ? req.query.status : undefined })
      : await support.list({ requesterId: actor.id, page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25) })
    const requesterNames = await resolveRequesterNames(deps.userStore, result.items.map((ticket) => ticket.requesterId))
    const items = result.items.map((ticket) => ({ ...ticket, requesterName: requesterNames.get(ticket.requesterId) ?? 'شرکت متقاضی' }))
    res.json({ ...result, items })
  })

  router.post('/support', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole)) { res.status(403).json({ error: 'representative_only' }); return }
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : ''
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!subject || !message) { res.status(400).json({ error: 'invalid_ticket' }); return }
    res.status(201).json({ ticket: await support.create({ requesterId: actor.id, subject, message }) })
  })

  router.get('/support/:id', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const ticket = await support.findById(req.params.id)
    if (!ticket || (!isCompanyAdministrator(actor.operationalRole) && ticket.requesterId !== actor.id)) { res.status(404).json({ error: 'not_found' }); return }
    const requesterNames = await resolveRequesterNames(deps.userStore, [ticket.requesterId])
    res.json({ ticket: { ...ticket, requesterName: requesterNames.get(ticket.requesterId) ?? 'شرکت متقاضی' } })
  })

  router.post('/support/:id/respond', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (!body) { res.status(400).json({ error: 'invalid_response' }); return }
    const existing = await support.findById(req.params.id)
    if (!existing || (!isCompanyAdministrator(actor.operationalRole) && existing.requesterId !== actor.id)) { res.status(404).json({ error: 'not_found' }); return }
    const authorRole = isCompanyAdministrator(actor.operationalRole) ? 'admin' : 'representative'
    const ticket = await support.respond(req.params.id, actor.id, authorRole, body)
    if (!ticket) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ ticket })
  })

  router.post('/support/:id/close', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const existing = await support.findById(req.params.id)
    if (!existing || (!isCompanyAdministrator(actor.operationalRole) && existing.requesterId !== actor.id)) { res.status(404).json({ error: 'not_found' }); return }
    const ticket = await support.close(req.params.id, actor.id, isCompanyAdministrator(actor.operationalRole) ? 'admin' : 'representative')
    if (!ticket) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ ticket })
  })

  router.get('/exhibitions/:exhibitionId/catalogue', async (req, res, next) => {
    try {
    const [settings, booths] = await Promise.all([
      catalogue.getSettings(req.params.exhibitionId),
      catalogue.listBooths(req.params.exhibitionId),
    ])
    res.json({
      exhibitionId: req.params.exhibitionId,
      companyBoothLimit: settings?.companyBoothLimit ?? null,
      guideMapReference: settings?.guideMapReference ?? null,
      booths,
    })
    } catch (error) { next(error) }
  })

  router.get('/admin/exhibitions/:exhibitionId/catalogue', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const [settings, booths] = await Promise.all([
      catalogue.getSettings(req.params.exhibitionId),
      catalogue.listBooths(req.params.exhibitionId, { includeInactive: true }),
    ])
    res.json({
      exhibitionId: req.params.exhibitionId,
      companyBoothLimit: settings?.companyBoothLimit ?? null,
      guideMapReference: settings?.guideMapReference ?? null,
      booths,
    })
    } catch (error) { next(error) }
  })

  router.put('/admin/exhibitions/:exhibitionId/settings', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const parsed = parseSettingsInput(req.body)
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const exhibition = await checkExhibition(req.params.exhibitionId)
    if (!exhibition.ok) {
      res.status(503).json({ error: 'exhibition_lookup_failed' })
      return
    }
    if (!exhibition.exists) {
      res.status(404).json({ error: 'exhibition_not_found' })
      return
    }
    const settings = await catalogue.upsertSettings(
      req.params.exhibitionId,
      parsed.value,
      actor.id,
    )
    res.json({ settings })
    } catch (error) { next(error) }
  })

  router.post('/admin/exhibitions/:exhibitionId/booths', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const parsed = parseBoothCreate(req.body)
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const exhibition = await checkExhibition(req.params.exhibitionId)
    if (!exhibition.ok) {
      res.status(503).json({ error: 'exhibition_lookup_failed' })
      return
    }
    if (!exhibition.exists) {
      res.status(404).json({ error: 'exhibition_not_found' })
      return
    }
    const result = await catalogue.createBooth({
      ...parsed.value,
      exhibitionId: req.params.exhibitionId,
      createdBy: actor.id,
    })
    if (!result.ok) {
      res.status(409).json({ error: result.error })
      return
    }
    res.status(201).json({ booth: result.booth })
    } catch (error) { next(error) }
  })

  router.patch('/admin/exhibitions/:exhibitionId/booths/:boothId', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    if (!isUuid(req.params.boothId)) {
      res.status(400).json({ error: 'invalid_booth_id' })
      return
    }
    const parsed = parseBoothUpdate(req.body)
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const result = await catalogue.updateBooth({
      ...parsed.value,
      exhibitionId: req.params.exhibitionId,
      boothId: req.params.boothId,
      updatedBy: actor.id,
    })
    if (!result.ok) {
      res.status(result.error === 'booth_not_found' ? 404 : 409).json({ error: result.error })
      return
    }
    res.json({ booth: result.booth })
    } catch (error) { next(error) }
  })

  router.post('/exhibitions/:exhibitionId/booths/:boothId/reserve', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const eligibility = deps.boothCompanyEligibility ?? verificationStore
      if (!await eligibility.isVerified(company.id)) {
        res.status(403).json({ error: 'company_not_verified' })
        return
      }
      if (!isUuid(req.params.boothId)) {
        res.status(404).json({ error: 'booth_not_found' })
        return
      }
      const exhibition = await checkExhibition(req.params.exhibitionId)
      if (!exhibition.ok) {
        res.status(503).json({ error: 'exhibition_lookup_failed' })
        return
      }
      if (!exhibition.exists) {
        res.status(404).json({ error: 'exhibition_not_found' })
        return
      }
      const result = await boothReservations.reserve({
        exhibitionId: req.params.exhibitionId,
        boothId: req.params.boothId,
        companyId: company.id,
        actorId: actor.id,
        requireVerification: true,
      })
      if (!result.ok) {
        if (result.error === 'company_not_verified') {
          res.status(403).json({ error: result.error })
          return
        }
        if (result.error === 'catalogue_not_configured') {
          res.status(400).json({ error: result.error })
          return
        }
        res.status(409).json({ error: result.error })
        return
      }
      res.status(201).json({ reservation: result.reservation })
    } catch (error) { next(error) }
  })

  const getMyReservations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const items = await boothReservations.listByCompany(company.id, req.params.exhibitionId, actor.operationalRole)
      res.json({ items })
    } catch (error) { next(error) }
  }
  router.get('/exhibitions/:exhibitionId/my-reservations', getMyReservations)
  router.get('/exhibitions/:exhibitionId/reservations/me', getMyReservations)

  router.get('/exhibitions/:exhibitionId/reservations/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole) && actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (isCompanyAdministrator(actor.operationalRole)) {
        res.json({ reservation })
        return
      }
      if (actor.operationalRole === 'representative') {
        const company = await deps.companyStore.findByRepresentative(actor.id)
        if (company && reservation.companyId === company.id) {
          res.json({ reservation })
          return
        }
      }
      res.status(403).json({ error: 'forbidden' })
    } catch (error) { next(error) }
  })

  router.get('/admin/exhibitions/:exhibitionId/reservations', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined
      const status = statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected'
        ? statusParam
        : 'all'
      const items = await boothReservations.listByExhibition(req.params.exhibitionId, { status }, actor.operationalRole)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/admin/exhibitions/:exhibitionId/reservations/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const history = await boothReservations.listDecisionsHistory(reservation.id)
      res.json({ reservation, history })
    } catch (error) { next(error) }
  })

  router.post('/admin/exhibitions/:exhibitionId/reservations/:id/attendance', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const action = req.body?.action
      if (action !== 'approve' && action !== 'reject') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null
      if (action === 'reject' && !reason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const result = await boothReservations.decideAttendance({
        id: reservation.id,
        action,
        reason,
        actorId: actor.id,
      })
      if (!result.ok) {
        if (result.error === 'not_found') {
          res.status(404).json({ error: 'not_found' })
          return
        }
        if (result.error === 'reason_required') {
          res.status(400).json({ error: 'reason_required' })
          return
        }
        res.status(409).json({ error: result.error })
        return
      }
      res.json({ reservation: result.reservation })
    } catch (error) { next(error) }
  })

  router.post('/exhibitions/:exhibitionId/reservations/:id/receipt', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (reservation.companyId !== company.id) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const eligibility = await boothReservations.canSubmitReceipt(reservation.id, company.id)
      if (!eligibility.ok) {
        const status = eligibility.error === 'not_found' ? 404
          : eligibility.error === 'reservation_inactive' ? 409 : 403
        res.status(status).json({
          error: eligibility.error,
          ...(eligibility.attendanceStatus ? { attendanceStatus: eligibility.attendanceStatus } : {}),
        })
        return
      }
      // T50 owns document validation, persistence and receipt versions. Never
      // acknowledge a successful upload when no file has been stored.
      res.status(501).json({ error: 'receipt_upload_not_implemented' })
    } catch (error) { next(error) }
  })

  return router
}
