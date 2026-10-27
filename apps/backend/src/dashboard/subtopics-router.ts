import { Router } from 'express'
import type { Pool } from 'pg'
import type { UserStore } from '../auth/user-store.js'
import type { CompanyStore } from '../auth/company-store.js'
import { operationalRoleOf } from '../access/roles.js'
import { actorOf } from './proxy-auth.js'
import { isUuid } from '../db/uuid.js'

interface Deps { pool: Pool; userStore: UserStore; companyStore: CompanyStore }
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const subtopicColumns = 'id, event_id AS "eventId", category_id AS "categoryId", title, employer_id AS "employerId"'

export function createSubtopicRouter({ pool, userStore, companyStore }: Deps): Router {
  const router = Router()
  router.get('/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const admin = actor.operationalRole === 'system-owner' || actor.operationalRole === 'central-secretariat'
      const company = actor.operationalRole === 'representative' && await companyStore.findByRepresentative(actor.id)
      if (!admin && !company) { res.status(404).json({ error: 'not_found' }); return }
      if (!isUuid(req.params.eventId)) { res.status(404).json({ error: 'not_found' }); return }
      const { rows } = await pool.query(`SELECT s.id, s.event_id AS "eventId", s.category_id AS "categoryId",
        c.title AS "categoryTitle", s.title, s.employer_id AS "employerId", s.current_rfp_version_id AS "currentRfpVersionId"
        FROM dashboard.subtopics s JOIN dashboard.technology_categories c ON c.id=s.category_id
        WHERE s.event_id=$1 ORDER BY c.title,s.title,s.id`, [req.params.eventId])
      res.set('Cache-Control', 'private, no-store').json({ items: rows })
    } catch (error) { next(error) }
  })
  router.use('/admin/events/:eventId/categories', (_req, res, next) => {
    if (actorOf(res).operationalRole !== 'system-owner') { res.status(403).json({ error: 'forbidden' }); return }
    next()
  })
  router.use('/admin/events/:eventId/subtopics', (_req, res, next) => {
    if (actorOf(res).operationalRole !== 'system-owner') { res.status(403).json({ error: 'forbidden' }); return }
    next()
  })
  router.get('/admin/events/:eventId/categories', async (req, res, next) => {
    try {
      if (!isUuid(req.params.eventId)) { res.status(404).json({ error: 'not_found' }); return }
      const { rows } = await pool.query('SELECT id, event_id AS "eventId", title FROM dashboard.technology_categories WHERE event_id = $1 ORDER BY title, id', [req.params.eventId])
      res.json({ items: rows })
    } catch (error) { next(error) }
  })
  router.post('/admin/events/:eventId/categories', async (req, res, next) => {
    try {
      const eventId = req.params.eventId
      const title = text(req.body?.title)
      if (!title) { res.status(400).json({ error: 'invalid_category' }); return }
      if (!isUuid(eventId)) { res.status(404).json({ error: 'not_found' }); return }
      const { rows } = await pool.query(`INSERT INTO dashboard.technology_categories (event_id, title)
        SELECT id, $2 FROM dashboard.events WHERE id = $1
        RETURNING id, event_id AS "eventId", title`, [eventId, title])
      if (!rows[0]) { res.status(404).json({ error: 'not_found' }); return }
      res.status(201).json({ category: rows[0] })
    } catch (error) { next(error) }
  })
  router.post('/admin/events/:eventId/subtopics', async (req, res, next) => {
    try {
      const eventId = req.params.eventId
      const title = text(req.body?.title)
      const categoryId = text(req.body?.categoryId)
      const employerId = text(req.body?.employerId)
      if (!title || !isUuid(categoryId) || !employerId) { res.status(400).json({ error: 'invalid_subtopic' }); return }
      if (!isUuid(eventId)) { res.status(404).json({ error: 'not_found' }); return }
      const employer = await userStore.findById(employerId)
      if (operationalRoleOf(employer) !== 'employer-reviewer') { res.status(400).json({ error: 'ineligible_employer' }); return }
      const { rows } = await pool.query(`INSERT INTO dashboard.subtopics (event_id, category_id, title, employer_id)
        SELECT event_id, id, $3, $4 FROM dashboard.technology_categories WHERE id = $2 AND event_id = $1
        RETURNING ${subtopicColumns}`, [eventId, categoryId, title, employerId])
      if (!rows[0]) { res.status(400).json({ error: 'invalid_category_event' }); return }
      res.status(201).json({ subtopic: rows[0] })
    } catch (error) { next(error) }
  })
  router.get('/admin/events/:eventId/subtopics', async (req, res, next) => {
    try {
      if (!isUuid(req.params.eventId)) { res.status(404).json({ error: 'not_found' }); return }
      const { rows } = await pool.query(`SELECT ${subtopicColumns} FROM dashboard.subtopics WHERE event_id = $1 ORDER BY title, id`, [req.params.eventId])
      res.json({ items: rows })
    } catch (error) { next(error) }
  })
  return router
}
