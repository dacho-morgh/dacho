// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { actorOf } from '../proxy-auth.js'
import { parsePositiveInt, isCompanyAdministrator } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerNotificationRoutes(router: Router, ctx: DashboardContext): void {
  const { notificationOutbox } = ctx

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
}
