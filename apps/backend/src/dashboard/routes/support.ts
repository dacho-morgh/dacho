// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { actorOf } from '../proxy-auth.js'
import { parsePositiveInt, isRepresentative, isCompanyAdministrator, resolveRequesterNames } from './route-helpers.js'
import type { DashboardContext } from './context.js'

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
      : await support.list({ requesterId: actor.id, page: parsePositiveInt(req.query.page, 1), limit: parsePositiveInt(req.query.limit, 25) })
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
    res.status(201).json({ ticket: await support.create({ requesterId: actor.id, subject, message }) })
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
    res.json({ ticket: { ...ticket, requesterName: requesterNames.get(ticket.requesterId) ?? 'شرکت متقاضی' } })
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
