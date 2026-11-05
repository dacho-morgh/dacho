// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { operationalRoleOf } from '../../access/roles.js'
import { actorOf } from '../proxy-auth.js'
import { isCompanyAdministrator, parsePositiveInt } from './route-helpers.js'
import type { DashboardContext } from './context.js'

const MAX_COMPANY_PAGE_SIZE = 100

export function registerCompanyRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, profileRepo, verificationStore } = ctx

  router.get('/admin/companies', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      // Two reads for the whole list (accounts, companies), not one per account: each CMS call is slow.
      const [accounts, companies] = await Promise.all([
        deps.userStore.list({ role: 'representative' }),
        deps.companyStore.list(),
      ])
      // A deactivated representative («حذف شرکت») leaves the list; the account is kept.
      const users = accounts.filter((user) => user.isActive !== false)
      const companyOf = new Map<string, (typeof companies)[number]>()
      for (const company of companies) {
        if (company.representativeId && !companyOf.has(company.representativeId)) companyOf.set(company.representativeId, company)
      }
      const verifications = await verificationStore.currentSummaries(
        users.flatMap((user) => companyOf.get(user.id)?.id ?? []),
      )
      const requestedStatus =
        typeof req.query.verificationStatus === 'string'
          ? req.query.verificationStatus
          : typeof req.query.status === 'string'
            ? req.query.status
            : undefined
      const search = typeof req.query.search === 'string' ? req.query.search.trim().toLocaleLowerCase() : ''
      // The overviews and the letter form read the whole list without paging; only a caller
      // that asks for a `page` or `limit` (the companies table) gets a page.
      const paged = req.query.page !== undefined || req.query.limit !== undefined

      const enriched = users.map((user) => {
        const company = companyOf.get(user.id)
        const currentVerif = company ? verifications.get(company.id) : undefined
        const item = {
          id: user.id,
          companyId: company?.id ?? null,
          name: user.name ?? null,
          phone: user.phone,
          updatedAt: user.updatedAt ?? null,
          companyName: company?.name ?? null,
          companyType: company?.type ?? null,
          companyProvince: company?.province ?? null,
          companyCity: company?.city ?? null,
          companyEstablishmentDate: company?.establishmentDate ?? null,
          executives: company?.executives ?? [],
          verificationStatus: currentVerif?.status ?? 'unsubmitted',
          verificationRevision: currentVerif?.revision ?? 0,
          verificationSubmittedAt: currentVerif?.submittedAt ?? null,
        }
        const text = [
          item.companyName, item.name, item.phone, user.email, item.companyType, item.companyProvince,
          item.companyCity, item.verificationStatus, ...item.executives.map((executive) => executive.name),
        ].filter(Boolean).join(' ').toLocaleLowerCase()
        return { item, text }
      })
      const matching = search ? enriched.filter(({ text }) => text.includes(search)).map(({ item }) => item) : enriched.map(({ item }) => item)
      // The filter menu counts every queue of the search, not only the page on screen.
      const counts: Record<string, number> = { all: matching.length, unsubmitted: 0, pending: 0, approved: 0, returned: 0, rejected: 0 }
      for (const item of matching) counts[item.verificationStatus] = (counts[item.verificationStatus] ?? 0) + 1
      const filtered = requestedStatus && requestedStatus !== 'all'
        ? matching.filter((item) => item.verificationStatus === requestedStatus)
        : matching
      const limit = paged
        ? Math.min(parsePositiveInt(req.query.limit, 10), MAX_COMPANY_PAGE_SIZE)
        : Math.max(1, filtered.length)
      const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
      const page = Math.min(parsePositiveInt(req.query.page, 1), totalPages)
      res.json({
        items: filtered.slice((page - 1) * limit, page * limit),
        page,
        limit,
        totalDocs: filtered.length,
        totalPages,
        counts,
      })
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
        degree: user.degree ?? null,
        activityField: user.activityField ?? null,
      }]
    })
    res.json({ items })
  })
}
