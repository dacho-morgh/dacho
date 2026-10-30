import type { Pool } from 'pg'

import { isUuid } from '../db/uuid.js'
import type {
  ApplicationTeamMember,
  PinnedProposalDocument,
  RequestStatus,
  ReviewStage,
} from './request-repo.js'

/** The two roles that evaluate a case; chief and investment people have their own surfaces. */
export type ReviewerRole = 'reviewer' | 'employer-reviewer'

export function isReviewerRole(role: unknown): role is ReviewerRole {
  return role === 'reviewer' || role === 'employer-reviewer'
}

export type QueueView = 'open' | 'closed' | 'all'

export function parseQueueView(value: unknown): QueueView | null {
  if (value === undefined) return 'open'
  return value === 'open' || value === 'closed' || value === 'all' ? value : null
}

/**
 * The company fields a reviewer or employer needs to judge a case. Case
 * assignment never opens the private verification dossier or its files, so this
 * explicit projection is the only profile shape those roles receive.
 */
export interface NecessaryCompanyProfile {
  company: {
    name: unknown
    nationalId: unknown
    type: unknown
    province: unknown
    city: unknown
  }
  dossier: {
    legalEntityType: unknown
    classification: unknown
    activityDomain: unknown
    productsServices: unknown
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export function necessaryCompanyProfile(snapshot: unknown): NecessaryCompanyProfile {
  const source = asRecord(snapshot)
  const company = asRecord(source.company)
  const dossier = asRecord(source.dossier)
  return {
    company: {
      name: company.name,
      nationalId: company.nationalId,
      type: company.type,
      province: company.province,
      city: company.city,
    },
    dossier: {
      legalEntityType: dossier.legalEntityType,
      classification: dossier.classification,
      activityDomain: dossier.activityDomain,
      productsServices: dossier.productsServices,
    },
  }
}

export interface OwnEvaluationSummary {
  state: 'draft' | 'final'
  revision: number
  updatedAt: string
  finalizedAt: string | null
}

export interface ReviewAssignmentSummary {
  role: ReviewerRole
  slot: 'employer' | 'ordinary' | null
  assignedAt: string
}

export interface ReviewRoundSummary {
  id: string
  requestRevision: number
  proposalRevision: number
  /** True while the round reviews the request's current revision. */
  current: boolean
}

export interface ReviewQueueItem {
  requestId: string
  trackingCode: string
  title: string
  revision: number
  status: RequestStatus
  reviewStage: ReviewStage | null
  submissionDate: string | null
  event: { id: string; title: string } | null
  subtopic: { id: string; title: string } | null
  companyName: string | null
  assignment: ReviewAssignmentSummary
  round: ReviewRoundSummary | null
  /** The proposal revision this person reviews (the round's, else the latest submitted). */
  proposalRevision: number | null
  /** True while the case is in review on the revision this assignment covers. */
  actionable: boolean
  evaluation: OwnEvaluationSummary | null
}

export interface ReviewQueue {
  items: ReviewQueueItem[]
  total: number
  page: number
  totalPages: number
  /** Counted over every active assignment, whatever the requested view. */
  counts: { open: number; closed: number; all: number }
}

export interface ReviewCaseFile {
  case: ReviewQueueItem
  proposal: {
    revision: number
    formVersion: string
    applicationTeam: ApplicationTeamMember[]
    answers: Record<string, unknown> | null
    documents: PinnedProposalDocument[]
    createdAt: string
  } | null
  rfp: {
    versionId: string
    files: { id: string; filename: string; mimeType: string; sizeBytes: number }[]
  } | null
  company: NecessaryCompanyProfile | null
}

interface QueueRow {
  request_id: string
  tracking_code: string
  title: string
  revision: number
  status: RequestStatus
  review_stage: ReviewStage | null
  submission_date: Date | null
  event_id: string | null
  event_title: string | null
  subtopic_id: string | null
  subtopic_title: string | null
  snapshot: unknown
  role: ReviewerRole
  slot: 'employer' | 'ordinary' | null
  assigned_at: Date
  round_id: string | null
  round_request_revision: number | null
  round_proposal_revision: number | null
  proposal_revision: number | null
  actionable: boolean
  evaluation_state: 'draft' | 'final' | null
  evaluation_revision: number | null
  evaluation_updated_at: Date | null
  evaluation_finalized_at: Date | null
}

/**
 * One row per active assignment of the actor. Everything is derived from the
 * persisted assignment, request, round and the actor's own evaluation: the
 * join to `evaluations` is pinned to the actor's user id so another reviewer's
 * work can never reach this projection.
 */
const ASSIGNMENT_ROWS_SQL = `
  SELECT r.id AS request_id, r.tracking_code, r.title, r.revision, r.status, r.review_stage,
         r.submission_date,
         e.id AS event_id, e.title AS event_title, s.id AS subtopic_id, s.title AS subtopic_title,
         v.snapshot,
         a.role, a.slot, a.assigned_at, a.round_id,
         rr.request_revision AS round_request_revision,
         rr.proposal_revision AS round_proposal_revision,
         COALESCE(
           rr.proposal_revision,
           (SELECT max(p.revision) FROM dashboard.request_proposals p
            WHERE p.request_id = r.id AND p.revision <= r.revision)
         ) AS proposal_revision,
         (r.status = 'in_review' AND (a.round_id IS NULL OR rr.request_revision = r.revision)) AS actionable,
         ev.state AS evaluation_state, ev.revision AS evaluation_revision,
         ev.updated_at AS evaluation_updated_at, ev.finalized_at AS evaluation_finalized_at
  FROM dashboard.case_assignments a
  JOIN dashboard.requests r ON r.id = a.request_id
  LEFT JOIN dashboard.review_rounds rr ON rr.id = a.round_id
  LEFT JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
  LEFT JOIN dashboard.events e ON e.id = rfp.event_id
  LEFT JOIN dashboard.event_subtopics s ON s.id = rfp.subtopic_id
  LEFT JOIN dashboard.request_verifications v ON v.request_id = r.id
  LEFT JOIN dashboard.evaluations ev
    ON ev.request_id = r.id AND ev.user_id = a.user_id
   AND ev.revision = COALESCE(rr.request_revision, r.revision)
  WHERE a.user_id = $1 AND a.role = $2 AND a.active`

function mapQueueRow(row: QueueRow): ReviewQueueItem {
  const company = asRecord(asRecord(row.snapshot).company)
  return {
    requestId: row.request_id,
    trackingCode: row.tracking_code,
    title: row.title,
    revision: row.revision,
    status: row.status,
    reviewStage: row.review_stage ?? null,
    submissionDate: row.submission_date ? row.submission_date.toISOString() : null,
    event: row.event_id && row.event_title ? { id: row.event_id, title: row.event_title } : null,
    subtopic: row.subtopic_id && row.subtopic_title ? { id: row.subtopic_id, title: row.subtopic_title } : null,
    companyName: typeof company.name === 'string' ? company.name : null,
    assignment: { role: row.role, slot: row.slot, assignedAt: row.assigned_at.toISOString() },
    round: row.round_id && row.round_request_revision !== null && row.round_proposal_revision !== null
      ? {
          id: row.round_id,
          requestRevision: row.round_request_revision,
          proposalRevision: row.round_proposal_revision,
          current: row.round_request_revision === row.revision,
        }
      : null,
    proposalRevision: row.proposal_revision,
    actionable: row.actionable,
    evaluation: row.evaluation_state && row.evaluation_revision !== null && row.evaluation_updated_at
      ? {
          state: row.evaluation_state,
          revision: row.evaluation_revision,
          updatedAt: row.evaluation_updated_at.toISOString(),
          finalizedAt: row.evaluation_finalized_at ? row.evaluation_finalized_at.toISOString() : null,
        }
      : null,
  }
}

export class ReviewCaseRepository {
  constructor(private readonly pool: Pool) {}

  /** The actor's active assignments, newest first, split into open and closed work. */
  async listQueue(
    actor: { id: string; role: ReviewerRole },
    options: { view: QueueView; page: number; limit: number },
  ): Promise<ReviewQueue> {
    const filter =
      options.view === 'open' ? 'WHERE actionable'
        : options.view === 'closed' ? 'WHERE NOT actionable'
          : ''
    const params: unknown[] = [actor.id, actor.role]
    const counts = await this.pool.query<{ open: string; closed: string }>(
      `SELECT count(*) FILTER (WHERE actionable) AS open,
              count(*) FILTER (WHERE NOT actionable) AS closed
       FROM (${ASSIGNMENT_ROWS_SQL}) q`,
      params,
    )
    const open = Number(counts.rows[0]?.open ?? 0)
    const closed = Number(counts.rows[0]?.closed ?? 0)
    const total = options.view === 'open' ? open : options.view === 'closed' ? closed : open + closed

    const { rows } = await this.pool.query<QueueRow>(
      `SELECT * FROM (${ASSIGNMENT_ROWS_SQL}) q ${filter}
       ORDER BY assigned_at DESC, request_id
       LIMIT $3 OFFSET $4`,
      [...params, options.limit, (options.page - 1) * options.limit],
    )
    return {
      items: rows.map(mapQueueRow),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
      counts: { open, closed, all: open + closed },
    }
  }

  /**
   * The case file for one active assignment, or null when the actor holds none
   * (the caller answers 404, so a guessed id confirms nothing). The proposal,
   * its files and the RFP are the ones pinned to what this person reviews.
   */
  async findCase(actor: { id: string; role: ReviewerRole }, requestId: string): Promise<ReviewCaseFile | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<QueueRow>(
      `SELECT * FROM (${ASSIGNMENT_ROWS_SQL}) q WHERE request_id = $3`,
      [actor.id, actor.role, requestId],
    )
    const row = rows[0]
    if (!row) return null

    const proposal = row.proposal_revision === null
      ? null
      : (await this.pool.query<{
          revision: number
          form_version: string
          application_team: ApplicationTeamMember[]
          proposal_documents: PinnedProposalDocument[]
          answers: Record<string, unknown> | null
          created_at: Date
        }>(
          `SELECT revision, form_version, application_team, proposal_documents, answers, created_at
           FROM dashboard.request_proposals WHERE request_id = $1 AND revision = $2`,
          [requestId, row.proposal_revision],
        )).rows[0] ?? null

    const rfp = await this.pool.query<{
      version_id: string
      id: string | null
      filename: string | null
      mime_type: string | null
      size_bytes: number | null
    }>(
      `SELECT rfp.version_id, f.id, f.filename, f.mime_type, f.size_bytes
       FROM dashboard.request_rfps rfp
       LEFT JOIN dashboard.rfp_files f ON f.version_id = rfp.version_id
       WHERE rfp.request_id = $1
       ORDER BY f.position`,
      [requestId],
    )

    return {
      case: mapQueueRow(row),
      proposal: proposal
        ? {
            revision: proposal.revision,
            formVersion: proposal.form_version,
            applicationTeam: proposal.application_team,
            answers: proposal.answers ?? null,
            documents: proposal.proposal_documents,
            createdAt: proposal.created_at.toISOString(),
          }
        : null,
      rfp: rfp.rows[0]
        ? {
            versionId: rfp.rows[0].version_id,
            files: rfp.rows
              .filter((file) => file.id !== null)
              .map((file) => ({
                id: file.id!,
                filename: file.filename!,
                mimeType: file.mime_type!,
                sizeBytes: file.size_bytes!,
              })),
          }
        : null,
      company: row.snapshot ? necessaryCompanyProfile(row.snapshot) : null,
    }
  }

  /**
   * Proposal files the actor may read on an event application: only those pinned
   * to the proposal revision under review. Files the company uploaded after
   * submission (a correction in progress) and every other revision stay out of
   * reach. Requests of other services have no pinned proposal and keep plain
   * case-assignment access (`'unrestricted'`). Returns null without an active
   * assignment.
   */
  async reviewableProposalDocumentIds(
    requestId: string,
    actor: { id: string; role: ReviewerRole },
  ): Promise<Set<string> | 'unrestricted' | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<{
      is_event: boolean
      proposal_documents: PinnedProposalDocument[] | null
    }>(
      `SELECT EXISTS (SELECT 1 FROM dashboard.request_rfps f WHERE f.request_id = r.id) AS is_event,
              p.proposal_documents
       FROM dashboard.case_assignments a
       JOIN dashboard.requests r ON r.id = a.request_id
       LEFT JOIN dashboard.review_rounds rr ON rr.id = a.round_id
       LEFT JOIN dashboard.request_proposals p
         ON p.request_id = r.id
        AND p.revision = COALESCE(
              rr.proposal_revision,
              (SELECT max(q.revision) FROM dashboard.request_proposals q
               WHERE q.request_id = r.id AND q.revision <= r.revision))
       WHERE a.request_id = $1 AND a.user_id = $2 AND a.role = $3 AND a.active`,
      [requestId, actor.id, actor.role],
    )
    const row = rows[0]
    if (!row) return null
    if (!row.is_event) return 'unrestricted'
    return new Set((row.proposal_documents ?? []).map((document) => document.id))
  }

  /** The proposal revision this actor reviews on the request, or null without an assignment. */
  async reviewedProposalRevision(
    requestId: string,
    actor: { id: string; role: ReviewerRole },
  ): Promise<number | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<{ proposal_revision: number | null }>(
      `SELECT COALESCE(
                rr.proposal_revision,
                (SELECT max(p.revision) FROM dashboard.request_proposals p
                 WHERE p.request_id = r.id AND p.revision <= r.revision)
              ) AS proposal_revision
       FROM dashboard.case_assignments a
       JOIN dashboard.requests r ON r.id = a.request_id
       LEFT JOIN dashboard.review_rounds rr ON rr.id = a.round_id
       WHERE a.request_id = $1 AND a.user_id = $2 AND a.role = $3 AND a.active`,
      [requestId, actor.id, actor.role],
    )
    return rows[0]?.proposal_revision ?? null
  }
}
