import { Router } from 'express'
import { isOperationalRole } from '../access/roles.js'
import { actorOf, requireProxyAuth } from './proxy-auth.js'
import { createDocumentRouter } from '../documents/router.js'
import { createRfpRouter } from './rfp-router.js'
import { canOpenDashboardDestination } from './destination-access.js'
import { createDashboardContext, type DashboardDeps } from './routes/context.js'
import { isRepresentative } from './routes/route-helpers.js'
import { registerRequestRoutes } from './routes/requests.js'
import { registerReviewRoutes } from './routes/review.js'
import { registerInvestmentRoutes } from './routes/investment.js'
import { registerFollowUpRoutes } from './routes/follow-ups.js'
import { registerEventRoutes } from './routes/events.js'
import { registerLetterRoutes } from './routes/letters.js'
import { registerStatsRoutes } from './routes/stats.js'
import { registerProfileRoutes } from './routes/profile.js'
import { registerCompanyRoutes } from './routes/companies.js'
import { registerNotificationRoutes } from './routes/notifications.js'
import { registerSupportRoutes } from './routes/support.js'
import { registerExhibitionRoutes } from './routes/exhibitions.js'

export type { DashboardDeps } from './routes/context.js'

const dashboardRoles = {
  'system-owner': {
    label: 'صاحب سیستم',
    responsibilities: ['مدیریت دسترسی‌های سامانه', 'پیگیری همه درخواست‌ها و نامه‌ها'],
    // One entry for events and exhibitions (S5, FE40); /dashboard/exhibitions redirects into it.
    destinations: ['/dashboard', '/dashboard/companies', '/dashboard/employees', '/dashboard/requests', '/dashboard/letters', '/dashboard/events', '/dashboard/profile'],
  },
  'central-secretariat': {
    label: 'دبیرخانه مرکزی',
    responsibilities: ['پیگیری درخواست‌های ارجاع‌شده در محدوده دبیرخانه', 'مدیریت اطلاعات شرکت‌ها'],
    destinations: ['/dashboard', '/dashboard/companies', '/dashboard/employees', '/dashboard/requests', '/dashboard/letters', '/dashboard/exhibitions', '/dashboard/profile'],
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

export function createDashboardRouter(deps: DashboardDeps): Router {
  const router = Router()
  const ctx = createDashboardContext(deps)
  const { verificationStore } = ctx

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

  // Domain routes, registered in their original order (route matching depends on it).
  registerRequestRoutes(router, ctx)
  registerReviewRoutes(router, ctx)
  registerInvestmentRoutes(router, ctx)
  registerFollowUpRoutes(router, ctx)
  registerEventRoutes(router, ctx)
  registerLetterRoutes(router, ctx)
  registerStatsRoutes(router, ctx)
  registerProfileRoutes(router, ctx)
  registerCompanyRoutes(router, ctx)
  registerNotificationRoutes(router, ctx)
  registerSupportRoutes(router, ctx)
  registerExhibitionRoutes(router, ctx)

  return router
}
