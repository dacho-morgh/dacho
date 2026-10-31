import type { Pool, PoolClient } from 'pg'

import { isFinancialStageOpen } from '../access/policy.js'
import { isUuid } from '../db/uuid.js'
import { CASE_ROWS_SQL } from './investment-case-repo.js'
import { appendTransition } from './transition-history.js'

export const MAX_MEMO_LENGTH = 20_000

export interface InvestmentMemoDto {
  id: string
  requestId: string
  packageId: string
  version: number
  body: string
  authorId: string
  createdAt: string
  sentAt: string | null
}

export interface SentMemoItem extends InvestmentMemoDto {
  trackingCode: string
  title: string
  companyName: string | null
}

export interface SentMemoList {
  items: SentMemoItem[]
  total: number
  page: number
  totalPages: number
}

export type SaveMemoResult =
  | { status: 'saved' | 'unchanged'; memo: InvestmentMemoDto }
  | { status: 'stage_closed' | 'not_found' }

export type SendMemoResult =
  | { status: 'sent' | 'already_sent'; memo: InvestmentMemoDto }
  | { status: 'stale_version' | 'stage_closed' | 'not_found' }

interface MemoRow {
  id: string
  request_id: string
  package_id: string
  version: number
  body: string
  author_id: string
  created_at: Date
  sent_at: Date | null
}

const MEMO_COLUMNS = 'm.id, m.request_id, m.package_id, m.version, m.body, m.author_id, m.created_at, m.sent_at'

function mapMemo(row: MemoRow): InvestmentMemoDto {
  return {
    id: row.id,
    requestId: row.request_id,
    packageId: row.package_id,
    version: row.version,
    body: row.body,
    authorId: row.author_id,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at?.toISOString() ?? null,
  }
}

interface HeldCase {
  ownerId: string
  status: string
  revision: number
  packageId: string
}

/**
 * Takes the request lock, then checks in the same transaction that the actor still holds
 * the handed-off case, so a revocation that committed first closes the write. Returns
 * `null` for a case the actor does not hold and `closed` once the case has left the stage.
 */
async function lockHeldCase(client: PoolClient, actorId: string, requestId: string): Promise<HeldCase | 'closed' | null> {
  const locked = await client.query<{ owner_id: string; status: string; review_stage: string | null; revision: number }>(
    `SELECT owner_id, status::text AS status, review_stage, revision
     FROM dashboard.requests WHERE id = $1 FOR UPDATE`,
    [requestId],
  )
  const request = locked.rows[0]
  if (!request) return null
  const held = await client.query<{ package_id: string }>(
    `SELECT package_id FROM (${CASE_ROWS_SQL}) q WHERE request_id = $2`,
    [actorId, requestId],
  )
  const packageId = held.rows[0]?.package_id
  if (!packageId) return null
  if (!isFinancialStageOpen(request.status, request.review_stage)) return 'closed'
  return { ownerId: request.owner_id, status: request.status, revision: request.revision, packageId }
}

