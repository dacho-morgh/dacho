// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { OPERATIONAL_ROLES, isCaseAssignmentRole, operationalRoleOf, type OperationalRole } from '../../access/roles.js'
import { isReviewerRole } from '../review-case-repo.js'
import type { CreateLetterInput, LetterAttachmentDto } from '../letter-repo.js'
import { DocumentRepository } from '../../documents/repo.js'
import { canSendLetter } from '../letter-policy.js'
import { actorOf } from '../proxy-auth.js'
import type { User } from '../../auth/user-store.js'
import { isUuid } from '../../exhibitions/catalogue.js'
import { parsePositiveInt, parseBoolean, isCompanyAdministrator } from './route-helpers.js'
import type { DashboardContext } from './context.js'

const MAX_LETTER_SEARCH_LENGTH = 100

export function registerLetterRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, repo, letters, assignments, financialPackages, resolveScope, canReadAttachment, attachmentMatchesLetter, attachmentDto, presentLetter } = ctx

  router.get('/letters', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const read = parseBoolean(req.query.read)
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : undefined
    if (requestId !== undefined && !isUuid(requestId)) { res.status(400).json({ error: 'invalid_request_id' }); return }
    const box = req.query.box === 'received' || req.query.box === 'sent' ? req.query.box : undefined
    if (req.query.box !== undefined && !box) { res.status(400).json({ error: 'invalid_box' }); return }
    const status = req.query.status === 'unread' || req.query.status === 'action_required' ? req.query.status : undefined
    if (req.query.status !== undefined && !status) { res.status(400).json({ error: 'invalid_status' }); return }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() || undefined : undefined
    if (q && q.length > MAX_LETTER_SEARCH_LENGTH) { res.status(400).json({ error: 'search_too_long' }); return }
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const result = await letters.listScoped(scope, { read, page, limit, actorId: actor.id, requestId, box, q, status })
    res.json({
      ...result,
      counts: await letters.inboxCounts(scope, actor.id),
      items: await Promise.all(result.items.map((letter) => presentLetter(letter, actor.id, actor.operationalRole))),
    })
    } catch (error) { next(error) }
  })

  // Who the actor may write to now. Sending re-checks every rule when the letter is written.
  router.get('/letters/recipients', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const { requestId } = req.query
      const caseLinked = requestId !== undefined
      const allowedRoles = OPERATIONAL_ROLES.filter((role) => canSendLetter(actor.operationalRole, role, caseLinked))
      const listRoles = (roles: OperationalRole[], search?: string) =>
        Promise.all(roles.map((operationalRole) => deps.userStore.list({ operationalRole, search })))
      const present = (users: (User | undefined)[], eligible: (user: User, role: OperationalRole) => boolean) => {
        const items = new Map<string, { id: string; name: string | null; operationalRole: OperationalRole }>()
        for (const user of users) {
          const role = operationalRoleOf(user)
          if (!user || !role || user.id === actor.id || !allowedRoles.includes(role) || !eligible(user, role)) continue
          items.set(user.id, { id: user.id, name: user.name ?? null, operationalRole: role })
        }
        return [...items.values()]
      }

      if (!caseLinked) {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() || undefined : undefined
        res.json({ items: present((await listRoles(allowedRoles, search)).flat(), () => true) })
        return
      }
      if (typeof requestId !== 'string' || !isUuid(requestId)) { res.status(400).json({ error: 'invalid_request_id' }); return }
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const item = await repo.findByIdScoped(requestId, scope)
      if (!item) { res.status(404).json({ error: 'not_found' }); return }

      const handedOff = await financialPackages.isSubmitted(requestId)
      if (actor.operationalRole === 'investment-reviewer' && !handedOff) { res.json({ items: [] }); return }
      const active = (await assignments.listForRequest(requestId)).filter((assignment) => assignment.active)
      const chiefs = active.filter((assignment) => assignment.role === 'chief-reviewer')
      const staffRoles = allowedRoles.filter((role) => role === 'system-owner' || role === 'central-secretariat')
      const candidates = [
        ...(await listRoles(staffRoles)).flat(),
        ...(await Promise.all([...active.map((assignment) => assignment.userId), item.ownerId].map((id) => deps.userStore.findById(id)))),
      ]
      res.json({
        items: present(candidates, (user, role) => {
          if (!isCaseAssignmentRole(role)) return true
          if (!active.some((assignment) => assignment.userId === user.id && assignment.role === role)) return false
          if (role === 'investment-reviewer') return handedOff
          return !isReviewerRole(actor.operationalRole) || chiefs.length === 1
        }),
      })
    } catch (error) { next(error) }
  })

  router.get('/letters/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const letter = await letters.findByIdAndMarkReadScoped(req.params.id, scope, actor.id)
    if (!letter) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const thread = await letters.threadScoped(letter, scope, actor.id)
    res.json({
      letter: await presentLetter(letter, actor.id, actor.operationalRole),
      thread: await Promise.all(thread.map((item) => presentLetter(item, actor.id, actor.operationalRole))),
    })
    } catch (error) { next(error) }
  })

  // The recipient's row menu: mark read or unread. Only the recipient can change it.
  router.post('/letters/:id/read', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const read = (req.body as { read?: unknown } | undefined)?.read
    if (typeof read !== 'boolean') { res.status(400).json({ error: 'invalid_read' }); return }
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const letter = await letters.setReadScoped(req.params.id, scope, actor.id, read)
    if (!letter) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ letter: await presentLetter(letter, actor.id, actor.operationalRole) })
    } catch (error) { next(error) }
  })

  router.delete('/letters/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const deleted = await letters.deleteScoped(req.params.id, scope)
    if (!deleted) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ success: true })
    } catch (error) { next(error) }
  })

  router.get('/admin/letters', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const result = await letters.listAll({ page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25), recipientId: typeof req.query.recipientId === 'string' ? req.query.recipientId : undefined })
    res.json({ ...result, items: await Promise.all(result.items.map((letter) => presentLetter(letter, actor.id, actor.operationalRole))) })
    } catch (error) { next(error) }
  })

  router.get('/admin/letters/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const letter = await letters.findByIdAndMarkReadScoped(req.params.id, { kind: 'all' }, actor.id)
    if (!letter) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ letter: await presentLetter(letter, actor.id, actor.operationalRole) })
    } catch (error) { next(error) }
  })

  const sendLetter = async (req: Request, res: Response, next: NextFunction) => {
    try {
    const actor = actorOf(res)
    const { title, body, recipientId, type, requestId, attachmentIds, attachments: rawAttachments, idempotencyKey } = req.body ?? {}
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    const trimmedBody = typeof body === 'string' ? body.trim() : ''
    const trimmedRecipientId = typeof recipientId === 'string' ? recipientId.trim() : ''
    if (!trimmedTitle || !trimmedBody || !trimmedRecipientId) { res.status(400).json({ error: 'invalid_letter' }); return }
    if (requestId !== undefined && (typeof requestId !== 'string' || !isUuid(requestId))) { res.status(400).json({ error: 'invalid_request_id' }); return }
    const recipient = await deps.userStore.findById(trimmedRecipientId)
    const recipientRole = operationalRoleOf(recipient)
    if (!recipientRole || !canSendLetter(actor.operationalRole, recipientRole, Boolean(requestId))) { res.status(403).json({ error: 'forbidden' }); return }
    if (idempotencyKey !== undefined && (typeof idempotencyKey !== 'string' || !isUuid(idempotencyKey))) { res.status(400).json({ error: 'invalid_idempotency_key' }); return }
    const firstSend = idempotencyKey ? await letters.findByIdempotencyKey(actor.id, idempotencyKey) : undefined
    if (firstSend) { res.status(200).json({ letter: firstSend }); return }

    const incomingAttachmentIds: string[] = []
    if (attachmentIds !== undefined) {
      if (!Array.isArray(attachmentIds) || !attachmentIds.every((item) => typeof item === 'string' && isUuid(item))) {
        res.status(400).json({ error: 'invalid_attachment' })
        return
      }
      for (const item of attachmentIds) {
        incomingAttachmentIds.push(item)
      }
    }
    if (rawAttachments !== undefined) {
      if (!Array.isArray(rawAttachments)) {
        res.status(400).json({ error: 'invalid_attachment' })
        return
      }
      for (const item of rawAttachments) {
        const id = typeof item === 'string' ? item : item && typeof item === 'object' ? item.id : undefined
        if (typeof id !== 'string' || !isUuid(id)) {
          res.status(400).json({ error: 'invalid_attachment' })
          return
        }
        incomingAttachmentIds.push(id)
      }
    }

    const resolvedAttachments: LetterAttachmentDto[] = []
    if (incomingAttachmentIds.length > 0) {
      const documentsRepo = new DocumentRepository(deps.pool)
      for (const attId of new Set(incomingAttachmentIds)) {
        const doc = await documentsRepo.findById(attId)
        if (!doc) {
          res.status(404).json({ error: 'attachment_not_found' })
          return
        }
        if (!(await attachmentMatchesLetter(doc, requestId ?? null)) ||
            !(await canReadAttachment(doc, actor.id, actor.operationalRole)) ||
            !(await canReadAttachment(doc, trimmedRecipientId, recipientRole))) {
          res.status(403).json({ error: 'forbidden' })
          return
        }
        resolvedAttachments.push(attachmentDto(doc))
      }
    }

    const letterType = isCompanyAdministrator(actor.operationalRole) && (type === 'approved' || type === 'needs_fix' || type === 'rejected' || type === 'notification') ? type : 'official'
    const input: CreateLetterInput = { type: letterType, title: trimmedTitle, body: trimmedBody, recipientId: trimmedRecipientId,
      senderId: actor.id, senderName: actor.user.name ?? null, senderRole: actor.operationalRole, requestId: requestId ?? null,
      attachments: resolvedAttachments, idempotencyKey: idempotencyKey ?? null }
    let letter
    try {
      if (requestId) {
        const senderScope = await resolveScope(actor.id, actor.operationalRole)
        const recipientScope = await resolveScope(trimmedRecipientId, recipientRole)
        letter = await letters.createScoped(input, senderScope.scope, recipientScope.scope,
          actor.operationalRole === 'reviewer' || actor.operationalRole === 'employer-reviewer',
          actor.operationalRole === 'investment-reviewer' || recipientRole === 'investment-reviewer')
        if (!letter) { res.status(403).json({ error: 'forbidden' }); return }
      } else {
        letter = await letters.create(input)
      }
    } catch (error) {
      // Two sends with one key raced past the lookup above; the winner is the letter.
      const winner = idempotencyKey && (error as { code?: string }).code === '23505'
        ? await letters.findByIdempotencyKey(actor.id, idempotencyKey)
        : undefined
      if (!winner) throw error
      res.status(200).json({ letter: winner })
      return
    }
    res.status(201).json({ letter })
    } catch (error) { next(error) }
  }
  router.post('/letters', sendLetter)
  router.post('/admin/letters', (req, res, next) => {
    if (!isCompanyAdministrator(actorOf(res).operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    void sendLetter(req, res, next)
  })

  router.get('/letters/:letterId/attachments/:attachmentId/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(res)
      const letterId = String(req.params.letterId ?? '')
      const attachmentId = String(req.params.attachmentId ?? '')
      if (!isUuid(letterId) || !isUuid(attachmentId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const letter = await letters.findByIdScoped(letterId, scope)
      if (!letter) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const att = Array.isArray(letter.attachments)
        ? letter.attachments.find((value) => value && typeof value === 'object' && (value as { id?: unknown }).id === attachmentId)
        : undefined
      if (!att) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const documentsRepo = new DocumentRepository(deps.pool)
      const doc = await documentsRepo.findById(attachmentId)
      if (!doc || !(await attachmentMatchesLetter(doc, letter.requestId)) || !(await canReadAttachment(doc, actor.id, actor.operationalRole))) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const body = await deps.privateDocumentStorage.read(doc.storageKey)
      if (!body) {
        res.status(410).json({ error: 'document_unavailable' })
        return
      }
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
}
