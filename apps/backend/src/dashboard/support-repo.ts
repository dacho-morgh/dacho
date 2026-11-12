import type { Pool, PoolClient } from 'pg'

import { isUuid } from '../db/uuid.js'

export type TicketStatus = 'open' | 'answered' | 'closed'
/** The author of a ticket message: the company side or the internal side. */
export type SupportAuthorRole = 'representative' | 'admin'
export interface SupportMessage {
  id: string
  authorId: string
  authorRole: SupportAuthorRole
  body: string
  createdAt: string
}
/** A file the company attached when opening the ticket; a snapshot of its private document. */
export interface SupportAttachment {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
}
export interface SupportTicket {
  id: string
  requesterId: string
  subject: string
  message: string
  status: TicketStatus
  response: string | null
  respondedBy: string | null
  createdAt: string
  updatedAt: string
  attachments: SupportAttachment[]
  messages: SupportMessage[]
  /** For the requester: a support answer arrived that they have not opened yet. */
  unread: boolean
}
interface TicketRow { id: string; requester_id: string; subject: string; message: string; status: TicketStatus; response: string | null; responded_by: string | null; created_at: Date; updated_at: Date; attachments: unknown; requester_seen_at: Date | null; last_admin_at: Date | null }
interface MessageRow { id: string; author_id: string; author_role: SupportAuthorRole; body: string; created_at: Date }
// The last support answer is read from the messages, so the column list works for SELECT and RETURNING alike.
const LAST_ADMIN_AT = `(SELECT max(m.created_at) FROM dashboard.support_ticket_messages m WHERE m.ticket_id = support_tickets.id AND m.author_role = 'admin')`
const COLUMNS = `id, requester_id, subject, message, status, response, responded_by, created_at, updated_at, attachments, requester_seen_at, ${LAST_ADMIN_AT} AS last_admin_at`
const UNREAD_SQL = `${LAST_ADMIN_AT} > COALESCE(requester_seen_at, created_at)`

function mapAttachments(value: unknown): SupportAttachment[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item): SupportAttachment[] => {
    const entry = item as Partial<SupportAttachment> | null
    return entry && typeof entry.id === 'string' && typeof entry.name === 'string' && typeof entry.mimeType === 'string' && typeof entry.sizeBytes === 'number'
      ? [{ id: entry.id, name: entry.name, mimeType: entry.mimeType, sizeBytes: entry.sizeBytes }]
      : []
  })
}
const mapMessage = (row: MessageRow): SupportMessage => ({ id: row.id, authorId: row.author_id, authorRole: row.author_role, body: row.body, createdAt: row.created_at.toISOString() })
const map = (row: TicketRow, messages: SupportMessage[] = []): SupportTicket => ({ id: row.id, requesterId: row.requester_id, subject: row.subject, message: row.message, status: row.status, response: row.response, respondedBy: row.responded_by, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), attachments: mapAttachments(row.attachments), messages, unread: row.last_admin_at !== null && row.last_admin_at > (row.requester_seen_at ?? row.created_at) })

/**
 * The company's own feed hears about its ticket: the row belongs to the requester and names no
 * request. The ticket stays the source of truth; this only lets the overview show what moved.
 */
async function recordActivity(client: PoolClient, ownerId: string, actorId: string, action: string, title: string, description: string, from: string, to: string): Promise<void> {
  await client.query(
    `INSERT INTO dashboard.activities
       (owner_id, request_id, letter_id, type, title, description, actor_id, action, reason, from_state, to_state, revision)
     VALUES ($1, NULL, NULL, 'transition', $2, $3, $4, $5, NULL, $6, $7, 1)`,
    [ownerId, title, description, actorId, action, from, to],
  )
}

