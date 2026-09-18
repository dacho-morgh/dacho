import { Router } from 'express'
import type { Pool } from 'pg'

import type { ServiceCatalog, ServiceDefinition } from '../catalog/service-catalog.js'
import { ActivityRepository } from './activity-repo.js'
import { LetterRepository } from './letter-repo.js'
import { ProfileRepository } from './profile-repo.js'
import { requireProxyAuth } from './proxy-auth.js'
import { RequestRepository } from './request-repo.js'
import { StatsRepository } from './stats-repo.js'
import { WorkflowEngine, type TransitionType } from './workflow-engine.js'
import type { UserStore } from '../auth/user-store.js'
import { SupportRepository } from './support-repo.js'

export interface DashboardDeps {
  pool: Pool
  serviceCatalog: ServiceCatalog
  proxySecret: string
  userStore: UserStore
}

const TRANSITIONS: TransitionType[] = ['forward', 'return-to-company', 'return-to-previous', 'reject']

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

function isStaff(res: { locals: Record<string, unknown> }): boolean {
  return res.locals.userRole === 'staff'
}

function requesterDisplayName(user: Awaited<ReturnType<UserStore['findById']>>): string {
  return user?.companyName || user?.name || 'شرکت متقاضی'
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
      for (const user of await userStore.list({ role: 'applicant' })) {
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
  const profileRepo = new ProfileRepository(deps.userStore)
  const support = new SupportRepository(deps.pool)
  const engine = new WorkflowEngine(deps.pool, deps.serviceCatalog)

  router.use(requireProxyAuth(deps.proxySecret))

  router.post('/requests', async (req, res) => {
    if (res.locals.userRole !== 'applicant') { res.status(403).json({ error: 'applicant_only' }); return }
    const userId = res.locals.userId as string
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
      ownerId: userId,
      answers: answersValue as Record<string, unknown>,
    })
    res.status(201).json({ request })
  })

  router.get('/requests', async (req, res) => {
    const userId = res.locals.userId as string
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)

    const result = await repo.list({ ownerId: userId, status, page, limit })
    res.json(result)
  })

  // Staff queue: applicant-owned requests remain isolated from this route.
  router.get('/admin/requests', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const result = await repo.listAll({ status, page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25) })
    const items = await Promise.all(result.items.map(async (item) => ({ ...item, owner: await deps.userStore.findById(item.ownerId) })))
    res.json({ ...result, items })
  })

  router.get('/admin/requests/:id', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    const request = await repo.findByIdAny(req.params.id)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    const service = await deps.serviceCatalog.findById(request.serviceId)
    res.json({ request, owner: await deps.userStore.findById(request.ownerId), timeline: await activities.listForRequest(request.id), workflow: service?.workflow ?? [] })
  })

  router.get('/requests/:id', async (req, res) => {
    const userId = res.locals.userId as string
    const request = await repo.findById(req.params.id, userId)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const service = await deps.serviceCatalog.findById(request.serviceId)
    const timeline = await activities.listForRequest(request.id)
    res.json({
      request,
      timeline,
      workflow: service?.workflow ?? [],
    })
  })

  router.post('/requests/:id/submit', async (req, res) => {
    const userId = res.locals.userId as string
    const request = await repo.findById(req.params.id, userId)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
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
      userId,
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
    res.json({ request: result })
  })

  router.get('/letters', async (req, res) => {
    const userId = res.locals.userId as string
    const read = parseBoolean(req.query.read)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)

    const result = await letters.list({ ownerId: userId, read, page, limit })
    res.json(result)
  })

  router.get('/letters/:id', async (req, res) => {
    const userId = res.locals.userId as string
    const letter = await letters.findByIdAndMarkRead(req.params.id, userId)
    if (!letter) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ letter })
  })

  router.get('/stats', async (req, res) => {
    const userId = res.locals.userId as string
    res.json(await stats.forOwner(userId))
  })

  router.get('/activities', async (req, res) => {
    const userId = res.locals.userId as string
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    res.json(await activities.list(userId, page, limit))
  })

  router.get('/profile', async (_req, res) => {
    const userId = res.locals.userId as string
    const profile = await profileRepo.getProfile(userId)
    res.json(profile)
  })

  router.patch('/profile', async (req, res) => {
    const userId = res.locals.userId as string
    const { company, contacts } = req.body ?? {}
    let profile = await profileRepo.getProfile(userId)
    if (company && typeof company === 'object') {
      profile = await profileRepo.updateBasicInfo(userId, company)
    }
    if (contacts && typeof contacts === 'object') {
      profile = await profileRepo.updateContactInfo(userId, contacts)
    }
    if (Array.isArray(req.body?.executives)) {
      profile = await profileRepo.updateExecutives(userId, req.body.executives)
    }
    res.json(profile)
  })

  router.post('/profile/addresses', async (req, res) => {
    const userId = res.locals.userId as string
    const { title, province, city, postalCode, address } = req.body ?? {}
    if (!title || !address) {
      res.status(400).json({ error: 'invalid_address' })
      return
    }
    const created = await profileRepo.addAddress(userId, {
      title: String(title),
      province: String(province ?? ''),
      city: String(city ?? ''),
      postalCode: String(postalCode ?? ''),
      address: String(address),
    })
    res.status(201).json({ address: created })
  })

  router.put('/profile/addresses/:id', async (req, res) => {
    const userId = res.locals.userId as string
    const { title, province, city, postalCode, address } = req.body ?? {}
    const updated = await profileRepo.updateAddress(userId, req.params.id, {
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
    const userId = res.locals.userId as string
    const success = await profileRepo.deleteAddress(userId, req.params.id)
    if (!success) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ success: true })
  })

  router.post('/requests/:id/transition', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    const actor = {
      userId: res.locals.userId as string,
      roles: res.locals.userRoles as string[],
      cmsRole: res.locals.userCmsRole as string | undefined,
    }
    const { transition, note } = req.body ?? {}

    if (!TRANSITIONS.includes(transition as TransitionType)) {
      res.status(400).json({ error: 'invalid_transition' })
      return
    }
    if (note !== undefined && typeof note !== 'string') {
      res.status(400).json({ error: 'invalid_note' })
      return
    }

    const result = await engine.transition({
      requestId: req.params.id,
      actor,
      transition: transition as TransitionType,
      note,
    })

    if ('error' in result) {
      switch (result.error) {
        case 'request_not_found':
          res.status(404).json({ error: 'not_found' })
          return
        case 'service_not_found':
          res.status(404).json({ error: 'service_not_found' })
          return
        case 'forbidden':
          res.status(403).json({ error: 'forbidden' })
          return
        case 'invalid_state':
          res.status(409).json({ error: 'invalid_state' })
          return
        case 'invalid_transition':
          res.status(409).json({ error: 'invalid_transition' })
          return
      }
    }

    res.json({ request: result.request })
  })

  router.delete('/letters/:id', async (req, res) => {
    const deleted = await letters.delete(req.params.id, res.locals.userId as string, isStaff(res))
    if (!deleted) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ success: true })
  })

  router.post('/admin/requests/:id/transition', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    const actor = { userId: res.locals.userId as string, roles: res.locals.userRoles as string[], cmsRole: res.locals.userCmsRole as string | undefined }
    const { transition, note } = req.body ?? {}
    if (!TRANSITIONS.includes(transition as TransitionType)) { res.status(400).json({ error: 'invalid_transition' }); return }
    const result = await engine.transition({ requestId: req.params.id, actor, transition, note })
    if ('error' in result) { res.status(result.error === 'request_not_found' ? 404 : result.error === 'forbidden' ? 403 : 409).json({ error: result.error }); return }
    res.json(result)
  })

  router.get('/admin/companies', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    res.json({ items: await deps.userStore.list({ role: 'applicant', search: typeof req.query.search === 'string' ? req.query.search : undefined }) })
  })

  router.get('/admin/companies/:id', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    const user = await deps.userStore.findById(req.params.id)
    if (!user || user.role === 'staff') { res.status(404).json({ error: 'not_found' }); return }
    res.json({ user, profile: await profileRepo.getProfile(user.id) })
  })

  router.get('/admin/employees', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    res.json({ items: await deps.userStore.list({ role: 'staff', search: typeof req.query.search === 'string' ? req.query.search : undefined }) })
  })

  router.get('/admin/letters', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    res.json(await letters.listAll({ page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25), recipientId: typeof req.query.recipientId === 'string' ? req.query.recipientId : undefined }))
  })

  router.get('/admin/letters/:id', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    const letter = await letters.findById(req.params.id)
    if (!letter) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ letter })
  })

  router.post('/admin/letters', async (req, res) => {
    if (!isStaff(res)) { res.status(403).json({ error: 'forbidden' }); return }
    const { title, body, recipientId, type } = req.body ?? {}
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    const trimmedBody = typeof body === 'string' ? body.trim() : ''
    const trimmedRecipientId = typeof recipientId === 'string' ? recipientId.trim() : ''
    if (!trimmedTitle || !trimmedBody || !trimmedRecipientId) { res.status(400).json({ error: 'invalid_letter' }); return }
    const recipient = await deps.userStore.findById(trimmedRecipientId)
    if (!recipient || recipient.role !== 'applicant') { res.status(404).json({ error: 'recipient_not_found' }); return }
    const letterType = type === 'approved' || type === 'needs_fix' || type === 'rejected' || type === 'notification' ? type : 'official'
    res.status(201).json({ letter: await letters.create({ type: letterType, title: trimmedTitle, body: trimmedBody, recipientId: trimmedRecipientId, senderId: res.locals.userId as string, senderRole: 'staff' }) })
  })

  router.get('/support', async (req, res) => {
    const userId = res.locals.userId as string
    const result = isStaff(res)
      ? await support.list({ page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25), status: typeof req.query.status === 'string' ? req.query.status : undefined })
      : await support.list({ requesterId: userId, page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25) })
    const requesterNames = await resolveRequesterNames(deps.userStore, result.items.map((ticket) => ticket.requesterId))
    const items = result.items.map((ticket) => ({ ...ticket, requesterName: requesterNames.get(ticket.requesterId) ?? 'شرکت متقاضی' }))
    res.json({ ...result, items })
  })

  router.post('/support', async (req, res) => {
    if (res.locals.userRole !== 'applicant') { res.status(403).json({ error: 'applicant_only' }); return }
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : ''
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!subject || !message) { res.status(400).json({ error: 'invalid_ticket' }); return }
    res.status(201).json({ ticket: await support.create({ requesterId: res.locals.userId as string, subject, message }) })
  })

  router.get('/support/:id', async (req, res) => {
    const ticket = await support.findById(req.params.id)
    if (!ticket || (!isStaff(res) && ticket.requesterId !== res.locals.userId)) { res.status(404).json({ error: 'not_found' }); return }
    const requesterNames = await resolveRequesterNames(deps.userStore, [ticket.requesterId])
    res.json({ ticket: { ...ticket, requesterName: requesterNames.get(ticket.requesterId) ?? 'شرکت متقاضی' } })
  })

  router.post('/support/:id/respond', async (req, res) => {
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (!body) { res.status(400).json({ error: 'invalid_response' }); return }
    const existing = await support.findById(req.params.id)
    if (!existing || (!isStaff(res) && existing.requesterId !== res.locals.userId)) { res.status(404).json({ error: 'not_found' }); return }
    const authorRole = isStaff(res) ? 'staff' : 'applicant'
    const ticket = await support.respond(req.params.id, res.locals.userId as string, authorRole, body)
    if (!ticket) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ ticket })
  })

  router.post('/support/:id/close', async (req, res) => {
    const existing = await support.findById(req.params.id)
    if (!existing || (!isStaff(res) && existing.requesterId !== res.locals.userId)) { res.status(404).json({ error: 'not_found' }); return }
    const ticket = await support.close(req.params.id, res.locals.userId as string, isStaff(res) ? 'staff' : 'applicant')
    if (!ticket) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ ticket })
  })

  return router
}
