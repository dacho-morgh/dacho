// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { canActOnEvent, canManageEvents } from '../../access/events.js'
import { isInternalOperationalRole, operationalRoleOf } from '../../access/roles.js'
import { isEventId } from '../event-repo.js'
import { actorOf } from '../proxy-auth.js'
import { isUuid } from '../../exhibitions/catalogue.js'
import type { PublicRecord } from '../../exhibitions/exhibition-store.js'
import {
  PublicRecordFailure,
  contentErrorBody,
  isPublicRecordId,
  parsePublicContent,
  publicCall,
  undoPublicWrite,
  type PublicWrite,
} from '../../exhibitions/public-content.js'
import { parseEventRevision, parseEventReason, normalizeEventInput, eventWithActions, ineligibleResponsibleField } from './route-helpers.js'
import type { DashboardContext } from './context.js'

const NO_STORE = 'private, no-store, max-age=0'

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === '23505'
}

export function registerEventRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, eventStore, categoryStore, publicRecords } = ctx

  router.get('/admin/events', async (_req, res, next) => {
    try {
    const actor = actorOf(res)
    res.set('Cache-Control', NO_STORE)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const events = await eventStore.list()
    const items = events
      .filter((event) => canActOnEvent(actor.operationalRole, actor.id, event, 'read'))
      .map((event) => eventWithActions(actor.operationalRole, actor.id, event))
    if (!canManageEvents(actor.operationalRole)) {
      res.json({ items })
      return
    }
    // The owner's admin list shows each event's public page, and the CMS events
    // that no dashboard event owns yet so they can be taken over (S5, T60).
    let pages: PublicRecord[]
    try {
      pages = await publicRecords.list('events')
    } catch {
      res.status(503).json({ error: 'public_records_unavailable' })
      return
    }
    const byId = new Map(pages.map((page) => [page.id, page]))
    const linked = new Set(events.map((event) => event.publicEventId).filter(Boolean))
    res.json({
      items: items.map((event) => ({ ...event, public: event.publicEventId ? byId.get(event.publicEventId) ?? null : null })),
      unlinkedPublicEvents: pages.filter((page) => !linked.has(page.id)),
    })
    } catch (error) { next(error) }
  })

  router.get('/admin/events/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    res.set('Cache-Control', NO_STORE)
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
    if (!canManageEvents(actor.operationalRole)) {
      res.json({ event: eventWithActions(actor.operationalRole, actor.id, event) })
      return
    }
    let page: PublicRecord | undefined
    try {
      page = event.publicEventId ? await publicRecords.find('events', event.publicEventId) : undefined
    } catch {
      res.status(503).json({ error: 'public_records_unavailable' })
      return
    }
    res.json({ event: { ...eventWithActions(actor.operationalRole, actor.id, event), public: page ?? null } })
    } catch (error) { next(error) }
  })

  router.post('/admin/events', async (req, res, next) => {
    let write: PublicWrite | undefined
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
    // The public page carries the same title and description as the event.
    const content = parsePublicContent({ ...req.body, title: parsed.input.title, description: parsed.input.description })
    if (!content.ok) {
      res.status(400).json(contentErrorBody(content))
      return
    }
    const ineligible = await ineligibleResponsibleField(deps.userStore, parsed.input)
    if (ineligible) {
      res.status(400).json({ error: 'ineligible_responsible_person', field: ineligible })
      return
    }
    // An existing CMS event without a dashboard event may be taken over instead of
    // creating a second public page for the same event.
    const adoptId = typeof req.body?.publicEventId === 'string' ? req.body.publicEventId.trim() : ''
    let adopted: PublicRecord | undefined
    if (adoptId) {
      if (!isPublicRecordId(adoptId)) {
        res.status(404).json({ error: 'public_event_not_found' })
        return
      }
      try {
        adopted = await publicRecords.find('events', adoptId)
      } catch {
        res.status(502).json({ error: 'public_record_failed' })
        return
      }
      if (!adopted) {
        res.status(404).json({ error: 'public_event_not_found' })
        return
      }
      if (await eventStore.findByPublicEventId(adoptId)) {
        res.status(409).json({ error: 'public_event_linked' })
        return
      }
    }
    let page: PublicRecord | undefined
    let event
    try {
      event = await eventStore.create({ ...parsed.input, createdBy: actor.id }, async () => {
        page = await publicCall(() => adopted
          ? publicRecords.update('events', adopted.id, content.value)
          : publicRecords.create('events', content.value))
        if (!page) throw new PublicRecordFailure('missing')
        write = adopted ? { kind: 'updated', id: page.id, previous: adopted } : { kind: 'created', id: page.id }
        return page.id
      })
    } catch (error) {
      if (error instanceof PublicRecordFailure) {
        res.status(error.reason === 'missing' ? 404 : 502).json({
          error: error.reason === 'missing' ? 'public_event_not_found' : 'public_record_failed',
        })
        return
      }
      throw error
    }
    res.status(201).json({ event: { ...eventWithActions(actor.operationalRole, actor.id, event), public: page ?? null } })
    } catch (error) {
      if (write) await undoPublicWrite(publicRecords, 'events', write)
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: 'public_event_linked' })
        return
      }
      next(error)
    }
  })

  router.patch('/admin/events/:id', async (req, res, next) => {
    let write: PublicWrite | undefined
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
    let currentPage: PublicRecord | undefined
    try {
      currentPage = existing.publicEventId ? await publicRecords.find('events', existing.publicEventId) : undefined
    } catch {
      res.status(502).json({ error: 'public_record_failed' })
      return
    }
    // An event made before S5 has no public page; this save creates it, so the
    // public fields are required then.
    const content = parsePublicContent(
      { ...req.body, title: parsed.input.title, description: parsed.input.description },
      currentPage,
    )
    if (!content.ok) {
      res.status(400).json(contentErrorBody(content))
      return
    }
    const ineligible = await ineligibleResponsibleField(deps.userStore, parsed.input)
    if (ineligible) {
      res.status(400).json({ error: 'ineligible_responsible_person', field: ineligible })
      return
    }
    let page: PublicRecord | undefined
    let updated
    try {
      updated = await eventStore.update(existing.id, {
        ...parsed.input,
        expectedRevision: revision,
        actorId: actor.id,
        reason,
      }, async () => {
        page = currentPage
          ? await publicCall(() => publicRecords.update('events', currentPage!.id, content.value))
          : undefined
        if (page && currentPage) {
          write = { kind: 'updated', id: page.id, previous: currentPage }
        } else {
          // The page was removed in the CMS meanwhile, or never existed: make it again.
          page = await publicCall(() => publicRecords.create('events', content.value))
          write = { kind: 'created', id: page.id }
        }
        return page.id
      })
    } catch (error) {
      if (error instanceof PublicRecordFailure) {
        res.status(502).json({ error: 'public_record_failed' })
        return
      }
      throw error
    }
    if (!updated.ok) {
      if (updated.error === 'stale') {
        res.status(409).json({ error: 'stale_event', revision: updated.event.revision })
        return
      }
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ event: { ...eventWithActions(actor.operationalRole, actor.id, updated.event), public: page ?? null } })
    } catch (error) {
      if (write) await undoPublicWrite(publicRecords, 'events', write)
      next(error)
    }
  })

  /** Events a company can apply to, keyed by their public page (S5). */
  router.get('/events', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      res.set('Cache-Control', NO_STORE)
      const admin = actor.operationalRole === 'system-owner' || actor.operationalRole === 'central-secretariat'
      const company = actor.operationalRole === 'representative' && (await deps.companyStore.findByRepresentative(actor.id))
      if (!admin && !company) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const events = await eventStore.list()
      res.json({
        items: events
          .filter((event) => event.publicEventId)
          .map((event) => ({
            id: event.id,
            publicEventId: event.publicEventId,
            title: event.title,
            registrationOpenAt: event.registrationOpenAt,
            registrationCloseAt: event.registrationCloseAt,
          })),
      })
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
