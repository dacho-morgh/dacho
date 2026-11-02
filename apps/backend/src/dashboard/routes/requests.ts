// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import { allowedRequestActions, canRequestAction, isChiefCorrectionStatus, isFinancialStageOpen } from '../../access/policy.js'
import { isCaseAssignmentRole, isInternalOperationalRole, operationalRoleOf, type CaseAssignmentRole } from '../../access/roles.js'
import { isReviewerRole, necessaryCompanyProfile } from '../review-case-repo.js'
import { statementYearPlan } from '../financial-package.js'
import { actorOf } from '../proxy-auth.js'
import { AGREEMENT_TEXTS_APPROVED, CURRENT_EVENT_RULES_VERSION, CURRENT_NON_COMPETE_VERSION, parseApplicationTeam } from '../request-repo.js'
import { isUuid } from '../../exhibitions/catalogue.js'
import { parseRequestFilters, parsePositiveInt, parseRevisionQuery, acceptsAgreementVersion, isRepresentative, isCompanyAdministrator, safeOwner, requestWithActions, parseExpectedRevision, parseDecisionReason, missingRequiredFields } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerRequestRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, repo, activities, assignments, financialPackages, reviewCases, evaluations, verificationStore, actorCompanyId, presentRequests, limitRequest, limitActivities, resolveScope, refuseCommand } = ctx

  router.post('/requests', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'representative_only' })
        return
      }
      const { serviceId, title, answers, eventId, subtopicId, rfpVersionId } = req.body ?? {}

      if (typeof serviceId !== 'string' || serviceId.trim() === '') {
        res.status(400).json({ error: 'invalid_service' })
        return
      }
      if (typeof title !== 'string' || title.trim() === '') {
        res.status(400).json({ error: 'invalid_title' })
        return
      }

      const answersValue = answers === undefined ? {} : answers
      if (typeof answersValue !== 'object' || answersValue === null || Array.isArray(answersValue)) {
        res.status(400).json({ error: 'invalid_answers' })
        return
      }

      const service = await deps.serviceCatalog.findById(serviceId)
      if (!service) {
        res.status(404).json({ error: 'service_not_found' })
        return
      }

      const rfpFields = [eventId, subtopicId, rfpVersionId]
      const hasAnyRfp = rfpFields.some((f) => f !== undefined)
      if (hasAnyRfp) {
        if (!rfpFields.every((f) => typeof f === 'string' && isUuid(f))) {
          res.status(400).json({ error: 'invalid_rfp_context' })
          return
        }
      }

      const companyId = await actorCompanyId(actor.id, actor.operationalRole)
      if (actor.operationalRole === 'representative' && !companyId) {
        res.status(403).json({ error: 'company_required' })
        return
      }
      const request = await repo.create({
        serviceId,
        serviceKey: service.key,
        serviceName: service.title,
        title,
        ownerId: actor.id,
        companyId,
        answers: answersValue as Record<string, unknown>,
        rfp: hasAnyRfp ? { eventId, subtopicId, versionId: rfpVersionId } : undefined,
      })
      res.status(201).json({ request: requestWithActions(actor.operationalRole, actor.id, request, companyId) })
    } catch (error) {
      if (error instanceof Error && error.message === 'stale_rfp') {
        res.status(409).json({ error: 'stale_rfp' })
        return
      }
      if (error instanceof Error && error.message === 'duplicate_subtopic_request') {
        res.status(409).json({ error: 'duplicate_subtopic_request' })
        return
      }
      if (error instanceof Error && error.message === 'invalid_event_subtopic') {
        res.status(400).json({ error: 'invalid_event_subtopic' })
        return
      }
      next(error)
    }
  })

  router.get('/agreements', (_req, res) => {
    res.json({
      agreements: [
        {
          type: 'non_compete',
          version: CURRENT_NON_COMPETE_VERSION,
          title: 'قرارداد عدم رقابت',
          approved: AGREEMENT_TEXTS_APPROVED,
        },
        {
          type: 'event_rules',
          version: CURRENT_EVENT_RULES_VERSION,
          title: 'قوانین رویداد',
          approved: AGREEMENT_TEXTS_APPROVED,
        },
      ],
    })
  })

  router.patch('/requests/:id', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { title, answers } = req.body ?? {}
      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim() === '') {
          res.status(400).json({ error: 'invalid_title' })
          return
        }
      }
      if (answers !== undefined) {
        if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
          res.status(400).json({ error: 'invalid_answers' })
          return
        }
      }
      const companyId = await actorCompanyId(actor.id, actor.operationalRole)
      const result = await repo.updateDraft(req.params.id, actor.id, companyId, {
        title,
        answers,
      })
      if (result === 'not_found') {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (result === 'not_draft') {
        res.status(409).json({ error: 'request_not_draft' })
        return
      }
      res.json({ request: requestWithActions(actor.operationalRole, actor.id, result, companyId) })
    } catch (error) { next(error) }
  })

  router.get('/requests', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const page = parsePositiveInt(req.query.page, 1)
    const limit = parsePositiveInt(req.query.limit, 10)
    const filters = parseRequestFilters(req.query, actor)
    if (typeof filters === 'string') { res.status(400).json({ error: filters }); return }
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const result = await repo.listScoped(scope, { ...filters, status, page, limit })
    res.json({
      ...result,
      items: await Promise.all(
        (await presentRequests(actor, result.items, companyId)).map((item) => limitRequest(actor, item, false)),
      ),
    })
    } catch (error) { next(error) }
  })

  router.get('/admin/requests', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const filters = parseRequestFilters(req.query, actor)
    if (typeof filters === 'string') { res.status(400).json({ error: filters }); return }
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const result = await repo.listScoped(scope, {
      ...filters,
      status,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 25),
    })
    const presented = await presentRequests(actor, result.items)
    const items = await Promise.all(
      presented.map(async (item) => ({
        ...(await limitRequest(actor, item, false)),
        owner: isReviewerRole(actor.operationalRole) ? null : safeOwner(await deps.userStore.findById(item.ownerId)),
      })),
    )
    res.json({ ...result, items })
    } catch (error) { next(error) }
  })

  router.get('/admin/requests/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    if (!isInternalOperationalRole(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    const service = await deps.serviceCatalog.findById(request.serviceId)
    res.json({
      request: await limitRequest(actor, (await presentRequests(actor, [request]))[0]!, true),
      owner: isReviewerRole(actor.operationalRole) ? null : safeOwner(await deps.userStore.findById(request.ownerId)),
      timeline: limitActivities(actor, await activities.listForRequestScoped(request.id, scope)),
      workflow: service?.workflow ?? [],
    })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const service = await deps.serviceCatalog.findById(request.serviceId)
    const timeline = limitActivities(actor, await activities.listForRequestScoped(request.id, scope))
    res.json({
      request: await limitRequest(actor, (await presentRequests(actor, [request], companyId))[0]!, true),
      timeline,
      workflow: service?.workflow ?? [],
      owner: isReviewerRole(actor.operationalRole) ? null : safeOwner(await deps.userStore.findById(request.ownerId)),
    })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/history', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ items: limitActivities(actor, await activities.listForRequestScoped(request.id, scope)) })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/submit', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
    const request = await repo.findByIdScoped(req.params.id, scope)
    if (!request) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    // A representative retrying an already-submitted request gets the stable
    // conflict response even though `allowedActions` no longer advertises
    // `submit`. Other roles are denied by the shared action policy.
    const isCompanyRequest =
      actor.operationalRole === 'representative' &&
      ((request.companyId && companyId && request.companyId === companyId) ||
        (!request.companyId && request.ownerId === actor.id))
    if (isCompanyRequest && request.status !== 'draft') {
      res.status(409).json({ error: 'already_submitted' })
      return
    }
    if (!canRequestAction(actor.operationalRole, request, actor.id, 'submit', companyId)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    const currentVerification = companyId
      ? await verificationStore.findCurrentByCompanyId(companyId)
      : null
    if (currentVerification?.status !== 'approved' ||
        (deps.eventCompanyEligibility && !await deps.eventCompanyEligibility.isVerified(companyId!))) {
      res.status(403).json({ error: 'company_not_verified' })
      return
    }

    const rfpEntry = await deps.pool.query<{ version_id: string; current_rfp_version_id: string | null }>(
      `SELECT c.version_id, s.current_rfp_version_id
       FROM dashboard.request_rfps c
       JOIN dashboard.event_subtopics s ON s.id = c.subtopic_id
       WHERE c.request_id = $1`,
      [request.id],
    )
    if (rfpEntry.rows[0] && rfpEntry.rows[0].version_id !== rfpEntry.rows[0].current_rfp_version_id) {
      res.status(409).json({ error: 'stale_rfp' })
      return
    }
    const isEventRequest = rfpEntry.rows.length > 0

    // Validate answers against the service's form schema (required fields present).
    const service = await deps.serviceCatalog.findById(request.serviceId)
    const missing: string[] = []
    if (service) {
      const serviceMissing = missingRequiredFields(service, request.answers)
      if (serviceMissing) {
        missing.push(...serviceMissing)
      }
    }

    if (isEventRequest) {
      if (!parseApplicationTeam(request.answers?.applicationTeam)) {
        missing.push('applicationTeam')
      }

      const proposalDocs = await deps.pool.query(
        `SELECT 1 FROM dashboard.private_documents WHERE request_id = $1 AND category = 'proposal'`,
        [request.id],
      )
      if ((proposalDocs.rowCount ?? 0) === 0) {
        missing.push('proposalDocuments')
      }

      if (!acceptsAgreementVersion(req.body?.nonCompeteAcceptance, CURRENT_NON_COMPETE_VERSION)) {
        missing.push('nonCompeteAcceptance')
      }
      if (!acceptsAgreementVersion(req.body?.eventRulesAcceptance, CURRENT_EVENT_RULES_VERSION)) {
        missing.push('eventRulesAcceptance')
      }
    }

    if (missing.length > 0) {
      res.status(400).json({ error: 'invalid_answers', missingFields: missing })
      return
    }

    const firstStep = service?.workflow[0]
    const result = await repo.submit(
      req.params.id,
      actor.id,
      firstStep ? { assignedRole: firstStep.roleName, currentStep: firstStep.title } : undefined,
      companyId,
      true,
      isEventRequest
        ? { nonCompeteVersion: CURRENT_NON_COMPETE_VERSION, eventRulesVersion: CURRENT_EVENT_RULES_VERSION }
        : undefined,
    )
    if (typeof result === 'object' && 'missingFields' in result) {
      res.status(400).json({ error: 'invalid_answers', missingFields: result.missingFields })
      return
    }
    if (result === 'company_not_verified') {
      res.status(403).json({ error: 'company_not_verified' })
      return
    }
    if (result === 'not_found') {
      res.status(404).json({ error: 'not_found' })
      return
    }
    if (result === 'already_submitted') {
      res.status(409).json({ error: 'already_submitted' })
      return
    }
    if (result === 'stale_rfp') {
      res.status(409).json({ error: 'stale_rfp' })
      return
    }
    res.json({ request: requestWithActions(actor.operationalRole, actor.id, result, companyId) })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/verification', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const pinned = await repo.findRequestVerification(request.id)
      if (!pinned) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isCompanyAdministrator(actor.operationalRole) && !isRepresentative(actor.operationalRole)) {
        // Case assignment permits only the profile fields needed for review;
        // it never grants access to the private verification dossier or files.
        pinned.snapshot = { ...necessaryCompanyProfile(pinned.snapshot) }
      }
      res.json({ verification: pinned })
    } catch (error) { next(error) }
  })

  router.get('/requests/:id/proposal', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const { scope } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const revision = req.query.revision === undefined ? undefined : parseRevisionQuery(req.query.revision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      if (isReviewerRole(actor.operationalRole)) {
        // A reviewer sees only the proposal revision the assignment covers, never
        // other revisions of the same case or the company's later corrections.
        const reviewed = await reviewCases.reviewedProposalRevision(
          request.id, { id: actor.id, role: actor.operationalRole },
        )
        if (reviewed === null) {
          // Nothing pinned to review (for example a request of another service).
          res.json({ proposal: null, agreements: [], revisions: [] })
          return
        }
        if (revision !== undefined && revision !== reviewed) {
          res.status(404).json({ error: 'not_found' })
          return
        }
        const proposal = await repo.findRequestProposal(request.id, reviewed)
        // The accepting representative's id is not the reviewer's business.
        const agreements = proposal ? await repo.listRequestAgreements(request.id, proposal.revision) : []
        res.json({
          proposal,
          agreements: agreements.map(({ acceptedBy: _acceptedBy, ...agreement }) => agreement),
          revisions: [reviewed],
        })
        return
      }
      const proposal = await repo.findRequestProposal(request.id, revision)
      const agreements = proposal ? await repo.listRequestAgreements(request.id, proposal.revision) : []
      res.json({ proposal, agreements, revisions: await repo.listProposalRevisions(request.id) })
    } catch (error) { next(error) }
  })

  router.post('/requests/:id/triage', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { action, reason, expectedRevision } = req.body ?? {}
      if (action !== 'accept' && action !== 'return' && action !== 'reject') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      const trimmedReason = parseDecisionReason(reason)
      if (action !== 'accept' && !trimmedReason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const revision = parseExpectedRevision(expectedRevision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const result = await repo.decideTriage({
        requestId: req.params.id,
        actorId: actor.id,
        action,
        reason: action === 'accept' ? null : trimmedReason,
        expectedRevision: revision,
      })
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'forbidden') { await refuseCommand(res, actor, req.params.id); return }
      if (result === 'invalid_state') { res.status(409).json({ error: 'invalid_triage_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      res.json({ request: (await presentRequests(actor, [result.request]))[0] })
    } catch (error) { next(error) }
  })

  /** The responsible chief's explicit decision once a round holds its four final evaluations (T28). */
  router.post('/requests/:id/review-decision', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'chief-reviewer') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { action, reason, expectedRevision } = req.body ?? {}
      if (action !== 'advance' && action !== 'return' && action !== 'reject') {
        res.status(400).json({ error: 'invalid_action' })
        return
      }
      const trimmedReason = parseDecisionReason(reason)
      if (action !== 'advance' && !trimmedReason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const revision = parseExpectedRevision(expectedRevision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const result = await repo.decideReview({
        requestId: req.params.id,
        actorId: actor.id,
        action,
        reason: action === 'advance' ? null : trimmedReason,
        expectedRevision: revision,
      })
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'forbidden') { await refuseCommand(res, actor, req.params.id); return }
      if (result === 'invalid_state') { res.status(409).json({ error: 'invalid_decision_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      if (result === 'round_not_ready') { res.status(409).json({ error: 'round_not_ready' }); return }
      res.json({ request: (await presentRequests(actor, [result.request]))[0] })
    } catch (error) { next(error) }
  })

  /**
   * The financial package invitation (T29) for the owning company, Secretariat and
   * the owner. Chiefs and reviewers are outside the financial audience, and the
   * investment person reads the package through the case dossier (T31).
   */
  router.get('/requests/:id/financial-invitation', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role !== 'representative' && role !== 'central-secretariat' && role !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const invitation = request.reviewStage === 'advanced' ? await repo.findFinancialInvitation(request.id) : null
      if (!invitation) {
        res.status(409).json({ error: 'financial_stage_not_open' })
        return
      }
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ invitation })
    } catch (error) { next(error) }
  })

  /**
   * The company submits its financial package (T30). Every checklist category and
   * every statement year the founding date requires must have a file; otherwise
   * nothing is stored and the response names the gaps. A complete package freezes
   * the financial files and hands the case to the event's investment person (T31).
   * It does not advance the case. A repeated submit returns the stored package.
   */
  router.post('/requests/:id/financial-package', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'representative') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request || !allowedRequestActions(actor.operationalRole, request, actor.id, companyId).includes('read')) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isFinancialStageOpen(request.status, request.reviewStage)) {
        res.status(409).json({ error: 'financial_stage_not_open' })
        return
      }
      const company = request.companyId
        ? await deps.companyStore.findById(request.companyId).catch(() => undefined)
        : await deps.companyStore.findByRepresentative(request.ownerId)
      const plan = statementYearPlan(company?.establishmentDate)
      if (!plan.ok) {
        res.status(422).json({ error: plan.error })
        return
      }
      const result = await financialPackages.submit({
        requestId: request.id,
        actorId: actor.id,
        expectedYears: plan.years,
      })
      switch (result.status) {
        case 'submitted':
          res.status(201).json({ package: result.package })
          return
        case 'already_submitted':
          res.json({ package: result.package })
          return
        case 'incomplete':
          res.status(422).json({
            error: 'financial_package_incomplete',
            missingCategories: result.gaps.missingCategories,
            missingStatementYears: result.gaps.missingStatementYears,
          })
          return
        case 'stage_closed':
          res.status(409).json({ error: 'financial_stage_not_open' })
          return
        case 'not_found':
          res.status(404).json({ error: 'not_found' })
          return
      }
    } catch (error) { next(error) }
  })

  /** The company's latest submitted financial package, for the owning company, Secretariat and the owner. */
  router.get('/requests/:id/financial-package', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      const role = actor.operationalRole
      if (role !== 'representative' && role !== 'central-secretariat' && role !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope } = await resolveScope(actor.id, role)
      const request = await repo.findByIdScoped(req.params.id, scope)
      const pkg = request ? await financialPackages.findLatest(request.id) : null
      if (!pkg) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.set('Cache-Control', 'private, no-store, max-age=0').json({ package: pkg })
    } catch (error) { next(error) }
  })

  /* ── Assigned reviewer queue and case file (T23) ───────────────────── */

  router.post('/requests/:id/resubmit', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const { scope, companyId } = await resolveScope(actor.id, actor.operationalRole)
      const request = await repo.findByIdScoped(req.params.id, scope)
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      if (!isChiefCorrectionStatus(request.status, request.reviewStage)) {
        res.status(409).json({ error: 'not_correctable' })
        return
      }

      const missing: string[] = []
      const service = await deps.serviceCatalog.findById(request.serviceId)
      if (service) missing.push(...(missingRequiredFields(service, request.answers) ?? []))
      if (!parseApplicationTeam(request.answers?.applicationTeam)) missing.push('applicationTeam')
      const proposalDocs = await deps.pool.query(
        `SELECT 1 FROM dashboard.private_documents WHERE request_id = $1 AND category = 'proposal'`,
        [request.id],
      )
      if ((proposalDocs.rowCount ?? 0) === 0) missing.push('proposalDocuments')
      if (!acceptsAgreementVersion(req.body?.nonCompeteAcceptance, CURRENT_NON_COMPETE_VERSION)) {
        missing.push('nonCompeteAcceptance')
      }
      if (!acceptsAgreementVersion(req.body?.eventRulesAcceptance, CURRENT_EVENT_RULES_VERSION)) {
        missing.push('eventRulesAcceptance')
      }
      if (missing.length > 0) {
        res.status(400).json({ error: 'invalid_answers', missingFields: missing })
        return
      }

      const result = await repo.resubmitCorrection(request.id, actor.id, companyId, {
        nonCompeteVersion: CURRENT_NON_COMPETE_VERSION,
        eventRulesVersion: CURRENT_EVENT_RULES_VERSION,
      })
      if (typeof result === 'object' && 'missingFields' in result) {
        res.status(400).json({ error: 'invalid_answers', missingFields: result.missingFields })
        return
      }
      if (result === 'company_not_verified') { res.status(403).json({ error: 'company_not_verified' }); return }
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'not_correctable') { res.status(409).json({ error: 'not_correctable' }); return }
      res.json({ request: requestWithActions(actor.operationalRole, actor.id, result, companyId) })
    } catch (error) { next(error) }
  })

  router.post('/admin/requests/:id/reopen', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (actor.operationalRole !== 'system-owner') {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const reason = parseDecisionReason(req.body?.reason)
      if (!reason) {
        res.status(400).json({ error: 'reason_required' })
        return
      }
      const revision = parseExpectedRevision(req.body?.expectedRevision)
      if (revision === null) {
        res.status(400).json({ error: 'invalid_revision' })
        return
      }
      const result = await repo.reopenRejected({
        requestId: req.params.id,
        actorId: actor.id,
        reason,
        expectedRevision: revision,
      })
      if (result === 'not_found') { res.status(404).json({ error: 'not_found' }); return }
      if (result === 'not_rejected') { res.status(409).json({ error: 'invalid_reopen_state' }); return }
      if (result === 'stale_revision') { res.status(409).json({ error: 'stale_revision' }); return }
      res.json({ request: (await presentRequests(actor, [result]))[0] })
    } catch (error) { next(error) }
  })

  /*
   * Minimal case-assignment primitive used by the shared policy. Full triage and
   * reviewer-slot assignment remain T21/T22; this command deliberately does not
   * start a review round or change request state.
   */
  router.get('/admin/requests/:id/assignments', async (req, res) => {
    const actor = actorOf(res)
    if (!isCompanyAdministrator(actor.operationalRole)) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const request = await repo.findByIdAny(req.params.id)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ items: await assignments.listForRequest(request.id) })
  })

  router.post('/admin/requests/:id/assignments', async (req, res) => {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const request = await repo.findByIdAny(req.params.id)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    if (!canRequestAction(actor.operationalRole, request, actor.id, 'assign')) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : ''
    const role = req.body?.role
    if (!userId || !isCaseAssignmentRole(role)) {
      res.status(400).json({ error: 'invalid_assignment' })
      return
    }
    const target = await deps.userStore.findById(userId).catch(() => undefined)
    if (!target || operationalRoleOf(target) !== role) {
      // The assignment role must match the person's current operational role.
      res.status(400).json({ error: 'assignment_role_mismatch' })
      return
    }
    const created = await assignments.create({
      requestId: request.id,
      userId,
      role: role as CaseAssignmentRole,
      assignedBy: actor.id,
    })
    if (!created.ok) {
      // The four slots belong to the review round; replacement is its own command.
      res.status(409).json({ error: created.reason })
      return
    }
    res.status(201).json({ assignment: created.assignment })
  })

  router.delete('/admin/requests/:id/assignments/:userId', async (req, res) => {
    const actor = actorOf(res)
    if (actor.operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const request = await repo.findByIdAny(req.params.id)
    if (!request) { res.status(404).json({ error: 'not_found' }); return }
    if (!canRequestAction(actor.operationalRole, request, actor.id, 'assign')) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    const held = (await assignments.listForRequest(request.id)).find(
      (item) => item.active && item.userId === req.params.userId,
    )
    if (held?.roundId) {
      res.status(409).json({ error: 'managed_by_review_round' })
      return
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null
    const revoked = await assignments.revoke({
      requestId: request.id,
      userId: req.params.userId,
      revokedBy: actor.id,
      reason: reason || null,
    })
    if (!revoked) { res.status(404).json({ error: 'not_found' }); return }
    res.json({ assignment: revoked })
  })

  /* ── Evaluation routes (T25) ────────────────────────────────────────── */
}
