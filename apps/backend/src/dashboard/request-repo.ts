import type { Pool, PoolClient } from 'pg'

import type { RequestScope } from '../access/policy.js'
import { isUuid } from '../db/uuid.js'
import { appendTransition } from './transition-history.js'
import { PostgresNotificationOutbox, type NotificationOutbox } from './notification-outbox.js'
import { lockApprovedVerification } from './verification-repo.js'

export type RequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'

/** Event applications only: chief triage precedes the review round (T22). */
export type ReviewStage = 'chief_triage' | 'triaged'

export interface RequestDto {
  id: string
  revision: number
  trackingCode: string
  title: string
  serviceId: string
  serviceKey: string
  serviceName: string
  ownerId: string
  companyId: string | null
  status: RequestStatus
  reviewStage: ReviewStage | null
  currentStepIndex: number
  assignedRole: string | null
  currentStep: string | null
  answers: Record<string, unknown>
  submissionDate: string | null
  dueDate: string | null
  submittedBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface RequestVerificationDto {
  requestId: string
  companyId: string
  verificationId: string
  revision: number
  snapshot: Record<string, unknown>
  createdAt: string
}

/*
 * Product has not approved the agreement texts yet. These IDs name no published
 * text, so an acceptance recorded against them is not final consent and must be
 * collected again once real versions replace them.
 */
export const CURRENT_NON_COMPETE_VERSION = 'non-compete-unapproved-placeholder'
export const CURRENT_EVENT_RULES_VERSION = 'event-rules-unapproved-placeholder'
export const AGREEMENT_TEXTS_APPROVED = false
export const APPLICATION_FORM_VERSION = 'event-application-2026-v1'

export type AgreementType = 'non_compete' | 'event_rules'

export interface ApplicationTeamMember {
  name: string
  role: string
  relation?: string
}

/** The trimmed team, or null unless it is a nonempty list of named members. */
export function parseApplicationTeam(value: unknown): ApplicationTeamMember[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const team: ApplicationTeamMember[] = []
  for (const member of value) {
    if (!member || typeof member !== 'object') return null
    const { name, role, relation } = member as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim() || typeof role !== 'string' || !role.trim()) return null
    if (relation !== undefined && typeof relation !== 'string') return null
    const trimmedRelation = typeof relation === 'string' ? relation.trim() : ''
    team.push({ name: name.trim(), role: role.trim(), ...(trimmedRelation ? { relation: trimmedRelation } : {}) })
  }
  return team
}

export interface RequestAgreementDto {
  id: string
  requestId: string
  revision: number
  agreementType: AgreementType
  textVersionId: string
  acceptedBy: string
  acceptedAt: string
}

export interface PinnedProposalDocument {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  logicalVersion: number
  createdAt: string
}

export interface RequestProposalDto {
  requestId: string
  revision: number
  formVersion: string
  applicationTeam: ApplicationTeamMember[]
  proposalDocuments: PinnedProposalDocument[]
  /** Answers as submitted for this revision; null for revisions that predate the snapshot. */
  answers: Record<string, unknown> | null
  createdAt: string
}

export interface RequestRow {
  id: string
  revision: number
  tracking_code: string
  title: string
  service_id: string
  service_key: string
  service_name: string
  owner_id: string
  company_id: string | null
  status: RequestStatus
  review_stage?: ReviewStage | null
  current_step_index: number
  assigned_role: string | null
  current_step: string | null
  answers: Record<string, unknown>
  submission_date: Date | null
  due_date: Date | null
  submitted_by?: string | null
  created_at: Date
  updated_at: Date
}

export const REQUEST_COLUMNS = `
  id, tracking_code, title, service_id, service_key, service_name, owner_id, company_id, status,
  current_step_index, assigned_role, current_step, answers, submission_date, due_date,
  created_at, updated_at, revision, submitted_by, review_stage
`

const REQUEST_COLUMNS_ALIASED = `
  r.id, r.tracking_code, r.title, r.service_id, r.service_key, r.service_name, r.owner_id,
  r.company_id, r.status, r.current_step_index, r.assigned_role, r.current_step, r.answers,
  r.submission_date, r.due_date, r.created_at, r.updated_at, r.revision, r.submitted_by, r.review_stage
`

