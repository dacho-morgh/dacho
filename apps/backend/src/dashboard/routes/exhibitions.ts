// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import { createHash } from 'node:crypto'
import type { Router } from 'express'
import multer from 'multer'
import type { NextFunction, Request, Response } from 'express'
import { actorOf } from '../proxy-auth.js'
import { MAX_DOCUMENT_BYTES, validateDocumentFile } from '../../documents/policy.js'
import { isUuid, parseBoothCreate, parseBoothUpdate, parseSettingsInput } from '../../exhibitions/catalogue.js'
import { isCompanyAdministrator } from './route-helpers.js'
import { notifyBoothStep } from '../next-role.js'
import type { DashboardContext } from './context.js'

export function registerExhibitionRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, catalogue, boothReservations, verificationStore, checkExhibition, notificationOutbox } = ctx

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
      if (result.reservation) {
        await notifyBoothStep(deps.pool, notificationOutbox, {
          reservationId: result.reservation.id, actorId: actor.id, action: 'booth_request',
        })
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
      const reservations = await boothReservations.listByCompany(company.id, req.params.exhibitionId, actor.operationalRole)
      const items = await Promise.all(reservations.map(async (reservation) => ({
        ...reservation,
        latestReceipt: await boothReservations.getLatestReceipt(reservation.id),
      })))
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
      const reservations = await boothReservations.listByExhibition(req.params.exhibitionId, { status }, actor.operationalRole)
      const companyNames = new Map<string, string | undefined>()
      for (const companyId of new Set(reservations.map((item) => item.companyId))) {
        companyNames.set(companyId, (await deps.companyStore.findById(companyId))?.name)
      }
      const items = await Promise.all(reservations.map(async (reservation) => ({
        ...reservation,
        companyName: reservation.companyName ?? companyNames.get(reservation.companyId),
        latestReceipt: await boothReservations.getLatestReceipt(reservation.id),
      })))
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
      await notifyBoothStep(deps.pool, notificationOutbox, {
        reservationId: reservation.id, actorId: actor.id, reason,
        action: action === 'approve' ? 'booth_attendance_approve' : 'booth_attendance_reject',
      })
      res.json({ reservation: result.reservation })
    } catch (error) { next(error) }
  })

  const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_DOCUMENT_BYTES + 1, files: 5, fields: 10 },
  })

  function isoReceiptContentDisposition(filename: string): string {
    const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  }

  router.post(
    '/exhibitions/:exhibitionId/reservations/:id/receipt',
    (req, res, next) => {
      receiptUpload.any()(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: 'file_too_large', maxBytes: MAX_DOCUMENT_BYTES })
            return
          }
          res.status(400).json({ error: 'invalid_file' })
          return
        }
        if (error) {
          next(error)
          return
        }
        next()
      })
    },
    async (req, res, next) => {
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

        const files = Array.isArray(req.files) ? req.files : []
        if (!files.length) {
          res.status(400).json({ error: 'invalid_file' })
          return
        }

        const validatedFiles = []
        for (const file of files) {
          const result = validateDocumentFile({
            category: 'boothPaymentReceipt',
            filename: file.originalname,
            mimeType: file.mimetype,
            body: file.buffer,
          })
          if (!result.ok) {
            res.status(result.error === 'file_too_large' ? 413 : 400).json({
              error: result.error,
              ...(result.error === 'file_too_large' ? { maxBytes: MAX_DOCUMENT_BYTES } : {}),
            })
            return
          }
          validatedFiles.push({ file: result.file, originalBuffer: file.buffer })
        }

        const savedKeys: string[] = []
        try {
          const receiptFiles = []
          for (const item of validatedFiles) {
            const key = await deps.privateDocumentStorage.save(item.file.body, item.file.extension)
            savedKeys.push(key)
            const fileHash = createHash('sha256').update(item.file.body).digest('hex')
            receiptFiles.push({
              filename: item.file.filename,
              mimeType: item.file.mimeType,
              sizeBytes: item.file.sizeBytes,
              storageKey: key,
              fileHash,
            })
          }

          const trackingCode = typeof req.body?.trackingCode === 'string' && req.body.trackingCode.trim() !== ''
            ? req.body.trackingCode.trim()
            : null
          const amountToman = req.body?.amountToman !== undefined && req.body?.amountToman !== null && req.body.amountToman !== ''
            ? Number(req.body.amountToman)
            : null
          const paidAt = typeof req.body?.paidAt === 'string' && req.body.paidAt.trim() !== ''
            ? req.body.paidAt.trim()
            : null
          const description = typeof req.body?.description === 'string' && req.body.description.trim() !== ''
            ? req.body.description.trim()
            : null

          const submitResult = await boothReservations.submitReceipt({
            reservationId: reservation.id,
            companyId: company.id,
            actorId: actor.id,
            trackingCode,
            amountToman,
            paidAt,
            description,
            files: receiptFiles,
          })

          if (!submitResult.ok) {
            for (const key of savedKeys) {
              await deps.privateDocumentStorage.remove(key).catch(() => undefined)
            }
            const status = submitResult.error === 'duplicate_receipt' ? 409
              : submitResult.error === 'reservation_inactive' ? 409
              : submitResult.error === 'receipt_pending' || submitResult.error === 'payment_confirmed' ? 409
              : submitResult.error === 'not_found' ? 404
              : 403
            res.status(status).json({
              error: submitResult.error,
              ...(submitResult.reason ? { reason: submitResult.reason } : {}),
              ...(submitResult.attendanceStatus ? { attendanceStatus: submitResult.attendanceStatus } : {}),
            })
            return
          }

          await notifyBoothStep(deps.pool, notificationOutbox, {
            reservationId: reservation.id, actorId: actor.id, action: 'booth_receipt_submit',
          })
          res.status(201).json({
            receipt: submitResult.receipt,
            reservation: submitResult.reservation,
          })
        } catch (storageOrDbError) {
          for (const key of savedKeys) {
            await deps.privateDocumentStorage.remove(key).catch(() => undefined)
          }
          throw storageOrDbError
        }
      } catch (error) { next(error) }
    },
  )

  router.get('/exhibitions/:exhibitionId/reservations/:id/receipts', async (req, res, next) => {
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
      if (actor.operationalRole === 'representative') {
        const company = await deps.companyStore.findByRepresentative(actor.id)
        if (!company || reservation.companyId !== company.id) {
          res.status(403).json({ error: 'forbidden' })
          return
        }
      }
      const items = await boothReservations.listReceipts(reservation.id)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/exhibitions/:exhibitionId/reservations/:id/receipt', async (req, res, next) => {
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
      if (actor.operationalRole === 'representative') {
        const company = await deps.companyStore.findByRepresentative(actor.id)
        if (!company || reservation.companyId !== company.id) {
          res.status(403).json({ error: 'forbidden' })
          return
        }
      }
      const receipt = await boothReservations.getLatestReceipt(reservation.id)
      res.json({ receipt })
    } catch (error) { next(error) }
  })

  router.post('/admin/exhibitions/:exhibitionId/reservations/:id/receipt/decision', async (req, res, next) => {
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
      if (action !== 'confirm' && action !== 'return') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      const receiptId = typeof req.body?.receiptId === 'string' ? req.body.receiptId : ''
      if (!isUuid(receiptId)) {
        res.status(400).json({ error: 'receipt_id_required' })
        return
      }
      const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null
      if (action === 'return' && !reason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const reservation = await boothReservations.findById(req.params.id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== req.params.exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const result = await boothReservations.decideReceipt({
        reservationId: reservation.id,
        receiptId,
        action,
        reason,
        actorId: actor.id,
      })
      if (!result.ok) {
        const status = result.error === 'not_found' ? 404 : result.error === 'reason_required' ? 400 : 409
        res.status(status).json({ error: result.error })
        return
      }
      await notifyBoothStep(deps.pool, notificationOutbox, {
        reservationId: reservation.id, actorId: actor.id, reason,
        action: action === 'confirm' ? 'booth_receipt_confirm' : 'booth_receipt_return',
      })
      res.json({ receipt: result.receipt, reservation: result.reservation })
    } catch (error) { next(error) }
  })

  async function downloadReceiptFile(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorOf(res)
      if (!isCompanyAdministrator(actor.operationalRole) && actor.operationalRole !== 'representative') {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const id = typeof req.params.id === 'string' ? req.params.id : ''
      const fileId = typeof req.params.fileId === 'string' ? req.params.fileId : ''
      const exhibitionId = typeof req.params.exhibitionId === 'string' ? req.params.exhibitionId : ''
      if (!isUuid(id) || !isUuid(fileId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const reservation = await boothReservations.findById(id, actor.operationalRole)
      if (!reservation || reservation.exhibitionId !== exhibitionId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (actor.operationalRole === 'representative') {
        const company = await deps.companyStore.findByRepresentative(actor.id)
        if (!company || reservation.companyId !== company.id) {
          res.status(404).json({ error: 'not_found' })
          return
        }
      }
      const file = await boothReservations.findReceiptFile(fileId)
      if (!file || file.reservationId !== reservation.id) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const body = await deps.privateDocumentStorage.read(file.storageKey)
      if (!body) {
        res.status(410).json({ error: 'document_unavailable' })
        return
      }
      res.setHeader('Content-Type', file.mimeType)
      res.setHeader('Content-Length', String(body.length))
      res.setHeader('Content-Disposition', isoReceiptContentDisposition(file.filename))
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
      res.status(200).send(body)
    } catch (error) { next(error) }
  }

  router.get('/exhibitions/:exhibitionId/reservations/:id/receipt/files/:fileId/download', downloadReceiptFile)
  router.get('/exhibitions/:exhibitionId/reservations/:id/receipts/:receiptId/files/:fileId/download', downloadReceiptFile)

}
