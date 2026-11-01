import type { Pool } from 'pg'

import { isUuid } from '../db/uuid.js'
import type { FinancialPackageDocumentDto } from './financial-package.js'
import type { RequestStatus, ReviewStage } from './request-repo.js'

export interface InvestmentQueueItem {
  requestId: string
  trackingCode: string
  title: string
  status: RequestStatus
  reviewStage: ReviewStage | null
  event: { id: string; title: string } | null
  subtopic: { id: string; title: string } | null
  companyName: string | null
  assignedAt: string
  /** The request revision of the round the chief advanced, which its evaluations cover. */
  reviewedRevision: number
  proposalRevision: number
  package: { id: string; packageVersion: number; submittedAt: string }
}

export interface InvestmentQueue {
  items: InvestmentQueueItem[]
  total: number
  page: number
  totalPages: number
}

export interface InvestmentCase extends InvestmentQueueItem {
  packageDetail: {
    checklistVersion: string
    statementYears: number[]
    documents: FinancialPackageDocumentDto[]
  }
}

interface CaseRow {
  request_id: string
  tracking_code: string
  title: string
  status: RequestStatus
  review_stage: ReviewStage | null
  event_id: string | null
  event_title: string | null
  subtopic_id: string | null
  subtopic_title: string | null
  company_name: string | null
  assigned_at: Date
  reviewed_revision: number
  proposal_revision: number
  package_id: string
  package_version: number
  submitted_at: Date
  checklist_version: string
  statement_years: number[]
  documents: FinancialPackageDocumentDto[]
}

/**
 * One row per case the actor holds. The inner join to the latest invitation's package
 * is the handoff gate: an assignment without a package yields nothing here.
 */
export const CASE_ROWS_SQL = `
  SELECT r.id AS request_id, r.tracking_code, r.title, r.status, r.review_stage,
         e.id AS event_id, e.title AS event_title, s.id AS subtopic_id, s.title AS subtopic_title,
         v.snapshot -> 'company' ->> 'name' AS company_name,
         a.assigned_at,
         i.reviewed_revision, i.proposal_revision,
         p.id AS package_id, p.package_version, p.submitted_at, p.checklist_version, p.statement_years, p.documents
  FROM dashboard.case_assignments a
  JOIN dashboard.requests r ON r.id = a.request_id
  JOIN LATERAL (
    SELECT fi.id, rr.request_revision AS reviewed_revision, fi.proposal_revision
    FROM dashboard.financial_invitations fi
    JOIN dashboard.review_rounds rr ON rr.id = fi.review_round_id
    WHERE fi.request_id = r.id
    ORDER BY fi.request_revision DESC LIMIT 1
  ) i ON TRUE
  JOIN LATERAL (
    SELECT fp.* FROM dashboard.financial_packages fp
    WHERE fp.invitation_id = i.id
    ORDER BY fp.package_version DESC LIMIT 1
  ) p ON TRUE
  LEFT JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
  LEFT JOIN dashboard.events e ON e.id = rfp.event_id
  LEFT JOIN dashboard.event_subtopics s ON s.id = rfp.subtopic_id
  LEFT JOIN dashboard.request_verifications v ON v.request_id = r.id
  WHERE a.user_id = $1 AND a.role = 'investment-reviewer' AND a.active`

function mapItem(row: CaseRow): InvestmentQueueItem {
  return {
    requestId: row.request_id,
    trackingCode: row.tracking_code,
    title: row.title,
    status: row.status,
    reviewStage: row.review_stage ?? null,
    event: row.event_id && row.event_title ? { id: row.event_id, title: row.event_title } : null,
    subtopic: row.subtopic_id && row.subtopic_title ? { id: row.subtopic_id, title: row.subtopic_title } : null,
    companyName: row.company_name ?? null,
    assignedAt: row.assigned_at.toISOString(),
    reviewedRevision: row.reviewed_revision,
    proposalRevision: row.proposal_revision,
    package: { id: row.package_id, packageVersion: row.package_version, submittedAt: row.submitted_at.toISOString() },
  }
}

export class InvestmentCaseRepository {
  constructor(private readonly pool: Pool) {}

  /** The cases handed off to this person, newest package first. */
  async listQueue(actorId: string, options: { page: number; limit: number }): Promise<InvestmentQueue> {
    const counted = await this.pool.query<{ total: string }>(
      `SELECT count(*) AS total FROM (${CASE_ROWS_SQL}) q`,
      [actorId],
    )
    const total = Number(counted.rows[0]?.total ?? 0)
    const { rows } = await this.pool.query<CaseRow>(
      `SELECT * FROM (${CASE_ROWS_SQL}) q
       ORDER BY submitted_at DESC, request_id
       LIMIT $2 OFFSET $3`,
      [actorId, options.limit, (options.page - 1) * options.limit],
    )
    return {
      items: rows.map(mapItem),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    }
  }

  /** One handed-off case, or null when the actor does not hold it (the caller answers 404). */
  async findCase(actorId: string, requestId: string): Promise<InvestmentCase | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<CaseRow>(
      `SELECT * FROM (${CASE_ROWS_SQL}) q WHERE request_id = $2`,
      [actorId, requestId],
    )
    const row = rows[0]
    if (!row) return null
    return {
      ...mapItem(row),
      packageDetail: {
        checklistVersion: row.checklist_version,
        statementYears: row.statement_years,
        documents: row.documents,
      },
    }
  }
}
