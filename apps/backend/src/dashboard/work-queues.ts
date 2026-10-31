import type { OperationalRole } from '../access/roles.js'
import { latestInvitationPackageExists } from './financial-package-repo.js'

/**
 * Work a role has to act on, read from each case's real state. Every queue narrows
 * the actor's row scope and never widens it, and the list and its count run the same
 * predicate, so a count cannot disagree with the list behind it.
 */
export const REQUEST_WORK_QUEUES = {
  'system-owner': ['reopen_rejected'],
  'central-secretariat': ['follow_up_unpublished', 'supplementary_undelivered'],
  'chief-reviewer': ['chief_triage', 'chief_start_review', 'chief_decide'],
  reviewer: ['evaluation_pending'],
  'employer-reviewer': ['evaluation_pending'],
  'investment-reviewer': ['memo_pending'],
  representative: ['company_draft', 'company_correction', 'company_financial_package', 'company_supplementary'],
} as const satisfies Record<OperationalRole, readonly string[]>

export type RequestWorkQueue = (typeof REQUEST_WORK_QUEUES)[OperationalRole][number]

export interface RequestWorkQueueFilter {
  key: RequestWorkQueue
  actorId: string
  role: OperationalRole
}

export function isRequestWorkQueueOf(role: OperationalRole, value: unknown): value is RequestWorkQueue {
  return (REQUEST_WORK_QUEUES[role] as readonly unknown[]).includes(value)
}

/** The stage in which the memo, supplementary and publication commands accept a write (T31–T33). */
const FINANCIAL_STAGE_HANDED_OFF = `r.status = 'in_review' AND r.review_stage = 'advanced' AND ${latestInvitationPackageExists('r.id')}`

const CURRENT_ROUND = `dashboard.review_rounds rr WHERE rr.request_id = r.id AND rr.request_revision = r.revision`

/** A case in triage or review counts for the event's current responsible chief only, as `allowedRequestActions` does. */
function responsibleChief(actorId: string, params: unknown[]): string {
  params.push(actorId)
  return `EXISTS (
    SELECT 1 FROM dashboard.request_rfps rfp
    JOIN dashboard.events e ON e.id = rfp.event_id
    WHERE rfp.request_id = r.id AND e.responsible_chief_id = $${params.length}
  )`
}

/** The predicate of one queue, for a statement that reads `dashboard.requests` as `r`. */
export function requestWorkQueueClause({ key, actorId, role }: RequestWorkQueueFilter, params: unknown[]): string {
  switch (key) {
    case 'reopen_rejected':
      return `(r.status = 'rejected' AND r.review_stage = 'chief_triage')`
    case 'follow_up_unpublished':
      return `(${FINANCIAL_STAGE_HANDED_OFF}
        AND EXISTS (SELECT 1 FROM dashboard.investment_memos m WHERE m.request_id = r.id AND m.sent_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM dashboard.published_results pr WHERE pr.request_id = r.id AND pr.published_at IS NOT NULL))`
    case 'supplementary_undelivered':
      // The company answered the latest request and nothing has been delivered since.
      // Any other correspondence file on the case is not work the Secretariat owes.
      return `(${FINANCIAL_STAGE_HANDED_OFF} AND EXISTS (
        SELECT 1 FROM (
          SELECT sr.created_at, sr.requested_by FROM dashboard.supplementary_requests sr
          WHERE sr.request_id = r.id ORDER BY sr.created_at DESC LIMIT 1
        ) latest
        WHERE EXISTS (
          SELECT 1 FROM dashboard.private_documents d
          WHERE d.request_id = r.id AND d.category = 'correspondenceAttachment'
            AND d.uploader_id <> latest.requested_by AND d.created_at > latest.created_at
        ) AND NOT EXISTS (
          SELECT 1 FROM dashboard.supplementary_deliveries sd
          WHERE sd.request_id = r.id AND sd.delivered_at > latest.created_at
        )
      ))`
    case 'chief_triage':
      return `(r.status = 'in_review' AND r.review_stage = 'chief_triage' AND ${responsibleChief(actorId, params)})`
    case 'chief_start_review':
      return `(r.status = 'in_review' AND r.review_stage = 'triaged' AND ${responsibleChief(actorId, params)}
        AND NOT EXISTS (SELECT 1 FROM ${CURRENT_ROUND}))`
    case 'chief_decide':
      return `(r.status = 'in_review' AND r.review_stage = 'triaged' AND ${responsibleChief(actorId, params)}
        AND EXISTS (SELECT 1 FROM ${CURRENT_ROUND} AND rr.completed_at IS NOT NULL))`
    case 'evaluation_pending': {
      params.push(actorId, role)
      const user = params.length - 1
      return `(r.status = 'in_review' AND r.review_stage IS DISTINCT FROM 'advanced' AND EXISTS (
        SELECT 1 FROM dashboard.case_assignments a
        LEFT JOIN dashboard.review_rounds rr ON rr.id = a.round_id
        WHERE a.request_id = r.id AND a.user_id = $${user} AND a.role = $${user + 1} AND a.active
          AND (a.round_id IS NULL OR rr.request_revision = r.revision)
          AND NOT EXISTS (
            SELECT 1 FROM dashboard.evaluations ev
            WHERE ev.request_id = r.id AND ev.user_id = a.user_id
              AND ev.revision = r.revision AND ev.state = 'final'
          )
      ))`
    }
    case 'memo_pending':
      // Done once a memo on the current package went out after the last delivered file.
      return `(${FINANCIAL_STAGE_HANDED_OFF} AND NOT EXISTS (
        SELECT 1 FROM dashboard.investment_memos m
        JOIN dashboard.financial_packages fp ON fp.id = m.package_id
        WHERE m.request_id = r.id AND m.sent_at IS NOT NULL
          AND fp.invitation_id = (
            SELECT fi.id FROM dashboard.financial_invitations fi
            WHERE fi.request_id = r.id ORDER BY fi.request_revision DESC LIMIT 1
          )
          AND NOT EXISTS (
            SELECT 1 FROM dashboard.supplementary_deliveries sd
            WHERE sd.request_id = r.id AND sd.delivered_at > m.sent_at
          )
      ))`
    case 'company_draft':
      return `r.status = 'draft'`
    case 'company_correction':
      return `(r.status = 'action_needed' AND r.review_stage = 'chief_triage')`
    case 'company_financial_package':
      return `(r.status = 'in_review' AND r.review_stage = 'advanced' AND NOT ${latestInvitationPackageExists('r.id')})`
    case 'company_supplementary':
      // A request stays open until the company's next correspondence file.
      params.push(actorId)
      return `(${FINANCIAL_STAGE_HANDED_OFF} AND EXISTS (
        SELECT 1 FROM (
          SELECT sr.created_at FROM dashboard.supplementary_requests sr
          WHERE sr.request_id = r.id ORDER BY sr.created_at DESC LIMIT 1
        ) latest
        WHERE NOT EXISTS (
          SELECT 1 FROM dashboard.private_documents d
          WHERE d.request_id = r.id AND d.category = 'correspondenceAttachment'
            AND d.uploader_id = $${params.length} AND d.created_at > latest.created_at
        )
      ))`
  }
}
