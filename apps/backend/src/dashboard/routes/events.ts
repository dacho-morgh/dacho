// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { canActOnEvent, canManageEvents } from '../../access/events.js'
import { isInternalOperationalRole, operationalRoleOf } from '../../access/roles.js'
import { isEventId } from '../event-repo.js'
import { actorOf } from '../proxy-auth.js'
import type { User } from '../../auth/user-store.js'
import { isUuid } from '../../exhibitions/catalogue.js'
import { parseEventRevision, parseEventReason, normalizeEventInput, eventWithActions, ineligibleResponsibleField } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerEventRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, eventStore, categoryStore } = ctx

  router.get('/admin/events', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const events = await eventStore.list()
    const items = events
      .filter((event) => canActOnEvent(actor.operationalRole, actor.id, event, 'read'))
      .map((event) => eventWithActions(actor.operationalRole, actor.id, event))
    res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/admin/events/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    if (!isEventId(req.params.id)) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const event = await eventStore.findById(req.params.id)
    if (!event || !canActOnEvent(actor.operationalRole, actor.id, event, 'read')) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ event: eventWithActions(actor.operationalRole, actor.id, event) })
    } catch (error) { next(error) }
  })

  router.post('/admin/events', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!canManageEvents(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const parsed = normalizeEventInput(req.body)
    if (!parsed.ok) {
      res.status(400).json(
        parsed.error === 'invalid_event'
          ? { error: parsed.error, fields: parsed.fields }
          : { error: parsed.error },
      )
      return
    }
    const ineligible = await ineligibleResponsibleField(deps.userStore, parsed.input)
    if (ineligible) {
      res.status(400).json({ error: 'ineligible_responsible_person', field: ineligible })
      return
    }
    const event = await eventStore.create({ ...parsed.input, createdBy: actor.id })
    res.status(201).json({ event: eventWithActions(actor.operationalRole, actor.id, event) })
    } catch (error) { next(error) }
  })

  router.patch('/admin/events/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!canManageEvents(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    if (!isEventId(req.params.id)) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const existing = await eventStore.findById(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const revision = parseEventRevision(req.body)
    if (revision === null) {
      res.status(400).json({ error: 'invalid_event', fields: ['revision'] })
      return
    }
    const reason = parseEventReason(req.body)
    if (reason === null) {
      res.status(400).json({ error: 'invalid_event', fields: ['reason'] })
      return
    }
    if (existing.revision !== revision) {
      res.status(409).json({ error: 'stale_event', revision: existing.revision })
      return
    }
    const parsed = normalizeEventInput(req.body, existing)
    if (!parsed.ok) {
      res.status(400).json(
        parsed.error === 'invalid_event'
          ? { error: parsed.error, fields: parsed.fields }
          : { error: parsed.error },
      )
      return
    }
    const ineligible = await ineligibleResponsibleField(deps.userStore, parsed.input)
    if (ineligible) {
      res.status(400).json({ error: 'ineligible_responsible_person', field: ineligible })
      return
    }
    const updated = await eventStore.update(existing.id, {
      ...parsed.input,
      expectedRevision: revision,
      actorId: actor.id,
      reason,
    })
    if (!updated.ok) {
      if (updated.error === 'stale') {
        res.status(409).json({ error: 'stale_event', revision: updated.event.revision })
        return
      }
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ event: eventWithActions(actor.operationalRole, actor.id, updated.event) })
    } catch (error) { next(error) }
  })

  router.post('/admin/events/:eventId/categories', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!canManageEvents(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
      if (!title) {
        res.status(400).json({ error: 'invalid_category' })
        return
      }
      const category = await categoryStore.createCategory(req.params.eventId, title)
      res.status(201).json({ category })
    } catch (error) { next(error) }
  })

  router.get('/admin/events/:eventId/categories', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isInternalOperationalRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event || !canActOnEvent(actor.operationalRole, actor.id, event, 'read')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listCategories(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/events/:eventId/categories', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const admin = actor.operationalRole === 'system-owner' || actor.operationalRole === 'central-secretariat'
      const company = actor.operationalRole === 'representative' && (await deps.companyStore.findByRepresentative(actor.id))
      if (!admin && !company) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listCategories(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.post('/admin/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!canManageEvents(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
      const categoryId = typeof req.body?.categoryId === 'string' ? req.body.categoryId.trim() : ''
      const employerId = typeof req.body?.employerId === 'string' ? req.body.employerId.trim() : ''
      if (!title || !categoryId || !isUuid(categoryId) || !employerId) {
        res.status(400).json({ error: 'invalid_subtopic' })
        return
      }
      const category = await categoryStore.findCategoryById(categoryId)
      if (!category || category.eventId !== req.params.eventId) {
        res.status(400).json({ error: 'invalid_category_event' })
        return
      }
      const user = await deps.userStore.findById(employerId)
      // User and company IDs belong to different collections and may overlap.
      // Resolve the employer as a person; an unrelated company's ID is not evidence of its type.
      if (!user || user.companyId) {
        res.status(400).json({ error: 'ineligible_employer' })
        return
      }
      if (operationalRoleOf(user) !== 'employer-reviewer') {
        res.status(400).json({ error: 'ineligible_employer' })
        return
      }
      const subtopic = await categoryStore.createSubtopic({
        eventId: req.params.eventId,
        categoryId,
        title,
        employerId,
      })
      res.status(201).json({ subtopic })
    } catch (error) { next(error) }
  })

  router.get('/admin/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isInternalOperationalRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event || !canActOnEvent(actor.operationalRole, actor.id, event, 'read')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listSubtopics(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })

  router.get('/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const admin = actor.operationalRole === 'system-owner' || actor.operationalRole === 'central-secretariat'
      const company = actor.operationalRole === 'representative' && (await deps.companyStore.findByRepresentative(actor.id))
      if (!admin && !company) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isUuid(req.params.eventId)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const event = await eventStore.findById(req.params.eventId)
      if (!event) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await categoryStore.listSubtopics(req.params.eventId)
      res.json({ items })
    } catch (error) { next(error) }
  })
}
