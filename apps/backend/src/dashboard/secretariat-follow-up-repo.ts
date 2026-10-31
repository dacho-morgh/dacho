import type { Pool, PoolClient } from 'pg'

import { isFinancialStageOpen } from '../access/policy.js'
import { isUuid } from '../db/uuid.js'
import { latestInvitationPackageExists } from './financial-package-repo.js'
import type { NotificationOutbox } from './notification-outbox.js'
import { appendTransition } from './transition-history.js'

export const MAX_RESULT_LENGTH = 20_000
export const MAX_SUPPLEMENTARY_REQUEST_LENGTH = 5_000

export interface SupplementaryRequestDto {
  id: string
  requestId: string
  letterId: string | null
  body: string
  requestedBy: string
  createdAt: string
}

export interface FollowUpFileDto {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
  uploaderId: string
  createdAt: string
  deliveredAt: string | null
  downloadUrl: string
}

export interface ResultVersionDto {
  id: string
  requestId: string
  version: number
  body: string
  authorId: string
  createdAt: string
  sourceMemoId: string | null
  publishedBy: string | null
  publishedAt: string | null
}

/** All anyone outside the Secretariat receives: the disclosed text and when it was published. */
export interface PublishedResultDto {
  body: string
  publishedAt: string
}

export interface FollowUpItem {
  requestId: string
  trackingCode: string
  title: string
  companyName: string | null
  latestMemoVersion: number
  latestMemoSentAt: string
  publishedAt: string | null
}

export interface FollowUpList {
  items: FollowUpItem[]
  total: number
  page: number
  totalPages: number
}

type Closed = { status: 'not_found' | 'stage_closed' | 'memo_not_sent' }

export type RequestDocumentsResult = { status: 'created' | 'unchanged'; request: SupplementaryRequestDto } | Closed
export type DeliverFileResult = { status: 'delivered' | 'already_delivered'; file: FollowUpFileDto } | { status: 'not_found' | 'stage_closed' }
export type SaveResultResult = { status: 'saved' | 'unchanged'; result: ResultVersionDto } | Closed
export type PublishResultResult =
  | { status: 'published' | 'already_published'; result: ResultVersionDto }
  | Closed
  | { status: 'stale_version' }

interface SupplementaryRow {
  id: string
  request_id: string
  letter_id: string | null
  body: string
  requested_by: string
  created_at: Date
}

interface FileRow {
  id: string
  original_filename: string
  mime_type: string
  size_bytes: number
  uploader_id: string
  created_at: Date
  delivered_at: Date | null
}

interface ResultRow {
  id: string
  request_id: string
  version: number
  body: string
  author_id: string
  created_at: Date
  source_memo_id: string | null
  published_by: string | null
  published_at: Date | null
}

function mapSupplementary(row: SupplementaryRow): SupplementaryRequestDto {
  return {
    id: row.id,
    requestId: row.request_id,
    letterId: row.letter_id,
    body: row.body,
    requestedBy: row.requested_by,
    createdAt: row.created_at.toISOString(),
  }
}

function mapFile(row: FileRow): FollowUpFileDto {
  return {
    id: row.id,
    filename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploaderId: row.uploader_id,
    createdAt: row.created_at.toISOString(),
    deliveredAt: row.delivered_at?.toISOString() ?? null,
    downloadUrl: `/api/dashboard/documents/${row.id}/download`,
  }
}

function mapResult(row: ResultRow): ResultVersionDto {
  return {
    id: row.id,
    requestId: row.request_id,
    version: row.version,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at.toISOString(),
    sourceMemoId: row.source_memo_id,
    publishedBy: row.published_by,
    publishedAt: row.published_at?.toISOString() ?? null,
  }
}

const FILE_SELECT = `
  SELECT d.id, d.original_filename, d.mime_type, d.size_bytes, d.uploader_id, d.created_at, sd.delivered_at
  FROM dashboard.private_documents d
  LEFT JOIN dashboard.supplementary_deliveries sd ON sd.document_id = d.id`

interface OpenCase {
  ownerId: string
  status: string
  revision: number
  trackingCode: string
  title: string
}

/**
 * Takes the request lock and checks in the same transaction that the case is handed off
 * and still at the financial stage, so a later chief decision cannot race these commands.
 */
