import { Router } from 'express'
import type { Pool } from 'pg'

import type { ServiceCatalog, ServiceDefinition } from '../catalog/service-catalog.js'
import { ActivityRepository } from './activity-repo.js'
import { LetterRepository } from './letter-repo.js'
import { requireProxyAuth } from './proxy-auth.js'
import { RequestRepository } from './request-repo.js'
import { StatsRepository } from './stats-repo.js'
import { WorkflowEngine, type TransitionType } from './workflow-engine.js'

export interface DashboardDeps {
  pool: Pool
  serviceCatalog: ServiceCatalog
  proxySecret: string
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
  const engine = new WorkflowEngine(deps.pool, deps.serviceCatalog)

  router.use(requireProxyAuth(deps.proxySecret))

  router.post('/requests', async (req, res) => {
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

  router.post('/requests/:id/transition', async (req, res) => {
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

  return router
}
