// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import type { Response } from 'express'
import { operationalRoleOf, type OperationalRole } from '../../access/roles.js'
import type { ReplaceSlotResult, ReviewRoundDto, RoundStartContext } from '../review-round-repo.js'
import { isReviewerRole, parseQueueView } from '../review-case-repo.js'
import { actorOf } from '../proxy-auth.js'
import type { EvaluationDto } from '../../reviews/evaluation-repo.js'
import { ROUND_REQUIRED_EVALUATIONS } from '../../reviews/round-completion.js'
import { validateAndScoreReview } from '../../reviews/scoring.js'
import { parsePositiveInt, parseRevisionQuery, withDownloadUrls, parseExpectedRevision, parseOptionalReason, resolveUserNames } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerReviewRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, repo, assignments, rounds, reviewCases, evaluations, resolveScope, refuseCommand } = ctx

  /** Reviewer and employer inbox, fed only by the actor's active server-side assignments. */
  router.get('/review/queue', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isReviewerRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const view = parseQueueView(req.query.view)
      if (!view) {
        res.status(400).json({ error: 'invalid_view' })
        return
      }
      const queue = await reviewCases.listQueue(
        { id: actor.id, role: actor.operationalRole },
        { view, page: Math.min(parsePositiveInt(req.query.page, 1), 1_000_000), limit: Math.min(parsePositiveInt(req.query.limit, 25), 100) },
      )
      res.set('Cache-Control', 'private, no-store, max-age=0').json(queue)
    } catch (error) { next(error) }
  })

  /**
   * The assigned case file: the reviewed proposal revision with its pinned files,
   * the pinned RFP and the necessary company profile. Another reviewer's work, the
   * round roster, financial files and the private dossier are not part of it.
   */
  router.get('/review/cases/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isReviewerRole(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const found = await reviewCases.findCase({ id: actor.id, role: actor.operationalRole }, req.params.id)
      if (!found) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      await assignments.markViewed(found.case.requestId, actor.id, actor.operationalRole)
      res.set('Cache-Control', 'private, no-store, max-age=0').json({
        ...found,
        ...withDownloadUrls(found.case.requestId, found),
      })
    } catch (error) { next(error) }
  })

  /* ── Investment queue and dossier (T31) ────────────────────────────── */

  /**
   * The employer for this case: the owner's last substitute (T26) while that
   * person is still a usable employer-reviewer, otherwise the subtopic's own.
   */
  const roundEmployerOf = async (context: RoundStartContext): Promise<string | null> => {
    for (const id of [context.replacementEmployerId, context.employerId]) {
      if (!id) continue
      const user = await deps.userStore.findById(id).catch(() => undefined)
      if (user && operationalRoleOf(user) === 'employer-reviewer') return id
    }
    return null
  }

  const replaceSlotResponse = (res: Response, result: ReplaceSlotResult) => {
    if (typeof result === 'object') { res.json({ round: result.round }); return }
    const rejected: Record<Exclude<ReplaceSlotResult, { round: unknown }>, [number, string]> = {
      not_found: [404, 'not_found'],
      forbidden: [403, 'forbidden'],
      invalid_state: [409, 'invalid_round_state'],
      stale_revision: [409, 'stale_revision'],
      no_round: [409, 'round_not_started'],
      not_assigned: [404, 'not_assigned'],
      evaluation_final: [409, 'evaluation_final'],
      already_assigned: [409, 'already_assigned'],
      previously_assigned: [409, 'previously_assigned'],
    }
    const [status, error] = rejected[result]
    res.status(status).json({ error })
  }

  /** Reviewers the responsible chief may pick: active ordinary reviewers, never other roles. */
  router.get('/requests/:id/review-round/candidates', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      if (context.responsibleChiefId !== actor.id) { await refuseCommand(res, actor, req.params.id); return }
      const users = await deps.userStore.list({ operationalRole: 'reviewer' })
      // Once a round exists for the current revision the list serves replacement:
      // nobody who already held a slot of it returns. An earlier revision's round
      // does not narrow the pick for a new round.
      const latest = await rounds.findLatest(req.params.id)
      const current = latest && latest.requestRevision === context.revision ? latest : null
      const seen = new Set(current?.slots.map((slot) => slot.userId) ?? [])
      const employerId = current?.employerId ?? (await roundEmployerOf(context)) ?? context.employerId
      const items = users
        .filter((user) => operationalRoleOf(user) === 'reviewer' && user.id !== employerId && !seen.has(user.id))
        .map((user) => ({ id: user.id, name: user.name ?? null }))
      res.json({ items, employerId })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/review-round', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) { res.status(400).json({ error: 'invalid_revision' }); return }
      const rawReviewers: unknown = req.body?.reviewerIds
      const reviewerIds = Array.isArray(rawReviewers)
        ? rawReviewers.map((value) => (typeof value === 'string' ? value.trim() : ''))
        : []
      if (reviewerIds.length !== 3 || reviewerIds.some((id) => !id)) {
        res.status(400).json({ error: 'three_reviewers_required' })
        return
      }

      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      if (context.responsibleChiefId !== actor.id) { await refuseCommand(res, actor, req.params.id); return }

      // Four distinct active people: the case's employer plus three other reviewers.
      const employerId = await roundEmployerOf(context)
      if (!employerId) {
        res.status(409).json({ error: 'employer_unavailable' })
        return
      }
      if (new Set([...reviewerIds, employerId]).size !== 4) {
        res.status(400).json({ error: 'duplicate_people' })
        return
      }
      for (const reviewerId of reviewerIds) {
        const reviewer = await deps.userStore.findById(reviewerId).catch(() => undefined)
        if (!reviewer || operationalRoleOf(reviewer) !== 'reviewer') {
          res.status(400).json({ error: 'reviewer_not_eligible', userId: reviewerId })
          return
        }
      }

      const result = await rounds.start({
        requestId: req.params.id,
        actorId: actor.id,
        employerId,
        reviewerIds,
        expectedRevision: revision,
      })
      if (typeof result === 'object') { res.status(201).json({ round: result.round }); return }
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'forbidden') { res.status(403).json({ error: 'forbidden' }); return }
      if (result === 'invalid_state') { res.status(409).json({ error: 'invalid_round_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      if (result === 'round_exists') { res.status(409).json({ error: 'round_already_started' }); return }
      res.status(409).json({ error: result })
    } catch (error) { next(error) }
  })

  /**
   * Adds each slot holder's display name for the reviewers list (#288). Accounts
   * carry no picture, so `avatarUrl` is always null and the page draws initials.
   * Callers pass only rounds and slots the reader may already see.
   */
  const withSlotPeople = async (items: ReviewRoundDto[]) => {
    const names = await resolveUserNames(deps.userStore, items.flatMap((round) => round.slots.map((slot) => slot.userId)))
    return items.map((round) => ({
      ...round,
      slots: round.slots.map((slot) => ({ ...slot, name: names.get(slot.userId) ?? null, avatarUrl: null })),
    }))
  }

  /**
   * Oversight (owner, Secretariat, the case's chief) sees all four slots; an
   * assigned reviewer or employer sees only their own slot, never who else was
   * picked. Companies and investment people have no part in a review round.
   */
  router.get('/requests/:id/review-round', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role === 'representative' || role === 'investment-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) { res.status(404).json({ error: 'not_found' }); return }
      const round = await rounds.findLatest(request.id)
      if (!round) { res.json({ round: null }); return }
      if (role === 'reviewer' || role === 'employer-reviewer') {
        const mine = round.slots.find((slot) => slot.userId === actor.id && slot.active)
        if (!mine) { res.status(404).json({ error: 'not_found' }); return }
        const { id, requestId, requestRevision, proposalRevision, startedAt } = round
        const [own] = await withSlotPeople([{ ...round, slots: [mine] }])
        res.json({ round: { id, requestId, requestRevision, proposalRevision, startedAt, slots: own!.slots } })
        return
      }
      res.json({ round: (await withSlotPeople([round]))[0] })
    } catch (error) { next(error) }
  })

  /** Every round of the case with its decision, for the people who oversee it. */
  router.get('/requests/:id/review-rounds', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role !== 'system-owner' && role !== 'central-secretariat' && role !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) { res.status(404).json({ error: 'not_found' }); return }
      res.json({ items: await withSlotPeople(await rounds.listForRequest(request.id)) })
    } catch (error) { next(error) }
  })

  /* ── Replacing a round slot (T26) ───────────────────────────────────── */

  /** The responsible chief replaces an ordinary reviewer who has not finalized. */
  router.post('/requests/:id/review-round/reviewers/:userId/replace', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) { res.status(400).json({ error: 'invalid_revision' }); return }
      const replacementId = typeof req.body?.replacementId === 'string' ? req.body.replacementId.trim() : ''
      if (!replacementId) { res.status(400).json({ error: 'replacement_required' }); return }
      const reason = parseOptionalReason(req.body?.reason)
      if (reason === false) { res.status(400).json({ error: 'invalid_reason' }); return }

      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      if (context.responsibleChiefId !== actor.id) { await refuseCommand(res, actor, req.params.id); return }
      if (replacementId === req.params.userId) { res.status(400).json({ error: 'duplicate_people' }); return }
      const incoming = await deps.userStore.findById(replacementId).catch(() => undefined)
      if (!incoming || operationalRoleOf(incoming) !== 'reviewer') {
        res.status(400).json({ error: 'reviewer_not_eligible', userId: replacementId })
        return
      }
      replaceSlotResponse(res, await rounds.replaceSlot({
        requestId: req.params.id,
        actorId: actor.id,
        slot: 'ordinary',
        outgoingUserId: req.params.userId,
        incomingUserId: replacementId,
        reason,
        expectedRevision: revision,
        authority: 'chief',
      }))
    } catch (error) { next(error) }
  })

  /** Employers the owner may put in place of the case's current one. */
  router.get('/requests/:id/review-round/employer-candidates', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const round = await rounds.findLatest(req.params.id)
      if (!round) { res.status(404).json({ error: 'not_found' }); return }
      const seen = new Set(round.slots.map((slot) => slot.userId))
      const users = await deps.userStore.list({ operationalRole: 'employer-reviewer' })
      const items = users
        .filter((user) => operationalRoleOf(user) === 'employer-reviewer' && !seen.has(user.id))
        .map((user) => ({ id: user.id, name: user.name ?? null }))
      res.json({ items, employerId: round.employerId })
    } catch (error) { next(error) }
  })

  /** Only the system owner changes a case's employer, and always with a reason. */
  router.post('/requests/:id/review-round/employer/replace', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) { res.status(400).json({ error: 'invalid_revision' }); return }
      const employerId = typeof req.body?.employerId === 'string' ? req.body.employerId.trim() : ''
      if (!employerId) { res.status(400).json({ error: 'replacement_required' }); return }
      const reason = parseOptionalReason(req.body?.reason)
      if (reason === false) { res.status(400).json({ error: 'invalid_reason' }); return }
      if (reason === null) { res.status(400).json({ error: 'reason_required' }); return }

      const context = await rounds.findStartContext(req.params.id)
      if (!context) { res.status(404).json({ error: 'not_found' }); return }
      const incoming = await deps.userStore.findById(employerId).catch(() => undefined)
      if (!incoming || operationalRoleOf(incoming) !== 'employer-reviewer') {
        res.status(400).json({ error: 'employer_not_eligible', userId: employerId })
        return
      }
      replaceSlotResponse(res, await rounds.replaceSlot({
        requestId: req.params.id,
        actorId: actor.id,
        slot: 'employer',
        incomingUserId: employerId,
        reason,
        expectedRevision: revision,
        authority: 'owner',
      }))
    } catch (error) { next(error) }
  })

  async function currentCompletion(requestId: string, items: EvaluationDto[]): Promise<number> {
    const active = (await assignments.listForRequest(requestId)).filter((item) => item.active)
    return items.filter((item) => item.state === 'final' && active.some(
      (assignment) => assignment.userId === item.userId && assignment.role === item.role,
    )).length
  }

  function oversightEvaluation(item: EvaluationDto) {
    if (item.state === 'final') return item
    // Unfinished answer content is visible only to its author, including for owner oversight.
    const { id, requestId, userId, role, variant, state, revision, createdAt, updatedAt, finalizedAt } = item
    return { id, requestId, userId, role, variant, state, revision, createdAt, updatedAt, finalizedAt }
  }

  router.get('/requests/:id/evaluation', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'reviewer' && actor.operationalRole !== 'employer-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!await assignments.activeFor(request.id, actor.id, actor.operationalRole)) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      // The revision this person's round reviews: a decided case has moved past it.
      const revision = await reviewCases.reviewedRequestRevision(
        request.id, { id: actor.id, role: actor.operationalRole },
      ) ?? request.revision
      // Own evaluation only: how far the other three are is not a reviewer's to see.
      const evaluation = await evaluations.findByRequestAndUser(request.id, actor.id, revision)
      res.json({ evaluation, revision })
    } catch (error) { next(error) }
  })

  router.put('/requests/:id/evaluation', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'reviewer' && actor.operationalRole !== 'employer-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!await assignments.activeFor(request.id, actor.id, actor.operationalRole)) {
        await refuseCommand(res, actor, request.id)
        return
      }
      if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 1) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      if (req.body.revision !== request.revision || request.status !== 'in_review') {
        res.status(409).json({ error: 'stale_evaluation' })
        return
      }
      const variant = actor.operationalRole === 'employer-reviewer' ? 'employer' : 'ordinary'
      const scores = req.body?.scores ?? {}
      const answers = req.body?.answers ?? {}
      const validation = validateAndScoreReview({
        variant,
        state: 'draft',
        scores,
        answers,
        ...(req.body?.calculatedScores ? { calculatedScores: req.body.calculatedScores } : {}),
      })
      if (!validation.valid) {
        res.status(400).json({ error: 'validation_failed', errors: validation.errors })
        return
      }
      const revision = request.revision
      const result = await evaluations.saveDraft({
        requestId: request.id,
        userId: actor.id,
        role: actor.operationalRole,
        variant,
        revision,
        scores,
        scoreA: validation.scores.a,
        scoreB: validation.scores.b,
        scoreC: validation.scores.c,
        weightedHundredths: validation.scores.weightedHundredths,
        answers,
      })
      if (!result.ok) {
        res.status(result.reason === 'forbidden' ? 403 : 409).json({
          error: result.reason === 'locked' ? 'evaluation_locked' : result.reason === 'forbidden' ? 'forbidden' : 'stale_evaluation',
        })
        return
      }
      res.json({ evaluation: result.evaluation })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/evaluation/finalize', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'reviewer' && actor.operationalRole !== 'employer-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!await assignments.activeFor(request.id, actor.id, actor.operationalRole)) {
        await refuseCommand(res, actor, request.id)
        return
      }
      if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 1) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      if (req.body.revision !== request.revision || request.status !== 'in_review') {
        res.status(409).json({ error: 'stale_evaluation' })
        return
      }
      const variant = actor.operationalRole === 'employer-reviewer' ? 'employer' : 'ordinary'
      const scores = req.body?.scores ?? {}
      const answers = req.body?.answers ?? {}
      const validation = validateAndScoreReview({
        variant,
        state: 'final',
        scores,
        answers,
        ...(req.body?.calculatedScores ? { calculatedScores: req.body.calculatedScores } : {}),
      })
      if (!validation.valid) {
        res.status(400).json({ error: 'validation_failed', errors: validation.errors })
        return
      }
      const revision = request.revision
      const result = await evaluations.finalize({
        requestId: request.id,
        userId: actor.id,
        role: actor.operationalRole,
        variant,
        revision,
        scores,
        scoreA: validation.scores.a,
        scoreB: validation.scores.b,
        scoreC: validation.scores.c,
        weightedHundredths: validation.scores.weightedHundredths,
        answers,
      })
      if (!result.ok) {
        res.status(result.reason === 'forbidden' ? 403 : 409).json({
          error: result.reason === 'locked' ? 'evaluation_locked' : result.reason === 'forbidden' ? 'forbidden' : 'stale_evaluation',
        })
        return
      }
      res.json({ evaluation: result.evaluation })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/evaluations', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const allowedRoles: OperationalRole[] = ['system-owner', 'chief-reviewer', 'central-secretariat']
      if (!allowedRoles.includes(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const request = await repo.findByIdAny(req.params.id)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (actor.operationalRole === 'chief-reviewer' &&
          !await assignments.activeFor(request.id, actor.id, 'chief-reviewer')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      // The current revision by default; `revision` reads the evaluations of a past round.
      const requested = req.query.revision === undefined ? request.revision : parseRevisionQuery(req.query.revision)
      if (requested === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const items = await evaluations.listForRequest(request.id, requested)
      const round = await rounds.findByRevision(request.id, requested)
      const completedCount = requested === request.revision
        ? await currentCompletion(request.id, items)
        : round?.completion.finalized ?? 0
      res.json({
        items: items.map(oversightEvaluation),
        revision: requested,
        completedCount,
        requiredCount: ROUND_REQUIRED_EVALUATIONS,
        readyForChiefDecision: round?.completion.ready ?? false,
      })
    } catch (error) { next(error) }
  })
}
