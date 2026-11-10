// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { MAX_MEMO_LENGTH, type MemoWriter } from '../investment-memo-repo.js'
import { actorOf } from '../proxy-auth.js'
import { parsePositiveInt, withDownloadUrls } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerInvestmentRoutes(router: Router, ctx: DashboardContext): void {
  const { repo, rounds, investmentCases, investmentMemos, followUps, reviewCases, evaluations, resolveScope, withAuthorNames } = ctx

  /** The investment person holding a case writes its memo; the owner may write one on any handed-off case. */
  const memoWriterOf = (actor: { id: string; operationalRole: string }): MemoWriter | null =>
    actor.operationalRole === 'investment-reviewer' || actor.operationalRole === 'system-owner'
      ? { id: actor.id, role: actor.operationalRole }
      : null

  /** The investment person's inbox: only cases whose package reached them. */
  router.get('/investment/queue', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'investment-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const queue = await investmentCases.listQueue(actor.id, {
        page: Math.min(parsePositiveInt(req.query.page, 1), 1_000_000),
        limit: Math.min(parsePositiveInt(req.query.limit, 25), 100),
      })
      res.set('Cache-Control', 'private, no-store, max-age=0').json(queue)
    } catch (error) { next(error) }
  })

  /**
   * The dossier of a handed-off case: the advanced proposal and RFP, the necessary
   * company profile, the frozen package and the round's final evaluations. Drafts and
   * evaluations of people who left their slot stay out, as they do from the count, and
   * authors stay unnamed. The private verification dossier is not part of it.
   */
  router.get('/investment/cases/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'investment-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const found = await investmentCases.findCase(actor.id, req.params.id)
      if (!found) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const { packageDetail, ...summary } = found
      const materials = await reviewCases.caseMaterials(found.requestId, found.proposalRevision)
      const round = await rounds.findByRevision(found.requestId, found.reviewedRevision)
      const counted = (round?.slots ?? []).filter((slot) => slot.active)
      const reviews = (await evaluations.listForRequest(found.requestId, found.reviewedRevision))
        .filter((item) => item.state === 'final' && counted.some((slot) => slot.userId === item.userId && slot.role === item.role))
        .map(({ userId: _userId, ...item }) => item)
      res.set('Cache-Control', 'private, no-store, max-age=0').json({
        case: summary,
        ...materials,
        ...withDownloadUrls(found.requestId, materials),
        package: {
          ...found.package,
          ...packageDetail,
          documents: packageDetail.documents.map((document) => ({
            ...document,
            downloadUrl: `/api/dashboard/documents/${document.id}/download`,
          })),
        },
        evaluations: reviews,
        memos: await investmentMemos.listForHolder(actor.id, found.requestId),
        supplementaryFiles: await followUps.listDeliveredFiles(found.requestId),
      })
    } catch (error) { next(error) }
  })

  /* ── Investment memo (T32) ─────────────────────────────────────────── */

  /** The writer's memo versions on one case: their own and every sent one, as the dossier lists them. */
  router.get('/investment/cases/:id/memos', async (req, res, next) => {
    try {
      const writer = memoWriterOf(actorOf(res))
      if (!writer) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      if (!(await investmentMemos.canWrite(writer, req.params.id))) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.set('Cache-Control', 'private, no-store, max-age=0').json({
        memos: await investmentMemos.listForHolder(writer.id, req.params.id),
      })
    } catch (error) { next(error) }
  })

  /** The person holding the case (or the owner) saves a new version of the memo. Nothing here decides the case. */
  router.post('/investment/cases/:id/memo', async (req, res, next) => {
    try {
      const writer = memoWriterOf(actorOf(res))
      if (!writer) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
      if (!body || body.length > MAX_MEMO_LENGTH) {
        res.status(400).json({ error: 'invalid_memo', maxLength: MAX_MEMO_LENGTH })
        return
      }
      const result = await investmentMemos.save({ requestId: req.params.id, writer, body })
      switch (result.status) {
        case 'saved':
          res.status(201).json({ memo: result.memo })
          return
        case 'unchanged':
          res.json({ memo: result.memo })
          return
        case 'stage_closed':
          res.status(409).json({ error: 'investment_stage_closed' })
          return
        case 'not_found':
          res.status(404).json({ error: 'not_found' })
          return
      }
    } catch (error) { next(error) }
  })

  /** Sends the writer's latest version to the Secretariat. A repeated send returns the version already sent. */
  router.post('/investment/cases/:id/memo/send', async (req, res, next) => {
    try {
      const writer = memoWriterOf(actorOf(res))
      if (!writer) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const version = req.body?.version
      if (!Number.isSafeInteger(version) || version < 1) {
        res.status(400).json({ error: 'invalid_memo_version' })
        return
      }
      const result = await investmentMemos.send({ requestId: req.params.id, writer, version })
      switch (result.status) {
        case 'sent':
        case 'already_sent':
          res.json({ memo: result.memo })
          return
        case 'stale_version':
          res.status(409).json({ error: 'memo_version_stale' })
          return
        case 'stage_closed':
          res.status(409).json({ error: 'investment_stage_closed' })
          return
        case 'not_found':
          res.status(404).json({ error: 'not_found' })
          return
      }
    } catch (error) { next(error) }
  })

  /** The Secretariat's inbox of sent memos, also open to the owner. */
  router.get('/investment/memos', async (req, res, next) => {
    try {
      const role = actorOf(res).operationalRole
      if (role !== 'central-secretariat' && role !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const list = await investmentMemos.listSent({
        page: Math.min(parsePositiveInt(req.query.page, 1), 1_000_000),
        limit: Math.min(parsePositiveInt(req.query.limit, 25), 100),
      })
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ ...list, items: await withAuthorNames(list.items) })
    } catch (error) { next(error) }
  })

  /** One case's memos: sent versions for the Secretariat, every version for the owner. */
  router.get('/requests/:id/investment-memos', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role !== 'central-secretariat' && role !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const memos = await investmentMemos.listForRequest(request.id, { includeDrafts: role === 'system-owner' })
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ items: await withAuthorNames(memos) })
    } catch (error) { next(error) }
  })

  /* ── Secretariat follow-up and result publication (T33) ─────────────── */
}
