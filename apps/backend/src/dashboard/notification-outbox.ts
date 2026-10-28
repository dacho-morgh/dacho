import type { Pool, PoolClient } from 'pg'
import { isUuid } from '../db/uuid.js'

export type NotificationJobStatus = 'pending' | 'delivered' | 'failed'

export interface NotificationJobRow {
  id: string
  request_id: string
  recipient_id: string
  actor_id: string
  action: string
  from_state: string
  to_state: string
  revision: number
  channel: string
  title: string
  body: string
  status: NotificationJobStatus
  attempts: number
  last_error: string | null
  letter_id: string | null
  created_at: Date
  updated_at: Date
  processed_at: Date | null
}

export interface NotificationJobDto {
  id: string
  requestId: string
  recipientId: string
  actorId: string
  action: string
  fromState: string
  toState: string
  revision: number
  channel: string
  title: string
  body: string
  status: NotificationJobStatus
  attempts: number
  lastError: string | null
  letterId: string | null
  createdAt: string
  updatedAt: string
  processedAt: string | null
}

export interface EnqueueNotificationInput {
  requestId: string
  recipientId: string
  actorId: string
  action: string
  fromState: string
  toState: string
  revision: number
  title: string
  body: string
  channel?: string
}

export interface DeliverResult {
  jobId: string
  status: 'delivered' | 'failed'
  letterId?: string | null
  error?: string | null
  alreadyDelivered?: boolean
}

export interface NotificationOutbox {
  enqueue(client: PoolClient, input: EnqueueNotificationInput): Promise<NotificationJobDto>
  deliver(jobId: string): Promise<DeliverResult>
  retry(jobId: string): Promise<DeliverResult>
  retryAllUndelivered(): Promise<DeliverResult[]>
  list(options?: {
    requestId?: string
    recipientId?: string
    status?: NotificationJobStatus
    page?: number
    limit?: number
  }): Promise<{ items: NotificationJobDto[]; total: number; page: number; totalPages: number }>
  findById(jobId: string): Promise<NotificationJobDto | undefined>
  setSimulationFailure(enabled: boolean): void
  isSimulationFailure(): boolean
}

export function mapNotificationJobRow(row: NotificationJobRow): NotificationJobDto {
  return {
    id: row.id,
    requestId: row.request_id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    action: row.action,
    fromState: row.from_state,
    toState: row.to_state,
    revision: row.revision,
    channel: row.channel,
    title: row.title,
    body: row.body,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    letterId: row.letter_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  }
}

export class PostgresNotificationOutbox implements NotificationOutbox {
  private simulationFailure = false

  constructor(private readonly pool: Pool) {}

  setSimulationFailure(enabled: boolean): void {
    this.simulationFailure = enabled
  }

  isSimulationFailure(): boolean {
    return this.simulationFailure
  }

  async enqueue(client: PoolClient, input: EnqueueNotificationInput): Promise<NotificationJobDto> {
    const { rows } = await client.query<NotificationJobRow>(
      `INSERT INTO dashboard.notification_jobs
         (request_id, recipient_id, actor_id, action, from_state, to_state, revision, channel, title, body, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
       ON CONFLICT (request_id, revision, action, recipient_id) DO UPDATE
         SET updated_at = now()
       RETURNING *`,
      [
        input.requestId,
        input.recipientId,
        input.actorId,
        input.action,
        input.fromState,
        input.toState,
        input.revision,
        input.channel ?? 'in_app',
        input.title,
        input.body,
      ],
    )
    const row = rows[0]
    if (!row) throw new Error('INSERT notification_jobs returned no row')
    return mapNotificationJobRow(row)
  }