export class SupportRepository {
  constructor(private readonly pool: Pool) {}
  async create(input: { requesterId: string; subject: string; message: string; attachments?: SupportAttachment[] }): Promise<SupportTicket> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<TicketRow>(`INSERT INTO dashboard.support_tickets (requester_id, subject, message, attachments) VALUES ($1, $2, $3, $4::jsonb) RETURNING ${COLUMNS}`, [input.requesterId, input.subject, input.message, JSON.stringify(input.attachments ?? [])])
      if (!rows[0]) throw new Error('INSERT support ticket returned no row')
      const messageResult = await client.query<MessageRow>(`INSERT INTO dashboard.support_ticket_messages (ticket_id, author_id, author_role, body) VALUES ($1, $2, 'representative', $3) RETURNING id, author_id, author_role, body, created_at`, [rows[0].id, input.requesterId, input.message])
      await recordActivity(client, rows[0].requester_id, rows[0].requester_id, 'support_ticket_created', 'پیام شما به پشتیبانی ثبت شد', input.subject, 'new', 'open')
      await client.query('COMMIT')
      return map(rows[0], messageResult.rows.map(mapMessage))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  /** True when a document is already attached to some ticket, so one upload is never reused. */
  async isAttached(documentId: string): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT 1 FROM dashboard.support_tickets WHERE attachments @> $1::jsonb LIMIT 1', [JSON.stringify([{ id: documentId }])])
    return rows.length > 0
  }
  async list(input: { requesterId?: string; status?: string; unread?: boolean; page: number; limit: number }): Promise<{ items: SupportTicket[]; total: number; page: number; totalPages: number }> {
    const where: string[] = []; const params: unknown[] = []
    if (input.requesterId) { params.push(input.requesterId); where.push(`requester_id = $${params.length}`) }
    if (input.status) { params.push(input.status); where.push(`status = $${params.length}`) }
    if (input.unread) where.push(UNREAD_SQL)
    const sqlWhere = where.length ? where.join(' AND ') : 'TRUE'
    const count = await this.pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM dashboard.support_tickets WHERE ${sqlWhere}`, params)
    const total = Number(count.rows[0]?.total ?? 0); const offset = (input.page - 1) * input.limit
    const result = await this.pool.query<TicketRow>(`SELECT ${COLUMNS} FROM dashboard.support_tickets WHERE ${sqlWhere} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, input.limit, offset])
    return { items: result.rows.map((row) => map(row)), total, page: input.page, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
  }
  async findById(id: string): Promise<SupportTicket | undefined> {
    if (!isUuid(id)) return undefined
    const { rows } = await this.pool.query<TicketRow>(`SELECT ${COLUMNS} FROM dashboard.support_tickets WHERE id = $1`, [id])
    if (!rows[0]) return undefined
    const messageResult = await this.pool.query<MessageRow>(`SELECT id, author_id, author_role, body, created_at FROM dashboard.support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at, id`, [id])
    return map(rows[0], messageResult.rows.map(mapMessage))
  }
  async respond(id: string, authorId: string, authorRole: SupportAuthorRole, response: string): Promise<SupportTicket | undefined> {
    if (!isUuid(id)) return undefined
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<TicketRow>(`UPDATE dashboard.support_tickets SET
        response = CASE WHEN $3 = 'admin' THEN $2 ELSE response END,
        responded_by = CASE WHEN $3 = 'admin' THEN $4 ELSE responded_by END,
        status = CASE WHEN $3 = 'admin' THEN 'answered'::dashboard.support_ticket_status ELSE 'open'::dashboard.support_ticket_status END,
        updated_at = now(),
        requester_seen_at = CASE WHEN $3 = 'admin' THEN requester_seen_at ELSE now() END
        WHERE id = $1 AND status <> 'closed' RETURNING ${COLUMNS}`, [id, response, authorRole, authorId])
      if (!rows[0]) { await client.query('ROLLBACK'); return undefined }
      await client.query(`INSERT INTO dashboard.support_ticket_messages (ticket_id, author_id, author_role, body) VALUES ($1, $2, $3, $4)`, [id, authorId, authorRole, response])
      const messageResult = await client.query<MessageRow>(`SELECT id, author_id, author_role, body, created_at FROM dashboard.support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at, id`, [id])
      const answered = authorRole === 'admin'
      await recordActivity(client, rows[0].requester_id, authorId, answered ? 'support_ticket_answered' : 'support_ticket_replied', answered ? 'پشتیبانی به پیام شما پاسخ داد' : 'پاسخ شما برای پشتیبانی ارسال شد', response.slice(0, 200), answered ? 'open' : 'answered', answered ? 'answered' : 'open')
      await client.query('COMMIT')
      return map(rows[0], messageResult.rows.map(mapMessage))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  /** The requester opened the conversation: everything written so far is read. */
  async markSeen(id: string): Promise<void> {
    if (!isUuid(id)) return
    await this.pool.query('UPDATE dashboard.support_tickets SET requester_seen_at = now() WHERE id = $1', [id])
  }
  async close(id: string, actorId: string, actorRole: SupportAuthorRole): Promise<SupportTicket | undefined> {
    if (!isUuid(id)) return undefined
    const { rows } = await this.pool.query<TicketRow>(`UPDATE dashboard.support_tickets SET status = 'closed', responded_by = CASE WHEN $3 = 'admin' THEN COALESCE(responded_by, $2) ELSE responded_by END, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`, [id, actorId, actorRole])
    return rows[0] ? this.findById(id) : undefined
  }
}
