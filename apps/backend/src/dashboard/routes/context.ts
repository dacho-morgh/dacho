import type { Response } from 'express'
import type { Pool } from 'pg'
import { bindRequestScope, canReadDocument, isFinancialStageOpen, requestScopeFor, type RequestScope } from '../../access/policy.js'
import { isCaseAssignmentRole, type OperationalRole } from '../../access/roles.js'
import type { ServiceCatalog } from '../../catalog/service-catalog.js'
import { ActivityRepository } from '../activity-repo.js'
import { AssignmentRepository } from '../assignment-repo.js'
import { ReviewRoundRepository } from '../review-round-repo.js'
import { isReviewerRole, ReviewCaseRepository, reviewerActivityView, reviewerRequestView } from '../review-case-repo.js'
import { SqlDossierDocumentSource, type DossierDocumentSource } from '../dossier.js'
import { EventCategoryRepository, type EventCategoryStore } from '../event-category-repo.js'
import { EventRepository, type EventStore } from '../event-repo.js'
import { LetterRepository, type LetterAttachmentDto, type LetterDto } from '../letter-repo.js'
import { DocumentRepository, type PrivateDocumentRecord } from '../../documents/repo.js'
import { FinancialPackageRepository } from '../financial-package-repo.js'
import { InvestmentCaseRepository } from '../investment-case-repo.js'
import { InvestmentMemoRepository, type InvestmentMemoDto } from '../investment-memo-repo.js'
import { SecretariatFollowUpRepository } from '../secretariat-follow-up-repo.js'
import { ProfileRepository } from '../profile-repo.js'
import { RequestRepository } from '../request-repo.js'
import { StatsRepository } from '../stats-repo.js'
import type { CompanyStore } from '../../auth/company-store.js'
import type { UserStore } from '../../auth/user-store.js'
import { SupportRepository } from '../support-repo.js'
import type { PrivateDocumentStorage } from '../../documents/storage.js'
import { isUuid } from '../../exhibitions/catalogue.js'
import { PostgresBoothCatalogueRepository, type BoothCatalogueRepository } from '../../exhibitions/catalogue-repo.js'
import { PostgresBoothReservationRepository, type BoothCompanyEligibility, type BoothReservationRepository } from '../../exhibitions/reservation-repo.js'
import type { ExhibitionStore } from '../../exhibitions/exhibition-store.js'
import { PostgresEvaluationRepository, type EvaluationStore } from '../../reviews/evaluation-repo.js'
import { PostgresNotificationOutbox, type NotificationOutbox } from '../notification-outbox.js'
import { PostgresVerificationStore, type VerificationStore } from '../verification-repo.js'
import { requestWithActions, resolveRequesterNames } from './route-helpers.js'

export interface DashboardDeps {
  pool: Pool
  serviceCatalog: ServiceCatalog
  proxySecret: string
  userStore: UserStore
  companyStore: CompanyStore
  privateDocumentStorage: PrivateDocumentStorage
  /** Test seam for the company dossier's document inventory. */
  dossierDocuments?: DossierDocumentSource
  eventStore?: EventStore
  eventCategoryStore?: EventCategoryStore
  boothCatalogue?: BoothCatalogueRepository
  boothReservations?: BoothReservationRepository
  boothCompanyEligibility?: BoothCompanyEligibility
  eventCompanyEligibility?: BoothCompanyEligibility
  exhibitionStore?: ExhibitionStore
  evaluationStore?: EvaluationStore
  notificationOutbox?: NotificationOutbox
  verificationStore?: VerificationStore
}