async function lockOpenCase(client: PoolClient, requestId: string): Promise<OpenCase | 'closed' | null> {
  const locked = await client.query<{
    owner_id: string
    status: string
    review_stage: string | null
    revision: number
    tracking_code: string
    title: string
    handed_off: boolean
  }>(
    `SELECT r.owner_id, r.status::text AS status, r.review_stage, r.revision, r.tracking_code, r.title,
            ${latestInvitationPackageExists('r.id')} AS handed_off
     FROM dashboard.requests r WHERE r.id = $1 FOR UPDATE`,
    [requestId],
  )
  const request = locked.rows[0]
  if (!request) return null
  if (!isFinancialStageOpen(request.status, request.review_stage) || !request.handed_off) return 'closed'
  return {
    ownerId: request.owner_id,
    status: request.status,
    revision: request.revision,
    trackingCode: request.tracking_code,
    title: request.title,
  }
}

async function latestSentMemoId(client: PoolClient, requestId: string): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM dashboard.investment_memos
     WHERE request_id = $1 AND sent_at IS NOT NULL
     ORDER BY version DESC LIMIT 1`,
    [requestId],
  )
  return rows[0]?.id ?? null
}

export class SecretariatFollowUpRepository {
  constructor(
    private readonly pool: Pool,
    private readonly notificationOutbox: NotificationOutbox,
  ) {}

  /**
   * Asks the company for more documents in a case-linked letter. This is correspondence:
   * it publishes nothing and changes neither the case's status nor its stage. Sending the
   * latest text again returns that request, so a double submit writes one letter.
   */
  async requestDocuments(input: {
    requestId: string
    actorId: string
    actorName: string | null
    actorRole: string
    body: string
  }): Promise<RequestDocumentsResult> {
    if (!isUuid(input.requestId)) return { status: 'not_found' }
    return this.inTransaction(async (client) => {
      const open = await lockOpenCase(client, input.requestId)
      if (!open) return { status: 'not_found' }
      if (open === 'closed') return { status: 'stage_closed' }
      if (!(await latestSentMemoId(client, input.requestId))) return { status: 'memo_not_sent' }
      const latest = await client.query<SupplementaryRow>(
        `SELECT * FROM dashboard.supplementary_requests
         WHERE request_id = $1 ORDER BY created_at DESC, id LIMIT 1`,
        [input.requestId],
      )
      if (latest.rows[0]?.body === input.body) {
        return { status: 'unchanged', request: mapSupplementary(latest.rows[0]) }
      }
      const letter = await client.query<{ id: string }>(
        `INSERT INTO dashboard.letters (type, title, body, sender_id, sender_name, sender_role, recipient_id, request_id, read)
         VALUES ('official', $1, $2, $3, $4, $5, $6, $7, false)
         RETURNING id`,
        [
          `درخواست مدارک تکمیلی پرونده ${open.trackingCode}`,
          input.body,
          input.actorId,
          input.actorName,
          input.actorRole,
          open.ownerId,
          input.requestId,
        ],
      )
      const inserted = await client.query<SupplementaryRow>(
        `INSERT INTO dashboard.supplementary_requests (request_id, letter_id, body, requested_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [input.requestId, letter.rows[0]!.id, input.body, input.actorId],
      )
      await appendTransition(client, {
        requestId: input.requestId,
        ownerId: open.ownerId,
        actorId: input.actorId,
        action: 'supplementary_request',
        fromState: open.status,
        toState: open.status,
        revision: open.revision,
      })
      return { status: 'created', request: mapSupplementary(inserted.rows[0]!) }
    })
  }

  /** Opens one of the case's correspondence files to the investment person holding the case. */
  async deliverFile(input: { requestId: string; actorId: string; documentId: string }): Promise<DeliverFileResult> {
    if (!isUuid(input.requestId) || !isUuid(input.documentId)) return { status: 'not_found' }
    return this.inTransaction(async (client) => {
      const open = await lockOpenCase(client, input.requestId)
      if (!open) return { status: 'not_found' }
      if (open === 'closed') return { status: 'stage_closed' }
      const found = await client.query<{ id: string }>(
        `SELECT id FROM dashboard.private_documents
         WHERE id = $1 AND request_id = $2 AND category = 'correspondenceAttachment'`,
        [input.documentId, input.requestId],
      )
      if (!found.rows[0]) return { status: 'not_found' }
      const inserted = await client.query(
        `INSERT INTO dashboard.supplementary_deliveries (request_id, document_id, delivered_by)
         VALUES ($1, $2, $3) ON CONFLICT (document_id) DO NOTHING`,
        [input.requestId, input.documentId, input.actorId],
      )
      const delivered = (inserted.rowCount ?? 0) > 0
      if (delivered) {
        await appendTransition(client, {
          requestId: input.requestId,
          ownerId: open.ownerId,
          actorId: input.actorId,
          action: 'supplementary_delivery',
          fromState: open.status,
          toState: open.status,
          revision: open.revision,
        })
      }
      const { rows } = await client.query<FileRow>(`${FILE_SELECT} WHERE d.id = $1`, [input.documentId])
      return { status: delivered ? 'delivered' : 'already_delivered', file: mapFile(rows[0]!) }
    })
  }

  /** Stores the company-facing text as the next version. Nothing reaches the company until it is published. */
  async saveResult(input: { requestId: string; actorId: string; body: string }): Promise<SaveResultResult> {
    if (!isUuid(input.requestId)) return { status: 'not_found' }
    return this.inTransaction(async (client) => {
      const open = await lockOpenCase(client, input.requestId)
      if (!open) return { status: 'not_found' }
      if (open === 'closed') return { status: 'stage_closed' }
      if (!(await latestSentMemoId(client, input.requestId))) return { status: 'memo_not_sent' }
      const latest = await client.query<ResultRow>(
        `SELECT * FROM dashboard.published_results WHERE request_id = $1 ORDER BY version DESC LIMIT 1`,
        [input.requestId],
      )
      const current = latest.rows[0]
      if (current && !current.published_at && current.body === input.body) {
        return { status: 'unchanged', result: mapResult(current) }
      }
      const inserted = await client.query<ResultRow>(
        `INSERT INTO dashboard.published_results (request_id, version, body, author_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [input.requestId, (current?.version ?? 0) + 1, input.body, input.actorId],
      )
      await appendTransition(client, {
        requestId: input.requestId,
        ownerId: open.ownerId,
        actorId: input.actorId,
        action: 'result_save',
        fromState: open.status,
        toState: open.status,
        revision: open.revision,
      })
      return { status: 'saved', result: mapResult(inserted.rows[0]!) }
    })
  }

  /**
   * Publishes one saved version, and only the latest, so a stale screen cannot disclose
   * replaced text. The server records which sent memo it followed; that reference never
   * leaves the Secretariat's routes. A repeated publish returns the version already published.
   */
  async publishResult(input: { requestId: string; actorId: string; version: number }): Promise<PublishResultResult> {
    if (!isUuid(input.requestId)) return { status: 'not_found' }
    let jobId: string | null = null
    const outcome = await this.inTransaction<PublishResultResult>(async (client) => {
      const open = await lockOpenCase(client, input.requestId)
      if (!open) return { status: 'not_found' }
      if (open === 'closed') return { status: 'stage_closed' }
      const found = await client.query<ResultRow & { latest_version: number }>(
        `SELECT p.*, (SELECT max(l.version) FROM dashboard.published_results l WHERE l.request_id = p.request_id) AS latest_version
         FROM dashboard.published_results p WHERE p.request_id = $1 AND p.version = $2`,
        [input.requestId, input.version],
      )
      const target = found.rows[0]
      if (!target) return { status: 'not_found' }
      if (target.published_at) return { status: 'already_published', result: mapResult(target) }
      if (target.version !== target.latest_version) return { status: 'stale_version' }
      const memoId = await latestSentMemoId(client, input.requestId)
      if (!memoId) return { status: 'memo_not_sent' }
      const updated = await client.query<ResultRow>(
        `UPDATE dashboard.published_results
         SET published_by = $2, published_at = now(), source_memo_id = $3
         WHERE id = $1 RETURNING *`,
        [target.id, input.actorId, memoId],
      )
      await appendTransition(client, {
        requestId: input.requestId,
        ownerId: open.ownerId,
        actorId: input.actorId,
        action: 'result_publish',
        fromState: open.status,
        toState: open.status,
        revision: open.revision,
      })
      // A corrected publication keeps the revision, so the version keeps each notice its own job.
      const job = await this.notificationOutbox.enqueue(client, {
        requestId: input.requestId,
        recipientId: open.ownerId,
        actorId: input.actorId,
        action: `result_publish_v${target.version}`,
        fromState: open.status,
        toState: open.status,
        revision: open.revision,
        title: 'انتشار نتیجه پرونده',
        body: `نتیجه پرونده ${open.title} با کد رهگیری ${open.trackingCode} منتشر شد. متن آن را در صفحه پرونده ببینید.`,
      })
      jobId = job.id
      return { status: 'published', result: mapResult(updated.rows[0]!) }
    })
    if (jobId) {
      try {
        await this.notificationOutbox.deliver(jobId)
      } catch {
        // The committed pending job remains available for operator recovery.
      }
    }
    return outcome
  }

  /** The latest published text, or null. No draft, author or memo reference is in this answer. */
  async findPublished(requestId: string): Promise<PublishedResultDto | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<{ body: string; published_at: Date }>(
      `SELECT body, published_at FROM dashboard.published_results
       WHERE request_id = $1 AND published_at IS NOT NULL
       ORDER BY version DESC LIMIT 1`,
      [requestId],
    )
    const row = rows[0]
    return row ? { body: row.body, publishedAt: row.published_at.toISOString() } : null
  }

  async listResultVersions(requestId: string): Promise<ResultVersionDto[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<ResultRow>(
      'SELECT * FROM dashboard.published_results WHERE request_id = $1 ORDER BY version DESC',
      [requestId],
    )
    return rows.map(mapResult)
  }

  async listSupplementaryRequests(requestId: string): Promise<SupplementaryRequestDto[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<SupplementaryRow>(
      `SELECT * FROM dashboard.supplementary_requests WHERE request_id = $1 ORDER BY created_at DESC, id`,
      [requestId],
    )
    return rows.map(mapSupplementary)
  }

  /** Every correspondence file of the case, delivered or not: the Secretariat's choice list. */
  async listCaseFiles(requestId: string): Promise<FollowUpFileDto[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<FileRow>(
      `${FILE_SELECT}
       WHERE d.request_id = $1 AND d.category = 'correspondenceAttachment'
       ORDER BY d.created_at DESC, d.id`,
      [requestId],
    )
    return rows.map(mapFile)
  }

  /** What the investment person holding the case may read. */
  async listDeliveredFiles(requestId: string): Promise<FollowUpFileDto[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<FileRow>(
      `${FILE_SELECT}
       WHERE d.request_id = $1 AND sd.document_id IS NOT NULL
       ORDER BY sd.delivered_at DESC, d.id`,
      [requestId],
    )
    return rows.map(mapFile)
  }

  /** One row per case with a sent memo. Cases without a published result come first. */
  async listFollowUps(options: { page: number; limit: number }): Promise<FollowUpList> {
    const counted = await this.pool.query<{ total: string }>(
      'SELECT count(DISTINCT request_id) AS total FROM dashboard.investment_memos WHERE sent_at IS NOT NULL',
    )
    const total = Number(counted.rows[0]?.total ?? 0)
    const { rows } = await this.pool.query<{
      request_id: string
      tracking_code: string
      title: string
      company_name: string | null
      latest_memo_version: number
      latest_memo_sent_at: Date
      published_at: Date | null
    }>(
      `SELECT r.id AS request_id, r.tracking_code, r.title,
              v.snapshot -> 'company' ->> 'name' AS company_name,
              m.version AS latest_memo_version, m.sent_at AS latest_memo_sent_at,
              pr.published_at
       FROM dashboard.requests r
       JOIN LATERAL (
         SELECT version, sent_at FROM dashboard.investment_memos
         WHERE request_id = r.id AND sent_at IS NOT NULL
         ORDER BY version DESC LIMIT 1
       ) m ON TRUE
       LEFT JOIN LATERAL (
         SELECT published_at FROM dashboard.published_results
         WHERE request_id = r.id AND published_at IS NOT NULL
         ORDER BY version DESC LIMIT 1
       ) pr ON TRUE
       LEFT JOIN dashboard.request_verifications v ON v.request_id = r.id
       ORDER BY pr.published_at IS NOT NULL, m.sent_at DESC, r.id
       LIMIT $1 OFFSET $2`,
      [options.limit, (options.page - 1) * options.limit],
    )
    return {
      items: rows.map((row) => ({
        requestId: row.request_id,
        trackingCode: row.tracking_code,
        title: row.title,
        companyName: row.company_name ?? null,
        latestMemoVersion: row.latest_memo_version,
        latestMemoSentAt: row.latest_memo_sent_at.toISOString(),
        publishedAt: row.published_at?.toISOString() ?? null,
      })),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    }
  }

  private async inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
