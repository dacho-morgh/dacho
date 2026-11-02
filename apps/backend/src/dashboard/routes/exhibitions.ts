// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { actorOf } from '../proxy-auth.js'
import { isUuid, parseBoothCreate, parseBoothUpdate, parseSettingsInput } from '../../exhibitions/catalogue.js'
import { isCompanyAdministrator } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerExhibitionRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, catalogue, boothReservations, verificationStore, checkExhibition } = ctx

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

  router.post('/exhibitions/:exhibitionId/booths/:boothId/reserve', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const eligibility = deps.boothCompanyEligibility ?? verificationStore
      if (!await eligibility.isVerified(company.id)) {
        res.status(403).json({ error: 'company_not_verified' })
        return
      }
      if (!isUuid(req.params.boothId)) {
        res.status(404).json({ error: 'booth_not_found' })
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
      const result = await boothReservations.reserve({
        exhibitionId: req.params.exhibitionId,
        boothId: req.params.boothId,
        companyId: company.id,
        actorId: actor.id,
        requireVerification: true,
      })
      if (!result.ok) {
        if (result.error === 'company_not_verified') {
          res.status(403).json({ error: result.error })
          return
        }
        if (result.error === 'catalogue_not_configured') {
          res.status(400).json({ error: result.error })
          return
        }
        res.status(409).json({ error: result.error })
        return
      }
      res.status(201).json({ reservation: result.reservation })
    } catch (error) { next(error) }
  })

  const getMyReservations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const items = await boothReservations.listByCompany(company.id, req.params.exhibitionId, actor.operationalRole)
      res.json({ items })
    } catch (error) { next(error) }
  }
  router.get('/exhibitions/:exhibitionId/my-reservations', getMyReservations)
  router.get('/exhibitions/:exhibitionId/reservations/me', getMyReservations)

  router.get('/exhibitions/:exhibitionId/reservations/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole) && actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (isCompanyAdministrator(actor.operationalRole)) {
        res.json({ reservation })
        return
      }
      if (actor.operationalRole === 'representative') {
        const company = await deps.companyStore.findByRepresentative(actor.id)
        if (company && reservation.companyId === company.id) {
          res.json({ reservation })
          return
        }
      }
      res.status(403).json({ error: 'forbidden' })
    } catch (error) { next(error) }
  })

  router.get('/admin/exhibitions/:exhibitionId/reservations', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined
      const status = statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected'
        ? statusParam
        : 'all'
      const items = await boothReservations.listByExhibition(req.params.exhibitionId, { status }, actor.operationalRole)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/admin/exhibitions/:exhibitionId/reservations/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const history = await boothReservations.listDecisionsHistory(reservation.id)
      res.json({ reservation, history })
    } catch (error) { next(error) }
  })

  router.post('/admin/exhibitions/:exhibitionId/reservations/:id/attendance', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const action = req.body?.action
      if (action !== 'approve' && action !== 'reject') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null
      if (action === 'reject' && !reason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const result = await boothReservations.decideAttendance({
        id: reservation.id,
        action,
        reason,
        actorId: actor.id,
      })
      if (!result.ok) {
        if (result.error === 'not_found') {
          res.status(404).json({ error: 'not_found' })
          return
        }
        if (result.error === 'reason_required') {
          res.status(400).json({ error: 'reason_required' })
          return
        }
        res.status(409).json({ error: result.error })
        return
      }
      res.json({ reservation: result.reservation })
    } catch (error) { next(error) }
  })

  router.post('/exhibitions/:exhibitionId/reservations/:id/receipt', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.id)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (reservation.companyId !== company.id) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const eligibility = await boothReservations.canSubmitReceipt(reservation.id, company.id)
      if (!eligibility.ok) {
        const status = eligibility.error === 'not_found' ? 404
          : eligibility.error === 'reservation_inactive' ? 409 : 403
        res.status(status).json({
          error: eligibility.error,
          ...(eligibility.attendanceStatus ? { attendanceStatus: eligibility.attendanceStatus } : {}),
        })
        return
      }
      // T50 owns document validation, persistence and receipt versions. Never
      // acknowledge a successful upload when no file has been stored.
      res.status(501).json({ error: 'receipt_upload_not_implemented' })
    } catch (error) { next(error) }
  })
}