/** Stores and case helpers shared by every dashboard route module. */
export function createDashboardContext(deps: DashboardDeps) {
  const notificationOutbox =
    deps.notificationOutbox ?? new PostgresNotificationOutbox(deps.pool)
  const repo = new RequestRepository(deps.pool, notificationOutbox)
  const letters = new LetterRepository(deps.pool)
  const activities = new ActivityRepository(deps.pool)
  const stats = new StatsRepository(deps.pool)
  const profileRepo = new ProfileRepository(deps.userStore, deps.companyStore)
  const dossierDocuments = deps.dossierDocuments ?? new SqlDossierDocumentSource(deps.pool)
  const support = new SupportRepository(deps.pool)
  const assignments = new AssignmentRepository(deps.pool)
  const rounds = new ReviewRoundRepository(deps.pool, notificationOutbox)
  const financialPackages = new FinancialPackageRepository(deps.pool, notificationOutbox)
  const investmentCases = new InvestmentCaseRepository(deps.pool)
  const investmentMemos = new InvestmentMemoRepository(deps.pool, notificationOutbox)
  const followUps = new SecretariatFollowUpRepository(deps.pool, notificationOutbox)
  const reviewCases = new ReviewCaseRepository(deps.pool)
  const evaluations =
    deps.evaluationStore ?? new PostgresEvaluationRepository(deps.pool, notificationOutbox)
  const eventStore = deps.eventStore ?? new EventRepository(deps.pool)
  const categoryStore =
    deps.eventCategoryStore ?? new EventCategoryRepository(deps.pool)
  const catalogue =
    deps.boothCatalogue ?? new PostgresBoothCatalogueRepository(deps.pool)
  const boothReservations =
    deps.boothReservations ?? new PostgresBoothReservationRepository(deps.pool)
  const verificationStore =
    deps.verificationStore ?? new PostgresVerificationStore(deps.pool)

  async function checkExhibition(
    exhibitionId: string,
  ): Promise<{ ok: true; exists: boolean } | { ok: false }> {
    if (!deps.exhibitionStore) return { ok: true, exists: true }
    try {
      return { ok: true, exists: await deps.exhibitionStore.exists(exhibitionId) }
    } catch {
      return { ok: false }
    }
  }

  const actorCompanyId = async (actorId: string, role: string): Promise<string | null> => {
    if (role !== 'representative') return null
    const company = await deps.companyStore.findByRepresentative(actorId)
    return company?.id ?? null
  }

  /** Adds server-derived actions; chiefs also need event-level responsibility per case. */
  const presentRequests = async <T extends NonNullable<Awaited<ReturnType<RequestRepository['findByIdAny']>>>>(
    actor: { id: string; operationalRole: OperationalRole },
    items: T[],
    companyId?: string | null,
  ) => {
    const reviewable = (item: T) =>
      item.status === 'in_review' && (item.reviewStage === 'chief_triage' || item.reviewStage === 'triaged')
    const chiefCases =
      actor.operationalRole === 'chief-reviewer'
        ? await repo.requestsOfResponsibleChief(items.filter(reviewable).map((item) => item.id), actor.id)
        : new Set<string>()
    // Chiefs act on their own cases; the owner may replace the employer on any triaged case.
    const roundCases = items.filter(
      (item) =>
        item.reviewStage === 'triaged' &&
        (actor.operationalRole === 'system-owner' ? item.status === 'in_review' : chiefCases.has(item.id)),
    )
    const currentRounds = await rounds.currentRoundsOf(roundCases.map((item) => item.id))
    const packaged = await financialPackages.submittedRequestIds(
      items.filter((item) => isFinancialStageOpen(item.status, item.reviewStage)).map((item) => item.id),
    )
    return items.map((item) =>
      requestWithActions(
        actor.operationalRole, actor.id, item, companyId, chiefCases.has(item.id),
        currentRounds.has(item.id), currentRounds.get(item.id) === true, packaged.has(item.id),
      )!,
    )
  }

  /** Reviewers and employers get the minimal case view from the generic request routes (T23). */
  const limitRequest = async <T extends NonNullable<Awaited<ReturnType<RequestRepository['findByIdAny']>>>>(
    actor: { id: string; operationalRole: OperationalRole },
    item: T,
    withAnswers: boolean,
  ) => {
    if (!isReviewerRole(actor.operationalRole)) return item
    let answers: Record<string, unknown> = {}
    if (withAnswers) {
      // Event applications show the reviewed revision; requests with nothing pinned keep their own answers.
      const reviewed = await reviewCases.reviewedProposalRevision(item.id, { id: actor.id, role: actor.operationalRole })
      const proposal = reviewed === null ? null : await repo.findRequestProposal(item.id, reviewed)
      answers = proposal ? (proposal.answers ?? {}) : item.answers
    }
    return reviewerRequestView(item, answers) as unknown as T
  }

  const limitActivities = <A extends Parameters<typeof reviewerActivityView>[0]>(
    actor: { operationalRole: OperationalRole },
    items: A[],
  ) => (isReviewerRole(actor.operationalRole) ? items.map(reviewerActivityView) : items)

  const resolveScope = async (actorId: string, role: OperationalRole): Promise<{ scope: RequestScope; companyId: string | null }> => {
    const companyId = await actorCompanyId(actorId, role)
    const scope = bindRequestScope(requestScopeFor(role), actorId, companyId)
    return { scope, companyId }
  }

  /** Refuses a command: someone who cannot read the case gets what an unknown id gets, so a guess confirms nothing. */
  const refuseCommand = async (res: Response, actor: { id: string; operationalRole: OperationalRole }, requestId: string) => {
    const { scope } = await resolveScope(actor.id, actor.operationalRole)
    if (await repo.findByIdScoped(requestId, scope)) res.status(403).json({ error: 'forbidden' })
    else res.status(404).json({ error: 'not_found' })
  }

  // Mailbox visibility never expands the underlying document audience.
  const canReadAttachment = async (doc: PrivateDocumentRecord, actorId: string, role: OperationalRole): Promise<boolean> => {
    const companyId = await actorCompanyId(actorId, role)
    let assigned = false
    if (doc.requestId && isCaseAssignmentRole(role)) {
      if (isReviewerRole(role)) {
        // Reviewers see only the proposal files pinned to the revision they review (T23).
        const pinned = await reviewCases.reviewableProposalDocumentIds(doc.requestId, { id: actorId, role })
        assigned = pinned === 'unrestricted' || pinned?.has(doc.id) === true
      } else {
        assigned = await assignments.activeFor(doc.requestId, actorId, role)
      }
    }
    return canReadDocument(role, { ...doc, assigned }, actorId, companyId)
  }

  const attachmentMatchesLetter = async (doc: PrivateDocumentRecord, requestId: string | null): Promise<boolean> => {
    if (doc.requestId !== null) return doc.requestId === requestId
    if (requestId === null) return true
    // Dossier files have no request id; bind them to the case's actual company.
    const request = await repo.findByIdScoped(requestId, { kind: 'all' })
    if (!request || !doc.companyId) return false
    const companyId = request.companyId ?? (await deps.companyStore.findByRepresentative(request.ownerId))?.id
    return doc.companyId === companyId
  }

  const attachmentDto = (doc: PrivateDocumentRecord): LetterAttachmentDto => ({
    id: doc.id,
    name: doc.filename,
    filename: doc.filename,
    category: doc.category,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    size: `${Math.max(1, Math.round(doc.sizeBytes / 1024))} KB`,
    downloadUrl: `/api/dashboard/documents/${doc.id}/download`,
  })

  const presentLetter = async (letter: LetterDto, actorId: string, role: OperationalRole): Promise<LetterDto> => {
    const attachments: LetterAttachmentDto[] = []
    const documents = new DocumentRepository(deps.pool)
    for (const value of Array.isArray(letter.attachments) ? letter.attachments : []) {
      const id = value && typeof value === 'object' ? (value as { id?: unknown }).id : null
      if (typeof id !== 'string' || !isUuid(id)) continue
      const doc = await documents.findById(id)
      if (!doc || !(await attachmentMatchesLetter(doc, letter.requestId)) || !(await canReadAttachment(doc, actorId, role))) continue
      attachments.push(attachmentDto(doc))
    }
    return { ...letter, attachments }
  }

  const withAuthorNames = async <T extends InvestmentMemoDto>(memos: T[]) => {
    const names = await resolveRequesterNames(deps.userStore, memos.map((memo) => memo.authorId))
    return memos.map((memo) => ({ ...memo, authorName: names.get(memo.authorId) ?? null }))
  }

  return {
    deps,
    notificationOutbox,
    repo,
    letters,
    activities,
    stats,
    profileRepo,
    dossierDocuments,
    support,
    assignments,
    rounds,
    financialPackages,
    investmentCases,
    investmentMemos,
    followUps,
    reviewCases,
    evaluations,
    eventStore,
    categoryStore,
    catalogue,
    boothReservations,
    verificationStore,
    checkExhibition,
    actorCompanyId,
    presentRequests,
    limitRequest,
    limitActivities,
    resolveScope,
    refuseCommand,
    canReadAttachment,
    attachmentMatchesLetter,
    attachmentDto,
    presentLetter,
    withAuthorNames,
  }
}

export type DashboardContext = ReturnType<typeof createDashboardContext>
