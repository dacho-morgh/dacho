// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { actorOf } from '../proxy-auth.js'
import { parseRequestFilters, parsePositiveInt, isCompanyAdministrator } from './route-helpers.js'
import type { DashboardContext } from './context.js'
import { EventViewRepository } from '../event-view-repo.js'
import type { ChartSlice } from '../stats-repo.js'
import { activeStaffCounts, companyVerificationCounts, openEventCounts } from '../owner-summary.js'

/** Booth steps the Secretariat acts on; the others wait on the company or are done. */
const SECRETARIAT_BOOTH_QUEUES: readonly string[] = ['attendance_pending', 'receipt_pending']

export function registerStatsRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, activities, stats, support, verificationStore, eventStore, limitActivities, resolveScope } = ctx

  router.get('/stats', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const filters = parseRequestFilters(req.query, actor)
    if (typeof filters === 'string') { res.status(400).json({ error: filters }); return }
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    res.json(await stats.forScope(scope, filters))
    } catch (error) { next(error) }
  })

  /**
   * The role's overview: status counts, its work queues, the options of the event filter and the
   * series of its charts. The request counts and queues are the core: when they fail, the whole read
   * fails. Every other section reads on its own, and one that fails is named in `unavailable`
   * instead of being reported as zero.
   */
  router.get('/stats/overview', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    const role = actor.operationalRole
    const { scope, companyId } = await resolveScope(actor.id, role)
    const overview = await stats.overview(scope, { id: actor.id, role })
    // Work outside the request table. Each count is read from the list its role already has.
    type Section = { queues?: { key: string; count: number }[]; chart?: { key: string; slices: ChartSlice[] } }
    const sections: [key: string, read: () => Promise<Section>][] = []
    if (role === 'central-secretariat') {
      sections.push(['verification_pending', async () => ({
        queues: [{ key: 'verification_pending', count: (await verificationStore.listQueue({ status: 'pending' })).length }],
      })])
    }
    if (isCompanyAdministrator(role)) {
      sections.push(['support_open', async () => ({
        queues: [{ key: 'support_open', count: (await support.list({ status: 'open', page: 1, limit: 1 })).total }],
      })])
    }
    if (role === 'central-secretariat') {
      sections.push(['company_verification', async () => ({
        chart: { key: 'company_verification', slices: await stats.verificationStates() },
      })])
      sections.push(['booth_requests', async () => {
        const booths = await stats.boothStates()
        return {
          queues: booths.filter((slice) => SECRETARIAT_BOOTH_QUEUES.includes(slice.key))
            .map((slice) => ({ key: `booth_${slice.key}`, count: slice.count })),
          chart: { key: 'booth_requests', slices: booths },
        }
      }])
    }
    if (role === 'reviewer' || role === 'employer-reviewer') {
      sections.push(['own_evaluations', async () => ({
        chart: { key: 'own_evaluations', slices: await stats.evaluationStates({ id: actor.id, role }) },
      })])
    }
    if (companyId) {
      sections.push(['company_verification_returned', async () => {
        const verification = await verificationStore.findCurrentByCompanyId(companyId)
        return {
          queues: verification?.status === 'returned' || verification?.status === 'rejected'
            ? [{ key: 'company_verification_returned', count: 1 }]
            : [],
        }
      }])
      sections.push(['booth_requests', async () => {
        const booths = await stats.boothStates(companyId)
        return {
          queues: [{ key: 'booth_receipt_due', count: booths.find((slice) => slice.key === 'receipt_due')?.count ?? 0 }],
          chart: { key: 'booth_requests', slices: booths },
        }
      }])
    }
    const results = await Promise.all(sections.map(async ([key, read]) => {
      try {
        return { key, section: await read() }
      } catch (error) {
        console.error(`stats/overview: section ${key} failed`, error)
        return { key, section: undefined }
      }
    }))
    res.set('Cache-Control', 'private, no-store, max-age=0').json({
      ...overview,
      queues: [...overview.queues, ...results.flatMap(({ section }) => section?.queues ?? [])],
      charts: results.flatMap(({ section }) => (section?.chart ? [section.chart] : [])),
      unavailable: results.filter(({ section }) => !section).map(({ key }) => key),
    })
    } catch (error) { next(error) }
  })

  /**
   * The owner overview's company, staff and event counts in one read. The overview used to fetch the
   * full company, employee and event lists (three proxy round trips, each with its own CMS reads and
   * the public event pages) only to count them. Each section reads on its own: one that fails is
   * `null` instead of zero, and the others still arrive.
   */
  router.get('/stats/owner-summary', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) { res.status(403).json({ error: 'forbidden' }); return }
      const read = async <T>(name: string, section: () => Promise<T>): Promise<T | null> => {
        try { return await section() } catch (error) {
          console.error(`stats/owner-summary: ${name} failed`, error)
          return null
        }
      }
      const [companies, staff, events] = await Promise.all([
        // Same reads as the company list, so the counts match what that page shows.
        read('companies', async () => {
          const [accounts, records] = await Promise.all([
            deps.userStore.list({ role: 'representative' }),
            deps.companyStore.list(),
          ])
          const active = accounts.filter((user) => user.isActive !== false)
          const companyOf = new Map<string, (typeof records)[number]>()
          for (const company of records) {
            if (company.representativeId && !companyOf.has(company.representativeId)) companyOf.set(company.representativeId, company)
          }
          const verifications = await verificationStore.currentSummaries(
            active.flatMap((user) => companyOf.get(user.id)?.id ?? []),
          )
          return companyVerificationCounts(
            active.map((user) => {
              const company = companyOf.get(user.id)
              return company ? verifications.get(company.id)?.status : undefined
            }),
          )
        }),
        read('staff', async () => activeStaffCounts(await deps.userStore.list())),
        read('events', async () => openEventCounts(await eventStore.list(), new Date())),
      ])
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ companies, staff, events })
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

  /**
   * The counts the sidebar shows beside its destinations: unread mail, work waiting on the person and
   * the open events a company has not opened yet. Each reads on its own; one that fails is left out
   * so the sidebar shows no number for it instead of a wrong one.
   */
  router.get('/nav-counts', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      const { scope, companyId } = await resolveScope(actor.id, role)
      const read = async (name: string, section: () => Promise<number>): Promise<number | undefined> => {
        try { return await section() } catch (error) {
          console.error(`nav-counts: ${name} failed`, error)
          return undefined
        }
      }
      const [mail, work, events] = await Promise.all([
        read('mail', async () => {
          const unread = (await ctx.letters.inboxCounts(scope, actor.id)).unread
          // A support answer the company has not opened is mail too.
          const tickets = role === 'representative'
            ? (await support.list({ requesterId: actor.id, unread: true, page: 1, limit: 1 })).total
            : 0
          return unread + tickets
        }),
        read('requests', async () => {
          const overview = await stats.overview(scope, { id: actor.id, role })
          // A draft is the company's own pace, not work someone is waiting on.
          let count = overview.queues.filter((queue) => queue.key !== 'company_draft').reduce((sum, queue) => sum + queue.count, 0)
          if (companyId) {
            const verification = await verificationStore.findCurrentByCompanyId(companyId)
            if (!verification || verification.status === 'returned') count += 1
          }
          return count
        }),
        read('events', async () => {
          if (!companyId) return 0
          const now = Date.now()
          const open = (await eventStore.list()).filter((event) =>
            event.publicEventId && (!event.registrationCloseAt || Date.parse(event.registrationCloseAt) >= now))
          return new EventViewRepository(deps.pool).countUnseen(actor.id, open.map((event) => event.id))
        }),
      ])
      res.set('Cache-Control', 'private, no-store, max-age=0')
      res.json({
        ...(mail === undefined ? {} : { letters: mail }),
        ...(work === undefined ? {} : { requests: work }),
        ...(events === undefined ? {} : { events }),
      })
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
