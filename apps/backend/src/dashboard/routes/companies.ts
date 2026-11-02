// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { operationalRoleOf } from '../../access/roles.js'
import { actorOf } from '../proxy-auth.js'
import { isCompanyAdministrator } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerCompanyRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, profileRepo, verificationStore } = ctx

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
        degree: user.degree ?? null,
        activityField: user.activityField ?? null,
      }]
    })
    res.json({ items })
  })
}