export function mapRequestRow(row: RequestRow): RequestDto {
  return {
    id: row.id,
    revision: row.revision,
    trackingCode: row.tracking_code,
    title: row.title,
    serviceId: row.service_id,
    serviceKey: row.service_key,
    serviceName: row.service_name,
    ownerId: row.owner_id,
    companyId: row.company_id ?? null,
    status: row.status,
    reviewStage: row.review_stage ?? null,
    currentStepIndex: row.current_step_index,
    assignedRole: row.assigned_role,
    currentStep: row.current_step,
    answers: row.answers,
    submissionDate: row.submission_date ? row.submission_date.toISOString() : null,
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    submittedBy: row.submitted_by ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function trackingCodeForYear(year: number, seq: string): string {
  return `DCH-${year}-${seq}`
}

async function nextTrackingCode(client: PoolClient, year: number): Promise<string> {
  const { rows } = await client.query<{ seq: string }>(
    `SELECT nextval('dashboard.request_tracking_code_seq')::text AS seq`,
  )
  const sequence = rows[0]?.seq
  if (!sequence) throw new Error('Tracking sequence returned no value')
  return trackingCodeForYear(year, sequence)
}

export interface CreateRequestInput {
  serviceId: string
  serviceKey: string
  serviceName: string
  title: string
  ownerId: string
  companyId?: string | null
  answers: Record<string, unknown>
  rfp?: { eventId: string; subtopicId: string; versionId: string }
}

export interface ListRequestOptions {
  ownerId?: string
  status?: string
  page: number
  limit: number
}

export interface RequestList {
  items: RequestDto[]
  total: number
  page: number
  totalPages: number
}

/**
 * The single row predicate used by scoped lists, details and counts. Assignment
 * scope also requires the assignment role to match the actor's current
 * operational role, so changing that role revokes the old access immediately.
 */
export function requestScopeClause(scope: RequestScope, params: unknown[], alias = 'r'): string {
  switch (scope.kind) {
    case 'all':
      return 'TRUE'
    case 'none':
      return 'FALSE'
    case 'owner':
      params.push(scope.userId)
      return `${alias}.owner_id = $${params.length}`
    case 'company': {
      params.push(scope.companyId)
      const compParam = params.length
      if (scope.userId) {
        params.push(scope.userId)
        return `(${alias}.company_id = $${compParam} OR (${alias}.company_id IS NULL AND ${alias}.owner_id = $${params.length}))`
      }
      return `${alias}.company_id = $${compParam}`
    }
    case 'assigned':
      params.push(scope.userId)
      const userParam = params.length
      params.push(scope.role)
      return `EXISTS (
        SELECT 1 FROM dashboard.case_assignments a
        WHERE a.request_id = ${alias}.id
          AND a.user_id = $${userParam}
          AND a.role = $${params.length}
          AND a.active
      )`
  }
}

/**
 * Pins the current team, proposal files, answers and agreement acceptance as the
 * immutable snapshot for `request.revision`. Returns the missing fields instead
 * of a snapshot when the application is incomplete.
 */
async function pinEventSubmission(
  client: PoolClient,
  request: RequestRow,
  actorId: string,
  eventSubmission?: { nonCompeteVersion: string; eventRulesVersion: string },
): Promise<{ missingFields: string[] } | null> {
  const { rows: docRows } = await client.query<{
    id: string
    original_filename: string
    mime_type: string
    size_bytes: number
    logical_version: number
    created_at: Date
  }>(
    `SELECT id, original_filename, mime_type, size_bytes, logical_version, created_at
     FROM dashboard.private_documents
     WHERE request_id = $1 AND category = 'proposal'
     ORDER BY created_at ASC`,
    [request.id],
  )
  const team = parseApplicationTeam(request.answers?.applicationTeam)
  if (!team || docRows.length === 0 || !eventSubmission) {
    return {
      missingFields: [
        ...(team ? [] : ['applicationTeam']),
        ...(docRows.length > 0 ? [] : ['proposalDocuments']),
        ...(eventSubmission ? [] : ['nonCompeteAcceptance', 'eventRulesAcceptance']),
      ],
    }
  }
  const proposalDocs: PinnedProposalDocument[] = docRows.map((doc) => ({
    id: doc.id,
    filename: doc.original_filename,
    mimeType: doc.mime_type,
    sizeBytes: doc.size_bytes,
    logicalVersion: doc.logical_version,
    createdAt: doc.created_at.toISOString(),
  }))
  await client.query(
    `INSERT INTO dashboard.request_proposals
       (request_id, revision, form_version, application_team, proposal_documents, answers)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      request.id,
      request.revision,
      APPLICATION_FORM_VERSION,
      JSON.stringify(team),
      JSON.stringify(proposalDocs),
      JSON.stringify(request.answers ?? {}),
    ],
  )
  await client.query(
    `INSERT INTO dashboard.request_agreements
       (request_id, revision, agreement_type, text_version_id, accepted_by)
     VALUES
       ($1, $2, 'non_compete', $3, $4),
       ($1, $2, 'event_rules', $5, $4)`,
    [request.id, request.revision, eventSubmission.nonCompeteVersion, actorId, eventSubmission.eventRulesVersion],
  )
  return null
}

/**
 * Gives the event's current responsible chief an active assignment so the case
 * appears in the same scoped queue the chief reads. Idempotent.
 *
 * The chief is read under the event row lock that a chief change takes, so a
 * concurrent handover cannot leave the case assigned to the outgoing chief.
 * Callers hold the request with a NO KEY UPDATE lock (plain UPDATE), which the
 * handover's assignment inserts (FK KEY SHARE) do not wait on, so the
 * request → event order here cannot deadlock with event → request there.
 */
async function ensureChiefAssignment(client: PoolClient, requestId: string): Promise<string | null> {
  const { rows } = await client.query<{ chief_id: string }>(
    `SELECT e.responsible_chief_id AS chief_id
     FROM dashboard.request_rfps rfp
     JOIN dashboard.events e ON e.id = rfp.event_id
     WHERE rfp.request_id = $1
     FOR SHARE OF e`,
    [requestId],
  )
  const chiefId = rows[0]?.chief_id
  if (!chiefId) return null
  await client.query(
    `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by)
     VALUES ($1, $2, 'chief-reviewer', 'system')
     ON CONFLICT (request_id, user_id, role) WHERE active DO NOTHING`,
    [requestId, chiefId],
  )
  return chiefId
}

export type TriageAction = 'accept' | 'return' | 'reject'

const TRIAGE_TRANSITIONS: Record<TriageAction, {
  history: string
  toStatus: RequestStatus
  toStage: ReviewStage
  title: string
  body: (request: RequestRow, reason: string | null) => string
}> = {
  accept: {
    history: 'chief_accept',
    toStatus: 'in_review',
    toStage: 'triaged',
    title: 'تأیید اولیه درخواست',
    body: (r) => `درخواست ${r.title} با کد رهگیری ${r.tracking_code} در بررسی اولیه سردبیر تأیید شد.`,
  },
  return: {
    history: 'chief_return',
    toStatus: 'action_needed',
    toStage: 'chief_triage',
    title: 'برگشت درخواست جهت اصلاح',
    body: (r, reason) => `درخواست ${r.title} با کد رهگیری ${r.tracking_code} برای اصلاح برگردانده شد: ${reason}`,
  },
  reject: {
    history: 'chief_reject',
    toStatus: 'rejected',
    toStage: 'chief_triage',
    title: 'رد درخواست',
    body: (r, reason) => `درخواست ${r.title} با کد رهگیری ${r.tracking_code} رد شد: ${reason}`,
  },
}

export type TriageResult =
  | { request: RequestDto }
  | 'not_found'
  | 'forbidden'
  | 'invalid_state'
  | 'stale_revision'

export type ResubmitResult =
  | RequestDto
  | 'not_found'
  | 'not_correctable'
  | 'company_not_verified'
  | { missingFields: string[] }

export type ReopenResult = RequestDto | 'not_found' | 'not_rejected' | 'stale_revision'

export class RequestRepository {
  private readonly notificationOutbox: NotificationOutbox

  constructor(
    private readonly pool: Pool,
    notificationOutbox?: NotificationOutbox,
  ) {
    this.notificationOutbox = notificationOutbox ?? new PostgresNotificationOutbox(pool)
  }

  async listScoped(
    scope: RequestScope,
    options: { status?: string; page: number; limit: number },
  ): Promise<RequestList> {
    const where: string[] = []
    const params: unknown[] = []
    const scopeSql = requestScopeClause(scope, params, 'r')
    where.push(scopeSql)
    if (options.status) {
      params.push(options.status)
      where.push(`r.status = $${params.length}`)
    }
    const whereSql = where.join(' AND ')
    const count = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM dashboard.requests r WHERE ${whereSql}`,
      params,
    )
    const total = Number(count.rows[0]?.total ?? 0)
    const offset = (options.page - 1) * options.limit
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS_ALIASED}
       FROM dashboard.requests r
       WHERE ${whereSql}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, options.limit, offset],
    )
    return {
      items: rows.map(mapRequestRow),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    }
  }

  async findByIdScoped(id: string, scope: RequestScope): Promise<RequestDto | undefined> {
    if (!isUuid(id)) return undefined
    const params: unknown[] = [id]
    const scopeSql = requestScopeClause(scope, params, 'r')
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS_ALIASED}
       FROM dashboard.requests r
       WHERE r.id = $1 AND ${scopeSql}`,
      params,
    )
    return rows[0] ? mapRequestRow(rows[0]) : undefined
  }

  async create(input: CreateRequestInput): Promise<RequestDto> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      if (input.rfp) {
        const { eventId, subtopicId, versionId } = input.rfp
        const subtopic = await client.query<{ id: string; event_id: string; current_rfp_version_id: string | null }>(
          'SELECT id, event_id, current_rfp_version_id FROM dashboard.event_subtopics WHERE id = $1 FOR SHARE',
          [subtopicId],
        )
        const current = subtopic.rows[0]
        if (!current || current.event_id !== eventId.toLowerCase()) {
          throw new Error('invalid_event_subtopic')
        }
        if (current.current_rfp_version_id !== versionId.toLowerCase()) {
          throw new Error('stale_rfp')
        }

        if (input.companyId) {
          const duplicate = await client.query(
            'SELECT 1 FROM dashboard.request_rfps WHERE company_id = $1 AND event_id = $2 AND subtopic_id = $3',
            [input.companyId, eventId, subtopicId],
          )
          if (duplicate.rows.length > 0) {
            throw new Error('duplicate_subtopic_request')
          }
        }
      }
      const year = new Date().getFullYear()
      const trackingCode = await nextTrackingCode(client, year)
      const { rows } = await client.query<RequestRow>(
        `INSERT INTO dashboard.requests (tracking_code, title, service_id, service_key, service_name, owner_id, company_id, answers)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${REQUEST_COLUMNS}`,
        [trackingCode, input.title, input.serviceId, input.serviceKey, input.serviceName, input.ownerId, input.companyId ?? null, JSON.stringify(input.answers)],
      )
      const created = rows[0]
      if (!created) throw new Error('INSERT requests returned no row')
      if (input.rfp) {
        await client.query(
          'INSERT INTO dashboard.request_rfps (request_id, event_id, subtopic_id, version_id, company_id) VALUES ($1, $2, $3, $4, $5)',
          [created.id, input.rfp.eventId, input.rfp.subtopicId, input.rfp.versionId, input.companyId ?? null],
        )
      }
      await client.query('COMMIT')
      return mapRequestRow(created)
    } catch (err) {
      await client.query('ROLLBACK')
      if (
        (err as { code?: string; constraint?: string })?.code === '23505' &&
        (err as { constraint?: string })?.constraint?.includes('request_rfps_company_subtopic_unique')
      ) {
        throw new Error('duplicate_subtopic_request')
      }
      throw err
    } finally {
      client.release()
    }
  }

  async list(options: ListRequestOptions): Promise<RequestList> {
    const where: string[] = []
    const params: unknown[] = []
    if (options.ownerId) { params.push(options.ownerId); where.push(`owner_id = $${params.length}`) }

    if (options.status) {
      params.push(options.status)
      where.push(`status = $${params.length}`)
    }

    const whereSql = where.length ? where.join(' AND ') : 'TRUE'

    const { rows: countRows } = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM dashboard.requests WHERE ${whereSql}`,
      params,
    )
    const total = Number(countRows[0]?.total ?? 0)

    const offset = (options.page - 1) * options.limit
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS} FROM dashboard.requests
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, options.limit, offset],
    )

    return {
      items: rows.map(mapRequestRow),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    }
  }

  async listAll(options: Omit<ListRequestOptions, 'ownerId'>): Promise<RequestList> {
    return this.list(options)
  }

  async findById(id: string, ownerId: string): Promise<RequestDto | undefined> {
    if (!isUuid(id)) return undefined
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS} FROM dashboard.requests WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    )
    return rows[0] ? mapRequestRow(rows[0]) : undefined
  }

  async findByIdAny(id: string): Promise<RequestDto | undefined> {
    if (!isUuid(id)) return undefined
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS} FROM dashboard.requests WHERE id = $1`, [id],
    )
    return rows[0] ? mapRequestRow(rows[0]) : undefined
  }

  async updateDraft(
    id: string,
    ownerId: string,
    companyId: string | null,
    input: { title?: string; answers?: Record<string, unknown> },
  ): Promise<RequestDto | 'not_found' | 'not_draft'> {
    if (!isUuid(id)) return 'not_found'
    const ownership = companyId
      ? '(company_id = $5 OR (company_id IS NULL AND owner_id = $2))'
      : '(company_id IS NULL AND owner_id = $2)'
    const client = await this.pool.connect()
    try {
      const { rows } = await client.query<RequestRow>(
        `UPDATE dashboard.requests
         SET title = COALESCE($3, title),
             answers = CASE WHEN $4::text IS NOT NULL THEN $4::jsonb ELSE answers END,
             updated_at = now()
         WHERE id = $1 AND ${ownership}
           AND (status = 'draft' OR (status = 'action_needed' AND review_stage = 'chief_triage'))
         RETURNING ${REQUEST_COLUMNS}`,
        [
          id,
          ownerId,
          input.title !== undefined ? input.title.trim() : null,
          input.answers !== undefined ? JSON.stringify(input.answers) : null,
          ...(companyId ? [companyId] : []),
        ],
      )
      const updated = rows[0]
      if (updated) return mapRequestRow(updated)

      const existing = await client.query<RequestRow>(
        `SELECT ${REQUEST_COLUMNS} FROM dashboard.requests
         WHERE id = $1 AND ${companyId ? '(company_id = $3 OR (company_id IS NULL AND owner_id = $2))' : '(company_id IS NULL AND owner_id = $2)'}`,
        [id, ownerId, ...(companyId ? [companyId] : [])],
      )
      return existing.rows[0] ? 'not_draft' : 'not_found'
    } finally {
      client.release()
    }
  }

  /** Draft → in_review, stamping submissionDate + the first workflow step. */
  async submit(
    id: string,
    ownerId: string,
    step?: { assignedRole: string; currentStep: string },
    companyId?: string | null,
    requireVerification = false,
    eventSubmission?: { nonCompeteVersion: string; eventRulesVersion: string },
  ): Promise<RequestDto | 'not_found' | 'already_submitted' | 'stale_rfp' | 'company_not_verified' | { missingFields: string[] }> {
    if (!isUuid(id)) return 'not_found'
    const ownership = companyId
      ? '(company_id = $5 OR (company_id IS NULL AND owner_id = $2))'
      : '(company_id IS NULL AND owner_id = $2)'
    const client = await this.pool.connect()
    let submittedRequest: RequestDto
    let notificationJobId: string
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<RequestRow & { revision: number }>(
        `UPDATE dashboard.requests
         SET status = 'in_review', submission_date = now(), updated_at = now(),
             assigned_role = $3, current_step = $4, revision = revision + 1,
             submitted_by = $2
         WHERE id = $1 AND ${ownership} AND status = 'draft'
         RETURNING ${REQUEST_COLUMNS}`,
        [id, ownerId, step?.assignedRole ?? null, step?.currentStep ?? null, ...(companyId ? [companyId] : [])],
      )
      const updated = rows[0]
      if (!updated) {
        // A competing submit may have won while this UPDATE waited on its row.
        // Only the caller that changed the draft receives a successful transition.
        await client.query('ROLLBACK')
        const existing = await client.query<RequestRow>(
          `SELECT ${REQUEST_COLUMNS} FROM dashboard.requests WHERE id = $1 AND ${companyId ? '(company_id = $3 OR (company_id IS NULL AND owner_id = $2))' : '(company_id IS NULL AND owner_id = $2)'}`,
          [id, ownerId, ...(companyId ? [companyId] : [])],
        )
        return existing.rows[0] ? 'already_submitted' : 'not_found'
      }
      const context = (
        await client.query<{ version_id: string; current_rfp_version_id: string | null }>(
          `SELECT c.version_id, s.current_rfp_version_id
           FROM dashboard.request_rfps c
           JOIN dashboard.event_subtopics s ON s.id = c.subtopic_id
           WHERE c.request_id = $1
           FOR SHARE OF s`,
          [id],
        )
      ).rows[0]
      if (context && context.version_id !== context.current_rfp_version_id) {
        await client.query('ROLLBACK')
        return 'stale_rfp'
      }
      if (requireVerification) {
        const verificationCompanyId = companyId ?? updated.company_id
        // Serialize with re-verification submissions and invalidations. Read the
        // authoritative snapshot inside this transaction, never from the caller.
        const verification = await lockApprovedVerification(client, verificationCompanyId)
        if (!verification) {
          await client.query('ROLLBACK')
          return 'company_not_verified'
        }
        await client.query(
          `INSERT INTO dashboard.request_verifications
             (request_id, company_id, verification_id, revision, snapshot)
           VALUES ($1, $2, $3, $4, $5)`,
          [updated.id, verificationCompanyId, verification.id, verification.revision,
            JSON.stringify(verification.snapshot)],
        )
      }
      if (context) {
        // The UPDATE above holds the row lock that draft edits and document
        // uploads/deletes take, so the pinned snapshot sees exactly what gets saved.
        const missing = await pinEventSubmission(client, updated, ownerId, eventSubmission)
        if (missing) {
          await client.query('ROLLBACK')
          return missing
        }
        await client.query(`UPDATE dashboard.requests SET review_stage = 'chief_triage' WHERE id = $1`, [updated.id])
        updated.review_stage = 'chief_triage'
        await ensureChiefAssignment(client, updated.id)
      }
      await appendTransition(client, {
        requestId: updated.id,
        ownerId: updated.owner_id,
        actorId: ownerId,
        action: 'submit',
        fromState: 'draft',
        toState: updated.status,
        revision: updated.revision,
        reason: null,
      })
      const job = await this.notificationOutbox.enqueue(client, {
        requestId: updated.id,
        recipientId: updated.owner_id,
        actorId: ownerId,
        action: 'submit',
        fromState: 'draft',
        toState: updated.status,
        revision: updated.revision,
        title: 'ارسال درخواست',
        body: `درخواست ${updated.title} با کد رهگیری ${updated.tracking_code} ارسال شد.`,
      })
      submittedRequest = mapRequestRow(updated)
      notificationJobId = job.id
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
    // Delivery needs its own connection. Return the transaction client to the
    // pool first so concurrent submissions cannot exhaust it while awaiting delivery.
    try {
      await this.notificationOutbox.deliver(notificationJobId)
    } catch {
      // The committed pending job remains available for operator recovery.
    }
    return submittedRequest
  }

  /**
   * The responsible chief's triage decision on an event application. Authority is
   * the event's current responsible chief, re-read under lock, never a cached
   * assignment. Every outcome commits the state, revision, history row and
   * notification job together.
   */
  async decideTriage(input: {
    requestId: string
    actorId: string
    action: TriageAction
    reason: string | null
    expectedRevision?: number
  }): Promise<TriageResult> {
    if (!isUuid(input.requestId)) return 'not_found'
    const transition = TRIAGE_TRANSITIONS[input.action]
    const client = await this.pool.connect()
    let decided: RequestRow
    let notificationJobId: string
    try {
      await client.query('BEGIN')
      const locked = await client.query<RequestRow & { chief_id: string }>(
        `SELECT ${REQUEST_COLUMNS_ALIASED}, e.responsible_chief_id AS chief_id
         FROM dashboard.requests r
         JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
         JOIN dashboard.events e ON e.id = rfp.event_id
         WHERE r.id = $1
         FOR NO KEY UPDATE OF r FOR SHARE OF e`,
        [input.requestId],
      )
      const current = locked.rows[0]
      if (!current) {
        await client.query('ROLLBACK')
        return 'not_found'
      }
      if (current.chief_id !== input.actorId) {
        await client.query('ROLLBACK')
        return 'forbidden'
      }
      if (current.status !== 'in_review' || current.review_stage !== 'chief_triage') {
        await client.query('ROLLBACK')
        return 'invalid_state'
      }
      if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
        await client.query('ROLLBACK')
        return 'stale_revision'
      }
      const { rows } = await client.query<RequestRow>(
        `UPDATE dashboard.requests
         SET status = $2, review_stage = $3, revision = revision + 1, updated_at = now()
         WHERE id = $1
         RETURNING ${REQUEST_COLUMNS}`,
        [input.requestId, transition.toStatus, transition.toStage],
      )
      const updated = rows[0]
      if (!updated) throw new Error('UPDATE requests returned no row')
      await appendTransition(client, {
        requestId: updated.id,
        ownerId: updated.owner_id,
        actorId: input.actorId,
        action: transition.history,
        fromState: current.status,
        toState: updated.status,
        revision: updated.revision,
        reason: input.reason,
      })
      const job = await this.notificationOutbox.enqueue(client, {
        requestId: updated.id,
        recipientId: updated.owner_id,
        actorId: input.actorId,
        action: transition.history,
        fromState: current.status,
        toState: updated.status,
        revision: updated.revision,
        title: transition.title,
        body: transition.body(updated, input.reason),
      })
      decided = updated
      notificationJobId = job.id
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
    await this.deliverQuietly(notificationJobId)
    return { request: mapRequestRow(decided) }
  }

  /**
   * Company resubmission of a case the chief returned. The same request and
   * tracking code receive a new revision with its own proposal/agreement snapshot;
   * earlier revisions stay untouched.
   */
  async resubmitCorrection(
    id: string,
    actorId: string,
    companyId: string | null,
    eventSubmission?: { nonCompeteVersion: string; eventRulesVersion: string },
  ): Promise<ResubmitResult> {
    if (!isUuid(id)) return 'not_found'
    const ownership = companyId
      ? '(company_id = $3 OR (company_id IS NULL AND owner_id = $2))'
      : '(company_id IS NULL AND owner_id = $2)'
    const ownershipParams = companyId ? [companyId] : []
    const client = await this.pool.connect()
    let resubmitted: RequestRow
    const jobIds: string[] = []
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<RequestRow>(
        `UPDATE dashboard.requests
         SET status = 'in_review', updated_at = now(), revision = revision + 1, submitted_by = $2
         WHERE id = $1 AND ${ownership} AND status = 'action_needed' AND review_stage = 'chief_triage'
         RETURNING ${REQUEST_COLUMNS}`,
        [id, actorId, ...ownershipParams],
      )
      const updated = rows[0]
      if (!updated) {
        await client.query('ROLLBACK')
        const existing = await client.query(
          `SELECT 1 FROM dashboard.requests WHERE id = $1 AND ${ownership}`,
          [id, actorId, ...ownershipParams],
        )
        return existing.rows.length > 0 ? 'not_correctable' : 'not_found'
      }
      const verification = await lockApprovedVerification(client, companyId ?? updated.company_id)
      if (!verification) {
        await client.query('ROLLBACK')
        return 'company_not_verified'
      }
      const missing = await pinEventSubmission(client, updated, actorId, eventSubmission)
      if (missing) {
        await client.query('ROLLBACK')
        return missing
      }
      const chiefId = await ensureChiefAssignment(client, updated.id)
      await appendTransition(client, {
        requestId: updated.id,
        ownerId: updated.owner_id,
        actorId,
        action: 'correction_submit',
        fromState: 'action_needed',
        toState: updated.status,
        revision: updated.revision,
        reason: null,
      })
      const recipients = new Set([updated.owner_id, ...(chiefId ? [chiefId] : [])])
      for (const recipientId of recipients) {
        const job = await this.notificationOutbox.enqueue(client, {
          requestId: updated.id,
          recipientId,
          actorId,
          action: 'correction_submit',
          fromState: 'action_needed',
          toState: updated.status,
          revision: updated.revision,
          title: 'ارسال اصلاحیه درخواست',
          body: `اصلاحیه درخواست ${updated.title} با کد رهگیری ${updated.tracking_code} ارسال شد.`,
        })
        jobIds.push(job.id)
      }
      resubmitted = updated
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
    for (const jobId of jobIds) await this.deliverQuietly(jobId)
    return mapRequestRow(resubmitted)
  }

  /** Owner-only reopen of a terminally rejected application: same case, new revision, reason on record. */
  async reopenRejected(input: {
    requestId: string
    actorId: string
    reason: string
    expectedRevision?: number
  }): Promise<ReopenResult> {
    if (!isUuid(input.requestId)) return 'not_found'
    const client = await this.pool.connect()
    let reopened: RequestRow
    const jobIds: string[] = []
    try {
      await client.query('BEGIN')
      const locked = await client.query<RequestRow>(
        `SELECT ${REQUEST_COLUMNS} FROM dashboard.requests WHERE id = $1 FOR NO KEY UPDATE`,
        [input.requestId],
      )
      const current = locked.rows[0]
      if (!current) {
        await client.query('ROLLBACK')
        return 'not_found'
      }
      if (current.status !== 'rejected' || current.review_stage !== 'chief_triage') {
        await client.query('ROLLBACK')
        return 'not_rejected'
      }
      if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
        await client.query('ROLLBACK')
        return 'stale_revision'
      }
      const { rows } = await client.query<RequestRow>(
        `UPDATE dashboard.requests
         SET status = 'in_review', revision = revision + 1, updated_at = now()
         WHERE id = $1
         RETURNING ${REQUEST_COLUMNS}`,
        [input.requestId],
      )
      const updated = rows[0]
      if (!updated) throw new Error('UPDATE requests returned no row')
      const chiefId = await ensureChiefAssignment(client, updated.id)
      await appendTransition(client, {
        requestId: updated.id,
        ownerId: updated.owner_id,
        actorId: input.actorId,
        action: 'owner_reopen',
        fromState: 'rejected',
        toState: updated.status,
        revision: updated.revision,
        reason: input.reason,
      })
      const recipients = new Set([updated.owner_id, ...(chiefId ? [chiefId] : [])])
      for (const recipientId of recipients) {
        const job = await this.notificationOutbox.enqueue(client, {
          requestId: updated.id,
          recipientId,
          actorId: input.actorId,
          action: 'owner_reopen',
          fromState: 'rejected',
          toState: updated.status,
          revision: updated.revision,
          title: 'بازگشایی درخواست',
          body: `درخواست ${updated.title} با کد رهگیری ${updated.tracking_code} بازگشایی شد: ${input.reason}`,
        })
        jobIds.push(job.id)
      }
      reopened = updated
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
    for (const jobId of jobIds) await this.deliverQuietly(jobId)
    return mapRequestRow(reopened)
  }

  /** A committed pending job stays available for operator recovery if delivery fails. */
  private async deliverQuietly(jobId: string): Promise<void> {
    try {
      await this.notificationOutbox.deliver(jobId)
    } catch {
      // Recoverable through the outbox retry endpoints.
    }
  }

  /** Ids among `requestIds` whose event names `chiefId` as responsible chief. */
  async requestsOfResponsibleChief(requestIds: string[], chiefId: string): Promise<Set<string>> {
    const ids = requestIds.filter(isUuid)
    if (ids.length === 0) return new Set()
    const { rows } = await this.pool.query<{ request_id: string }>(
      `SELECT rfp.request_id
       FROM dashboard.request_rfps rfp
       JOIN dashboard.events e ON e.id = rfp.event_id
       WHERE rfp.request_id = ANY($1::uuid[]) AND e.responsible_chief_id = $2`,
      [ids, chiefId],
    )
    return new Set(rows.map((row) => row.request_id))
  }

  async findRequestVerification(requestId: string): Promise<RequestVerificationDto | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<{
      request_id: string
      company_id: string
      verification_id: string
      revision: number
      snapshot: Record<string, unknown>
      created_at: Date
    }>(
      `SELECT request_id, company_id, verification_id, revision, snapshot, created_at
       FROM dashboard.request_verifications WHERE request_id = $1`,
      [requestId],
    )
    const row = rows[0]
    if (!row) return null
    return {
      requestId: row.request_id,
      companyId: row.company_id,
      verificationId: row.verification_id,
      revision: row.revision,
      snapshot: row.snapshot,
      createdAt: row.created_at.toISOString(),
    }
  }

  async findRequestProposal(requestId: string, revision?: number): Promise<RequestProposalDto | null> {
    if (!isUuid(requestId)) return null
    const params: unknown[] = [requestId]
    let sql = `SELECT request_id, revision, form_version, application_team, proposal_documents, answers, created_at
               FROM dashboard.request_proposals WHERE request_id = $1`
    if (revision !== undefined) {
      params.push(revision)
      sql += ` AND revision = $${params.length}`
    } else {
      sql += ` ORDER BY revision DESC LIMIT 1`
    }
    const { rows } = await this.pool.query<{
      request_id: string
      revision: number
      form_version: string
      application_team: ApplicationTeamMember[]
      proposal_documents: PinnedProposalDocument[]
      answers: Record<string, unknown> | null
      created_at: Date
    }>(sql, params)
    const row = rows[0]
    if (!row) return null
    return {
      requestId: row.request_id,
      revision: row.revision,
      formVersion: row.form_version,
      applicationTeam: row.application_team,
      proposalDocuments: row.proposal_documents,
      answers: row.answers ?? null,
      createdAt: row.created_at.toISOString(),
    }
  }

  /** Revisions that have a submitted snapshot, oldest first. */
  async listProposalRevisions(requestId: string): Promise<number[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<{ revision: number }>(
      'SELECT revision FROM dashboard.request_proposals WHERE request_id = $1 ORDER BY revision ASC',
      [requestId],
    )
    return rows.map((row) => row.revision)
  }

  async listRequestAgreements(requestId: string, revision?: number): Promise<RequestAgreementDto[]> {
    if (!isUuid(requestId)) return []
    const params: unknown[] = [requestId]
    let sql = `SELECT id, request_id, revision, agreement_type, text_version_id, accepted_by, accepted_at
               FROM dashboard.request_agreements WHERE request_id = $1`
    if (revision !== undefined) {
      params.push(revision)
      sql += ` AND revision = $${params.length}`
    }
    sql += ` ORDER BY revision ASC, agreement_type ASC`
    const { rows } = await this.pool.query<{
      id: string
      request_id: string
      revision: number
      agreement_type: AgreementType
      text_version_id: string
      accepted_by: string
      accepted_at: Date
    }>(sql, params)
    return rows.map((r) => ({
      id: r.id,
      requestId: r.request_id,
      revision: r.revision,
      agreementType: r.agreement_type,
      textVersionId: r.text_version_id,
      acceptedBy: r.accepted_by,
      acceptedAt: r.accepted_at.toISOString(),
    }))
  }
}
