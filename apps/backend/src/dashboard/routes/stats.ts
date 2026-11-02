// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { actorOf } from '../proxy-auth.js'
import { parseRequestFilters, parsePositiveInt, isCompanyAdministrator } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerStatsRoutes(router: Router, ctx: DashboardContext): void {
  const { activities, stats, support, verificationStore, limitActivities, resolveScope } = ctx

  router.get('/stats', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const filters = parseRequestFilters(req.query, actor)
    if (typeof filters === 'string') { res.status(400).json({ error: filters }); return }
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await stats.forScope(scope, filters))
    } catch (error) { next(error) }
  })

  /** The role's overview: status counts, its work queues and the options of the event filter. */
  router.get('/stats/overview', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    const role = actor.operationalRole
    const { scope, companyId } = await resolveScope(actor.id, role)
    const overview = await stats.overview(scope, { id: actor.id, role })
    // Work outside the request table. Each count is read from the list its role already has.
    const other: { key: string; count: number }[] = []
    if (role === 'central-secretariat') {
      other.push({ key: 'verification_pending', count: (await verificationStore.listQueue({ status: 'pending' })).length })
    }
    if (isCompanyAdministrator(role)) {
      other.push({ key: 'support_open', count: (await support.list({ status: 'open', page: 1, limit: 1 })).total })
    }
    if (companyId) {
      const verification = await verificationStore.findCurrentByCompanyId(companyId)
      if (verification?.status === 'returned' || verification?.status === 'rejected') {
        other.push({ key: 'company_verification_returned', count: 1 })
      }
    }
    res.set('Cache-Control', 'private, no-store, max-age=0').json({ ...overview, queues: [...overview.queues, ...other] })
    } catch (error) { next(error) }
  })

  /** Submissions per day for the dashboard's six-month chart, inside the actor's row scope. */
  router.get('/stats/trend', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.set('Cache-Control', 'private, no-store, max-age=0').json({ days: await stats.trend(scope, 200) })
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
}
