import type { Pool, PoolClient } from 'pg'

import type { RequestScope } from '../access/policy.js'
import { isUuid } from '../db/uuid.js'
import { appendTransition } from './transition-history.js'
import { PostgresNotificationOutbox, type NotificationOutbox } from './notification-outbox.js'
import { lockApprovedVerification } from './verification-repo.js'

export type RequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'

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
  created_at, updated_at, revision, submitted_by
`

const REQUEST_COLUMNS_ALIASED = `
  r.id, r.tracking_code, r.title, r.service_id, r.service_key, r.service_name, r.owner_id,
  r.company_id, r.status, r.current_step_index, r.assigned_role, r.current_step, r.answers,
  r.submission_date, r.due_date, r.created_at, r.updated_at, r.revision, r.submitted_by
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
        if (!current || current.event_id !== eventId) {
          throw new Error('invalid_event_subtopic')
        }
        if (current.current_rfp_version_id !== versionId) {
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

  /** Draft → in_review, stamping submissionDate + the first workflow step. */
  async submit(
    id: string,
    ownerId: string,
    step?: { assignedRole: string; currentStep: string },
    companyId?: string | null,
    requireVerification = false,
  ): Promise<RequestDto | 'not_found' | 'already_submitted' | 'stale_rfp' | 'company_not_verified'> {
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
}
