import { Router } from 'express'
import type { Pool } from 'pg'

import {
  allowedEventActions,
  canActOnEvent,
  canManageEvents,
} from '../access/events.js'
import {
  allowedRequestActions,
  bindRequestScope,
  canRequestAction,
  requestScopeFor,
} from '../access/policy.js'
import {
  isCaseAssignmentRole,
  isInternalOperationalRole,
  isOperationalRole,
  operationalRoleOf,
  type CaseAssignmentRole,
} from '../access/roles.js'
import type { ServiceCatalog, ServiceDefinition } from '../catalog/service-catalog.js'
import { ActivityRepository } from './activity-repo.js'
import { AssignmentRepository } from './assignment-repo.js'
import {
  DossierValidationError,
  dossierOfCompany,
  missingDossierItems,
  pickDossierUpdate,
  SqlDossierDocumentSource,
  type DossierDocumentSource,
} from './dossier.js'
import {
  EventRepository,
  isEventId,
  type EventConfiguration,
  type EventInput,
  type EventStore,
} from './event-repo.js'
import { LetterRepository } from './letter-repo.js'
import { ProfileRepository } from './profile-repo.js'
import { actorOf, requireProxyAuth } from './proxy-auth.js'
import { RequestRepository } from './request-repo.js'
import { StatsRepository } from './stats-repo.js'
import type { CompanyStore } from '../auth/company-store.js'
import type { User, UserStore } from '../auth/user-store.js'
import { SupportRepository } from './support-repo.js'
import { createDocumentRouter } from '../documents/router.js'
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
import type { ExhibitionStore } from '../exhibitions/exhibition-store.js'

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
  boothCatalogue?: BoothCatalogueRepository
  exhibitionStore?: ExhibitionStore
}

