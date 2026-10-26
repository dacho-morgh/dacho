import { Router } from 'express'
import type { Pool } from 'pg'

import {
  allowedRequestActions,
  bindRequestScope,
  canRequestAction,
  requestScopeFor,
  type RequestScope,
} from '../access/policy.js'
import {
  isCaseAssignmentRole,
  isInternalOperationalRole,
  operationalRoleOf,
  type CaseAssignmentRole,
  type OperationalRole,
} from '../access/roles.js'
import type { ServiceCatalog, ServiceDefinition } from '../catalog/service-catalog.js'
import { ActivityRepository } from './activity-repo.js'
import { AssignmentRepository } from './assignment-repo.js'
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

export interface DashboardDeps {
  pool: Pool
  serviceCatalog: ServiceCatalog
  proxySecret: string
  userStore: UserStore
  companyStore: CompanyStore
  privateDocumentStorage: PrivateDocumentStorage
}

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
  companyId?: string | null,
) {
  if (!request) return request
  return {
    ...request,
    allowedActions: allowedRequestActions(role, request, actorId, companyId),
  }
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
  const support = new SupportRepository(deps.pool)
  const assignments = new AssignmentRepository(deps.pool)

  const actorCompanyId = async (actorId: string, role: string): Promise<string | null> => {
    if (role !== 'representative') return null
    const company = await deps.companyStore.findByRepresentative(actorId)
    return company?.id ?? null
  }

  const resolveScope = async (actorId: string, role: OperationalRole): Promise<{ scope: RequestScope; companyId: string | null }> => {
    const companyId = await actorCompanyId(actorId, role)
    const scope = bindRequestScope(requestScopeFor(role), actorId, companyId)
    return { scope, companyId }
  }

  router.use(requireProxyAuth(deps.proxySecret, deps.userStore))
  router.use(createDocumentRouter({ ...deps }))

  // The company profile adapter is privileged; only the current representative
  // of an existing company reaches it.
  router.use('/profile', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
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
    })
    res.status(201).json({ request: requestWithActions(actor.operationalRole, actor.id, request, companyId) })
  })

  router.get('/requests', async (req, res) => {
    const actor = actorOf(res)
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const result = await repo.listScoped(scope, { status, page, limit })
    res.json({
      ...result,
      items: result.items.map((item) => requestWithActions(actor.operationalRole, actor.id, item, companyId)),
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
      timeline: await activities.listForRequest(request.id),
      workflow: service?.workflow ?? [],
    })
  })

  router.get('/requests/:id', async (req, res) => {
    const actor = actorOf(res)
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const service = await deps.serviceCatalog.findById(request.serviceId)
    const timeline = await activities.listForRequest(request.id)
    res.json({
      request: requestWithActions(actor.operationalRole, actor.id, request, companyId),
      timeline,
      workflow: service?.workflow ?? [],
      owner: safeOwner(await deps.userStore.findById(request.ownerId)),
    })
  })

  router.post('/requests/:id/submit', async (req, res) => {
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
      companyId,
    )
    if (result === 'not_found') {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (result === 'already_submitted') {
      res.status(409).json({ error: 'already_submitted' })
      return
    }
    res.json({ request: requestWithActions(actor.operationalRole, actor.id, result, companyId) })
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

  router.get('/letters', async (req, res) => {
    const actor = actorOf(res)
    const read = parseBoolean(req.query.read)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await letters.listScoped(scope, { read, page, limit }))
  })

  router.get('/letters/:id', async (req, res) => {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const letter = await letters.findByIdAndMarkReadScoped(req.params.id, scope)
    if (!letter) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ letter })
  })

  router.get('/stats', async (_req, res) => {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await stats.forScope(scope))
  })

  router.get('/stats/overview', async (_req, res) => {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await stats.forScope(scope))
  })

  router.get('/activities', async (req, res) => {
    const actor = actorOf(res)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await activities.listScoped(scope, page, limit))
  })

  router.get('/profile', async (_req, res) => {
    const actor = actorOf(res)
    const profile = await profileRepo.getProfile(actor.id)
    res.json(profile)
  })

  router.patch('/profile', async (req, res) => {
    const actor = actorOf(res)
    const { company, contacts } = req.body ?? {}
    let profile = await profileRepo.getProfile(actor.id)
    if (company?.nationalId !== undefined && company.nationalId !== profile.company.nationalId) {
      res.status(403).json({ error: 'protected_company_identity' })
      return
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

  return router
}