  async deliver(jobId: string): Promise<DeliverResult> {
    if (!isUuid(jobId)) {
      return { jobId, status: 'failed', error: 'invalid_id' }
    }

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<NotificationJobRow>(
        `SELECT * FROM dashboard.notification_jobs WHERE id = $1 FOR UPDATE`,
        [jobId],
      )
      const job = rows[0]
      if (!job) {
        await client.query('ROLLBACK')
        return { jobId, status: 'failed', error: 'job_not_found' }
      }

      if (job.status === 'delivered') {
        await client.query('COMMIT')
        return {
          jobId,
          status: 'delivered',
          letterId: job.letter_id,
          alreadyDelivered: true,
        }
      }

      if (this.simulationFailure) {
        throw new Error('Controlled notification failure triggered')
      }

      // Deliver via in-app letter
      // ponytail: v1 supports 'in_app' channel; add SMS/SMTP dispatcher when providers configured
      let letterId = job.letter_id
      if (!letterId && job.channel === 'in_app') {
        const letterRes = await client.query<{ id: string }>(
          `INSERT INTO dashboard.letters
             (type, title, body, sender_id, sender_name, sender_role, recipient_id, request_id, read)
           VALUES ('notification', $1, $2, $3, 'سامانه', 'system', $4, $5, false)
           RETURNING id`,
          [job.title, job.body, job.actor_id, job.recipient_id, job.request_id],
        )
        letterId = letterRes.rows[0]?.id ?? null
      }

      const { rows: updatedRows } = await client.query<NotificationJobRow>(
        `UPDATE dashboard.notification_jobs
         SET status = 'delivered', letter_id = $1, processed_at = now(), updated_at = now(),
             attempts = attempts + 1, last_error = NULL
         WHERE id = $2
         RETURNING *`,
        [letterId, jobId],
      )
      await client.query('COMMIT')

      return {
        jobId,
        status: 'delivered',
        letterId,
      }
    } catch (err) {
      if (client.query) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // ignore rollback error
        }
      }

      const errorMessage = err instanceof Error ? err.message : String(err)
      try {
        // Reuse this connection after rollback; acquiring another while holding
        // it can deadlock a full pool. A concurrent retry may already have delivered.
        await client.query(
          `UPDATE dashboard.notification_jobs
           SET status = 'failed', attempts = attempts + 1, last_error = $1, updated_at = now()
           WHERE id = $2 AND status <> 'delivered'`,
          [errorMessage, jobId],
        )
      } catch {
        // Suppress failure logging errors to avoid crashing callers
      }

      return {
        jobId,
        status: 'failed',
        error: errorMessage,
      }
    } finally {
      client.release()
    }
  }

  async retry(jobId: string): Promise<DeliverResult> {
    return this.deliver(jobId)
  }

  async retryAllUndelivered(): Promise<DeliverResult[]> {
    const { rows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM dashboard.notification_jobs WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`,
    )
    const results: DeliverResult[] = []
    for (const { id } of rows) {
      results.push(await this.deliver(id))
    }
    return results
  }

  async list(options?: {
    requestId?: string
    recipientId?: string
    status?: NotificationJobStatus
    page?: number
    limit?: number
  }): Promise<{ items: NotificationJobDto[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, options?.page ?? 1)
    const limit = Math.max(1, Math.min(100, options?.limit ?? 25))
    const offset = (page - 1) * limit

    const where: string[] = []
    const params: unknown[] = []

    if (options?.requestId && isUuid(options.requestId)) {
      params.push(options.requestId)
      where.push(`request_id = $${params.length}`)
    }
    if (options?.recipientId) {
      params.push(options.recipientId)
      where.push(`recipient_id = $${params.length}`)
    }
    if (options?.status) {
      params.push(options.status)
      where.push(`status = $${params.length}`)
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    const countRes = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM dashboard.notification_jobs ${whereSql}`,
      params,
    )
    const total = Number(countRes.rows[0]?.total ?? 0)

    params.push(limit, offset)
    const { rows } = await this.pool.query<NotificationJobRow>(
      `SELECT * FROM dashboard.notification_jobs
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    return {
      items: rows.map(mapNotificationJobRow),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  async findById(jobId: string): Promise<NotificationJobDto | undefined> {
    if (!isUuid(jobId)) return undefined
    const { rows } = await this.pool.query<NotificationJobRow>(
      `SELECT * FROM dashboard.notification_jobs WHERE id = $1`,
      [jobId],
    )
    return rows[0] ? mapNotificationJobRow(rows[0]) : undefined
  }
}