export class InvestmentMemoRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Stores the text as the case's next version. Retrying a save of the holder's latest
   * unsent text returns that version and writes nothing.
   */
  async save(input: { requestId: string; actorId: string; body: string }): Promise<SaveMemoResult> {
    if (!isUuid(input.requestId)) return { status: 'not_found' }
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const held = await lockHeldCase(client, input.actorId, input.requestId)
      if (!held || held === 'closed') {
        await client.query('ROLLBACK')
        return { status: held ? 'stage_closed' : 'not_found' }
      }
      const latest = await client.query<MemoRow>(
        `SELECT ${MEMO_COLUMNS} FROM dashboard.investment_memos m
         WHERE m.request_id = $1 ORDER BY m.version DESC LIMIT 1`,
        [input.requestId],
      )
      const current = latest.rows[0]
      if (current && !current.sent_at && current.author_id === input.actorId && current.body === input.body) {
        await client.query('COMMIT')
        return { status: 'unchanged', memo: mapMemo(current) }
      }
      const inserted = await client.query<MemoRow>(
        `INSERT INTO dashboard.investment_memos AS m (request_id, package_id, version, body, author_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${MEMO_COLUMNS}`,
        [input.requestId, held.packageId, (current?.version ?? 0) + 1, input.body, input.actorId],
      )
      await appendTransition(client, {
        requestId: input.requestId,
        ownerId: held.ownerId,
        actorId: input.actorId,
        action: 'investment_memo_save',
        fromState: held.status,
        toState: held.status,
        revision: held.revision,
      })
      await client.query('COMMIT')
      return { status: 'saved', memo: mapMemo(inserted.rows[0]!) }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Sends the holder's own version to the Secretariat. Only the latest version can go, so
   * a stale screen cannot send text its author has since replaced. Sending changes neither
   * the case's status nor its stage: the memo carries no decision. A repeated send returns
   * the version already sent.
   */
  async send(input: { requestId: string; actorId: string; version: number }): Promise<SendMemoResult> {
    if (!isUuid(input.requestId)) return { status: 'not_found' }
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const held = await lockHeldCase(client, input.actorId, input.requestId)
      if (!held || held === 'closed') {
        await client.query('ROLLBACK')
        return { status: held ? 'stage_closed' : 'not_found' }
      }
      const found = await client.query<MemoRow & { latest_version: number }>(
        `SELECT ${MEMO_COLUMNS},
                (SELECT max(l.version) FROM dashboard.investment_memos l WHERE l.request_id = m.request_id) AS latest_version
         FROM dashboard.investment_memos m
         WHERE m.request_id = $1 AND m.version = $2 AND m.author_id = $3`,
        [input.requestId, input.version, input.actorId],
      )
      const memo = found.rows[0]
      if (!memo) {
        await client.query('ROLLBACK')
        return { status: 'not_found' }
      }
      if (memo.sent_at) {
        await client.query('COMMIT')
        return { status: 'already_sent', memo: mapMemo(memo) }
      }
      if (memo.version !== memo.latest_version) {
        await client.query('ROLLBACK')
        return { status: 'stale_version' }
      }
      const updated = await client.query<MemoRow>(
        `UPDATE dashboard.investment_memos m SET sent_at = now() WHERE m.id = $1 RETURNING ${MEMO_COLUMNS}`,
        [memo.id],
      )
      await appendTransition(client, {
        requestId: input.requestId,
        ownerId: held.ownerId,
        actorId: input.actorId,
        action: 'investment_memo_send',
        fromState: held.status,
        toState: held.status,
        revision: held.revision,
      })
      await client.query('COMMIT')
      return { status: 'sent', memo: mapMemo(updated.rows[0]!) }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /** The holder's view: their own versions and whatever was sent, so a new holder never reads another person's draft. */
  async listForHolder(actorId: string, requestId: string): Promise<InvestmentMemoDto[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<MemoRow>(
      `SELECT ${MEMO_COLUMNS} FROM dashboard.investment_memos m
       WHERE m.request_id = $1 AND (m.author_id = $2 OR m.sent_at IS NOT NULL)
       ORDER BY m.version DESC`,
      [requestId, actorId],
    )
    return rows.map(mapMemo)
  }

  /** One case's memos, newest first. The Secretariat receives sent versions; the owner also sees drafts. */
  async listForRequest(requestId: string, options: { includeDrafts: boolean }): Promise<InvestmentMemoDto[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<MemoRow>(
      `SELECT ${MEMO_COLUMNS} FROM dashboard.investment_memos m
       WHERE m.request_id = $1 AND ($2 OR m.sent_at IS NOT NULL)
       ORDER BY m.version DESC`,
      [requestId, options.includeDrafts],
    )
    return rows.map(mapMemo)
  }

  /** Every sent memo across cases, newest first: the Secretariat's inbox. */
  async listSent(options: { page: number; limit: number }): Promise<SentMemoList> {
    const counted = await this.pool.query<{ total: string }>(
      'SELECT count(*) AS total FROM dashboard.investment_memos WHERE sent_at IS NOT NULL',
    )
    const total = Number(counted.rows[0]?.total ?? 0)
    const { rows } = await this.pool.query<MemoRow & { tracking_code: string; title: string; company_name: string | null }>(
      `SELECT ${MEMO_COLUMNS}, r.tracking_code, r.title, v.snapshot -> 'company' ->> 'name' AS company_name
       FROM dashboard.investment_memos m
       JOIN dashboard.requests r ON r.id = m.request_id
       LEFT JOIN dashboard.request_verifications v ON v.request_id = r.id
       WHERE m.sent_at IS NOT NULL
       ORDER BY m.sent_at DESC, m.id
       LIMIT $1 OFFSET $2`,
      [options.limit, (options.page - 1) * options.limit],
    )
    return {
      items: rows.map((row) => ({
        ...mapMemo(row),
        trackingCode: row.tracking_code,
        title: row.title,
        companyName: row.company_name ?? null,
      })),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    }
  }
}