const dashboardRoles = {
  'system-owner': {
    label: 'صاحب سیستم',
    responsibilities: ['مدیریت دسترسی‌های سامانه', 'پیگیری همه درخواست‌ها و نامه‌ها'],
    destinations: ['/dashboard', '/dashboard/companies', '/dashboard/employees', '/dashboard/requests', '/dashboard/letters', '/dashboard/profile'],
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

function requestWithActions(
  role: Parameters<typeof allowedRequestActions>[0],
  actorId: string,
  request: Awaited<ReturnType<RequestRepository['findByIdAny']>>,
) {
  if (!request) return request
  return {
    ...request,
    allowedActions: allowedRequestActions(role, request, actorId),
  }
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
  const repo = new RequestRepository(deps.pool)
  const letters = new LetterRepository(deps.pool)
  const activities = new ActivityRepository(deps.pool)
  const stats = new StatsRepository(deps.pool)
  const profileRepo = new ProfileRepository(deps.userStore, deps.companyStore)
  const dossierDocuments = deps.dossierDocuments ?? new SqlDossierDocumentSource(deps.pool)
  const support = new SupportRepository(deps.pool)
  const assignments = new AssignmentRepository(deps.pool)
  const eventStore = deps.eventStore ?? new EventRepository(deps.pool)
  const catalogue =
    deps.boothCatalogue ?? new PostgresBoothCatalogueRepository(deps.pool)

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

  router.use(requireProxyAuth(deps.proxySecret, deps.userStore))
  router.use(createDocumentRouter({ ...deps }))

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

  router.post('/requests', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole)) {
      res.status(403).json({ error: 'representative_only' })
      return
    }
    const { serviceId, title, answers } = req.body ?? {}

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

    const request = await repo.create({
      serviceId,
      serviceKey: service.key,
      serviceName: service.title,
      title,
      ownerId: actor.id,
      answers: answersValue as Record<string, unknown>,
    })
    res.status(201).json({ request: requestWithActions(actor.operationalRole, actor.id, request) })
  })

  router.get('/requests', async (req, res) => {
    const actor = actorOf(res)
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const result = await repo.listScoped(scope, { status, page, limit })
    res.json({
      ...result,
      items: result.items.map((item) => requestWithActions(actor.operationalRole, actor.id, item)),
    })
  })

  router.get('/admin/requests', async (req, res) => {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const result = await repo.listScoped(scope, {
      status,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 25),
    })
    const items = await Promise.all(
      result.items.map(async (item) => ({
        ...requestWithActions(actor.operationalRole, actor.id, item),
        owner: safeOwner(await deps.userStore.findById(item.ownerId)),
      })),
    )
    res.json({ ...result, items })
  })

  router.get('/admin/requests/:id', async (req, res) => {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    const service = await deps.serviceCatalog.findById(request.serviceId)
    res.json({
      request: requestWithActions(actor.operationalRole, actor.id, request),
      owner: safeOwner(await deps.userStore.findById(request.ownerId)),
      timeline: await activities.listForRequestScoped(request.id, scope),
      workflow: service?.workflow ?? [],
    })
  })

  router.get('/requests/:id', async (req, res) => {
    const actor = actorOf(res)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const service = await deps.serviceCatalog.findById(request.serviceId)
    const timeline = await activities.listForRequestScoped(request.id, scope)
    res.json({
      request: requestWithActions(actor.operationalRole, actor.id, request),
      timeline,
      workflow: service?.workflow ?? [],
      owner: safeOwner(await deps.userStore.findById(request.ownerId)),
    })
  })

  router.get('/requests/:id/history', async (req, res) => {
    const actor = actorOf(res)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ items: await activities.listForRequestScoped(request.id, scope) })
  })

  router.post('/requests/:id/submit', async (req, res) => {
    const actor = actorOf(res)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    // A representative retrying an already-submitted request gets the stable
    // conflict response even though `allowedActions` no longer advertises
    // `submit`. Other roles are denied by the shared action policy.
    if (
      actor.operationalRole === 'representative' &&
      request.ownerId === actor.id &&
      request.status !== 'draft'
    ) {
      res.status(409).json({ error: 'already_submitted' })
      return
    }
    if (!canRequestAction(actor.operationalRole, request, actor.id, 'submit')) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    // Validate answers against the service's form schema (required fields present).
    const service = await deps.serviceCatalog.findById(request.serviceId)
    if (service) {
      const missing = missingRequiredFields(service, request.answers)
      if (missing) {
        res.status(400).json({ error: 'invalid_answers', missingFields: missing })
        return
      }
    }

    const firstStep = service?.workflow[0]
    const result = await repo.submit(
      req.params.id,
      actor.id,
      firstStep ? { assignedRole: firstStep.roleName, currentStep: firstStep.title } : undefined,
    )
    if (result === 'not_found') {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (result === 'already_submitted') {
      res.status(409).json({ error: 'already_submitted' })
      return
    }
    res.json({ request: requestWithActions(actor.operationalRole, actor.id, result) })
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
      res.status(409).json({ error: 'already_assigned' })
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

  router.get('/letters', async (req, res) => {
    const actor = actorOf(res)
    const read = parseBoolean(req.query.read)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    res.json(await letters.listScoped(scope, { read, page, limit }))
  })

  router.get('/letters/:id', async (req, res) => {
    const actor = actorOf(res)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const letter = await letters.findByIdAndMarkReadScoped(req.params.id, scope)
    if (!letter) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ letter })
  })

  router.get('/stats', async (_req, res) => {
    const actor = actorOf(res)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    res.json(await stats.forScope(scope))
  })

  router.get('/activities', async (req, res) => {
    const actor = actorOf(res)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    res.json(await activities.listScoped(scope, page, limit))
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

  router.patch('/profile', async (req, res) => {
    const actor = actorOf(res)
    const { company, contacts } = req.body ?? {}
    let profile = await profileRepo.getProfile(actor.id)
    if (company?.nationalId !== undefined && company.nationalId !== profile.company.nationalId) {
      res.status(403).json({ error: 'protected_company_identity' })
      return
    }
    let dossierUpdate
    try {
      dossierUpdate = pickDossierUpdate(req.body?.dossier ?? req.body)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
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
  })

  router.get('/profile/dossier', async (_req, res) => {
    const actor = actorOf(res)
    const company = await deps.companyStore.findByRepresentative(actor.id)
    if (!company) {
      res.status(404).json({ error: 'company_not_found' })
      return
    }
    const dossier = dossierOfCompany(company)
    const documents = await dossierDocuments.listCompanyDocuments(company.id)
    res.json({ dossier, documents, missing: missingDossierItems(company, dossier, documents) })
  })

  router.patch('/profile/dossier', async (req, res) => {
    const actor = actorOf(res)
    let update
    try {
      update = pickDossierUpdate(req.body?.dossier ?? req.body)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
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

  router.delete('/letters/:id', async (req, res) => {
    const actor = actorOf(res)
    const scope = bindRequestScope(requestScopeFor(actor.operationalRole), actor.id)
    const deleted = await letters.deleteScoped(req.params.id, scope)
    if (!deleted) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ success: true })
  })

  router.get('/admin/companies', async (req, res) => {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const users = await deps.userStore.list({
      role: 'representative',
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    })
    const items = await Promise.all(users.map(async (user) => {
      const company = await deps.companyStore.findByRepresentative(user.id).catch(() => undefined)
      return {
        id: user.id,
        name: user.name ?? null,
        phone: user.phone,
        companyName: company?.name ?? null,
        companyType: company?.type ?? null,
        companyProvince: company?.province ?? null,
        companyCity: company?.city ?? null,
        companyEstablishmentDate: company?.establishmentDate ?? null,
        executives: company?.executives ?? [],
      }
    }))
    res.json({ items })
  })

  router.get('/admin/companies/:id', async (req, res) => {
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
    // Explicit projection: no credential, session, API-key or personnel-history
    // fields from the privileged identity adapter reach the dashboard.
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
      allowedActions: ['read'],
    })
  })

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

  router.get('/admin/letters', async (req, res) => {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    res.json(await letters.listAll({ page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25), recipientId: typeof req.query.recipientId === 'string' ? req.query.recipientId : undefined }))
  })

  router.get('/admin/letters/:id', async (req, res) => {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const letter = await letters.findById(req.params.id)
    if (!letter) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ letter })
  })

  router.post('/admin/letters', async (req, res) => {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const { title, body, recipientId, type } = req.body ?? {}
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    const trimmedBody = typeof body === 'string' ? body.trim() : ''
    const trimmedRecipientId = typeof recipientId === 'string' ? recipientId.trim() : ''
    if (!trimmedTitle || !trimmedBody || !trimmedRecipientId) { res.status(400).json({ error: 'invalid_letter' }); return }
    const recipient = await deps.userStore.findById(trimmedRecipientId)
    if (!recipient || operationalRoleOf(recipient) !== 'representative') { res.status(404).json({ error: 'recipient_not_found' }); return }
    const letterType = type === 'approved' || type === 'needs_fix' || type === 'rejected' || type === 'notification' ? type : 'official'
    res.status(201).json({ letter: await letters.create({ type: letterType, title: trimmedTitle, body: trimmedBody, recipientId: trimmedRecipientId, senderId: actor.id, senderRole: actor.operationalRole }) })
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

  return router
}
