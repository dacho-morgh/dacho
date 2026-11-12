// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { DocumentRepository } from '../../documents/repo.js'
import { isUuid } from '../../db/uuid.js'
import { actorOf } from '../proxy-auth.js'
import type { SupportAttachment } from '../support-repo.js'
import { parsePositiveInt, isRepresentative, isCompanyAdministrator, resolveRequesterNames } from './route-helpers.js'
import type { DashboardContext } from './context.js'

const MAX_TICKET_ATTACHMENTS = 10

export function registerSupportRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, support } = ctx

  router.get('/support', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const result = isCompanyAdministrator(actor.operationalRole)
      ? await support.list({ page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25), status: typeof req.query.status === 'string' ? req.query.status : undefined })
      : await support.list({ requesterId: actor.id, unread: req.query.unread === 'true', page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25) })
    const requesterNames = await resolveRequesterNames(deps.userStore, result.items.map((ticket) => ticket.requesterId))
    const items = result.items.map((ticket) => ({ ...ticket, requesterName: requesterNames.get(ticket.requesterId) ?? 'شرکت متقاضی' }))
    res.json({ ...result, items })
  })

  router.post('/support', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole)) { res.status(403).json({ error: 'representative_only' }); return }
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : ''
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    if (!subject || !message) { res.status(400).json({ error: 'invalid_ticket' }); return }
    const rawIds: unknown = req.body?.attachmentIds ?? []
    if (!Array.isArray(rawIds) || rawIds.length > MAX_TICKET_ATTACHMENTS || !rawIds.every((id) => typeof id === 'string' && isUuid(id))) {
      res.status(400).json({ error: 'invalid_attachment' })
      return
    }
    const attachments: SupportAttachment[] = []
    if (rawIds.length > 0) {
      const company = await deps.companyStore.findByRepresentative(actor.id)
      const documents = new DocumentRepository(deps.pool)
      for (const id of new Set<string>(rawIds)) {
        const doc = await documents.findById(id)
        // Only the sender's own, still unused support uploads may travel with a ticket.
        if (!doc || doc.category !== 'supportAttachment' || doc.requestId !== null || doc.uploaderId !== actor.id || !company || doc.companyId !== company.id || await support.isAttached(id)) {
          res.status(404).json({ error: 'attachment_not_found' })
          return
        }
        attachments.push({ id: doc.id, name: doc.filename, mimeType: doc.mimeType, sizeBytes: doc.sizeBytes })
      }
    }
    res.status(201).json({ ticket: await support.create({ requesterId: actor.id, subject, message, attachments }) })
  })

  router.get('/support/:id', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const ticket = await support.findById(req.params.id)
    if (!ticket || (!isCompanyAdministrator(actor.operationalRole) && ticket.requesterId !== actor.id)) { res.status(404).json({ error: 'not_found' }); return }
    const requesterNames = await resolveRequesterNames(deps.userStore, [ticket.requesterId])
    // Opening it is reading it; the response still tells this one visit what was new.
    if (ticket.requesterId === actor.id && ticket.unread) await support.markSeen(ticket.id)
    res.json({ ticket: { ...ticket, requesterName: requesterNames.get(ticket.requesterId) ?? 'شرکت متقاضی' } })
  })

  router.get('/support/:id/attachments/:attachmentId/download', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const ticket = await support.findById(req.params.id)
      if (!ticket || (!isCompanyAdministrator(actor.operationalRole) && ticket.requesterId !== actor.id)) { res.status(404).json({ error: 'not_found' }); return }
      const attachmentId = String(req.params.attachmentId ?? '')
      const attachment = ticket.attachments.find((item) => item.id === attachmentId)
      const doc = attachment ? await new DocumentRepository(deps.pool).findById(attachment.id) : undefined
      if (!doc || doc.category !== 'supportAttachment') { res.status(404).json({ error: 'not_found' }); return }
      const body = await deps.privateDocumentStorage.read(doc.storageKey)
      if (!body) { res.status(410).json({ error: 'document_unavailable' }); return }
      const fallback = doc.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
      res.setHeader('Content-Type', doc.mimeType)
      res.setHeader('Content-Length', String(body.length))
      res.setHeader('Content-Disposition', `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
      res.status(200).send(body)
    } catch (error) { next(error) }
  })

  router.post('/support/:id/respond', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (!body) { res.status(400).json({ error: 'invalid_response' }); return }
    const existing = await support.findById(req.params.id)
    if (!existing || (!isCompanyAdministrator(actor.operationalRole) && existing.requesterId !== actor.id)) { res.status(404).json({ error: 'not_found' }); return }
    const authorRole = isCompanyAdministrator(actor.operationalRole) ? 'admin' : 'representative'
    const ticket = await support.respond(req.params.id, actor.id, authorRole, body)
    if (!ticket) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ ticket })
  })

  router.post('/support/:id/close', async (req, res) => {
    const actor = actorOf(res)
    if (!isRepresentative(actor.operationalRole) && !isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const existing = await support.findById(req.params.id)
    if (!existing || (!isCompanyAdministrator(actor.operationalRole) && existing.requesterId !== actor.id)) { res.status(404).json({ error: 'not_found' }); return }
    const ticket = await support.close(req.params.id, actor.id, isCompanyAdministrator(actor.operationalRole) ? 'admin' : 'representative')
    if (!ticket) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ ticket })
  })
}
