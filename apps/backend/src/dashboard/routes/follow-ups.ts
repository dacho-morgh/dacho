// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import type { Response } from 'express'
import { isFinancialStageOpen } from '../../access/policy.js'
import type { OperationalRole } from '../../access/roles.js'
import { MAX_RESULT_LENGTH, MAX_SUPPLEMENTARY_REQUEST_LENGTH } from '../secretariat-follow-up-repo.js'
import { actorOf } from '../proxy-auth.js'
import { isUuid } from '../../exhibitions/catalogue.js'
import { parsePositiveInt, resolveRequesterNames } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerFollowUpRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, repo, assignments, investmentMemos, followUps, resolveScope, withAuthorNames } = ctx

  const isFollowUpReader = (role: OperationalRole) => role === 'central-secretariat' || role === 'system-owner'

  /** Answers a closed command, so each route only handles its own success statuses. */
  const respondClosed = (res: Response, status: 'not_found' | 'stage_closed' | 'memo_not_sent' | 'stale_version') => {
    if (status === 'not_found') res.status(404).json({ error: 'not_found' })
    else if (status === 'stage_closed') res.status(409).json({ error: 'investment_stage_closed' })
    else if (status === 'memo_not_sent') res.status(409).json({ error: 'memo_not_sent' })
    else res.status(409).json({ error: 'result_version_stale' })
  }

  /** The Secretariat's queue: cases with a sent memo, those without a published result first. */
  router.get('/investment/follow-ups', async (req, res, next) => {
    try {
      if (!isFollowUpReader(actorOf(res).operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const list = await followUps.listFollowUps({
        page: Math.min(parsePositiveInt(req.query.page, 1), 1_000_000),
        limit: Math.min(parsePositiveInt(req.query.limit, 25), 100),
      })
      res.set('Cache-Control', 'private, no-store, max-age=0').json(list)
    } catch (error) { next(error) }
  })

  /** Everything the Secretariat works from on one case. Only the Secretariat may act on it. */
  router.get('/requests/:id/follow-up', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (!isFollowUpReader(role)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const found = await repo.findByIdScoped(req.params.id, scope)
      if (!found) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const [memos, requests, files, results, published] = await Promise.all([
        investmentMemos.listForRequest(found.id, { includeDrafts: role === 'system-owner' }),
        followUps.listSupplementaryRequests(found.id),
        followUps.listCaseFiles(found.id),
        followUps.listResultVersions(found.id),
        followUps.findPublished(found.id),
      ])
      const names = await resolveRequesterNames(deps.userStore, results.flatMap((item) => [item.authorId, item.publishedBy ?? item.authorId]))
      res.set('Cache-Control', 'private, no-store, max-age=0').json({
        stageOpen: isFinancialStageOpen(found.status, found.reviewStage),
        canAct: role === 'central-secretariat',
        memos: await withAuthorNames(memos),
        supplementaryRequests: requests,
        files,
        results: results.map((item) => ({
          ...item,
          authorName: names.get(item.authorId) ?? null,
          publishedByName: item.publishedBy ? names.get(item.publishedBy) ?? null : null,
        })),
        published,
      })
    } catch (error) { next(error) }
  })

  /** Asks the company for more documents. This is correspondence and publishes nothing. */
  router.post('/requests/:id/supplementary-requests', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'central-secretariat') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
      if (!body || body.length > MAX_SUPPLEMENTARY_REQUEST_LENGTH) {
        res.status(400).json({ error: 'invalid_supplementary_request', maxLength: MAX_SUPPLEMENTARY_REQUEST_LENGTH })
        return
      }
      const result = await followUps.requestDocuments({
        requestId: req.params.id,
        actorId: actor.id,
        actorName: actor.user.name ?? null,
        actorRole: actor.operationalRole,
        body,
      })
      if (result.status === 'created' || result.status === 'unchanged') {
        res.status(result.status === 'created' ? 201 : 200).json({ supplementaryRequest: result.request })
        return
      }
      respondClosed(res, result.status)
    } catch (error) { next(error) }
  })

  /** What was asked of the company on its own case; also open to the Secretariat and the owner. */
  router.get('/requests/:id/supplementary-requests', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (!isFollowUpReader(role) && role !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const found = await repo.findByIdScoped(req.params.id, scope)
      if (!found) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const items = await followUps.listSupplementaryRequests(found.id)
      res.set('Cache-Control', 'private, no-store, max-age=0').json({
        items: items.map(({ id, body, createdAt }) => ({ id, body, createdAt })),
      })
    } catch (error) { next(error) }
  })

  /** Opens one of the case's correspondence files to the investment person holding the case. */
  router.post('/requests/:id/supplementary-files', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'central-secretariat') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const documentId = typeof req.body?.documentId === 'string' ? req.body.documentId : ''
      if (!isUuid(documentId)) {
        res.status(400).json({ error: 'invalid_document_id' })
        return
      }
      const result = await followUps.deliverFile({ requestId: req.params.id, actorId: actor.id, documentId })
      if (result.status === 'delivered' || result.status === 'already_delivered') {
        res.status(result.status === 'delivered' ? 201 : 200).json({ file: result.file })
        return
      }
      respondClosed(res, result.status)
    } catch (error) { next(error) }
  })

  /** Saves the company-facing text as a new version. Nothing reaches the company here. */
  router.post('/requests/:id/result', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'central-secretariat') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
      if (!body || body.length > MAX_RESULT_LENGTH) {
        res.status(400).json({ error: 'invalid_result', maxLength: MAX_RESULT_LENGTH })
        return
      }
      const result = await followUps.saveResult({ requestId: req.params.id, actorId: actor.id, body })
      if (result.status === 'saved' || result.status === 'unchanged') {
        res.status(result.status === 'saved' ? 201 : 200).json({ result: result.result })
        return
      }
      respondClosed(res, result.status)
    } catch (error) { next(error) }
  })

  /** The explicit publication. A repeated publish returns the version already published. */
  router.post('/requests/:id/result/publish', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'central-secretariat') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const version = req.body?.version
      if (!Number.isSafeInteger(version) || version < 1) {
        res.status(400).json({ error: 'invalid_result_version' })
        return
      }
      const result = await followUps.publishResult({ requestId: req.params.id, actorId: actor.id, version })
      if (result.status === 'published' || result.status === 'already_published') {
        res.json({ result: result.result })
        return
      }
      respondClosed(res, result.status)
    } catch (error) { next(error) }
  })

  /** The published text for anyone who can read the case. Drafts and the memo are never here. */
  router.get('/requests/:id/result', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const found = await repo.findByIdScoped(req.params.id, scope)
      if (!found) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ result: await followUps.findPublished(found.id) })
    } catch (error) { next(error) }
  })

  /* ── Review round and the four assignments (T22) ───────────────────── */
}
