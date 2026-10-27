import type { Pool } from 'pg'

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
  messages: SupportMessage[]
}
interface TicketRow { id: string; requester_id: string; subject: string; message: string; status: TicketStatus; response: string | null; responded_by: string | null; created_at: Date; updated_at: Date }
interface MessageRow { id: string; author_id: string; author_role: SupportAuthorRole; body: string; created_at: Date }
const COLUMNS = 'id, requester_id, subject, message, status, response, responded_by, created_at, updated_at'
const mapMessage = (row: MessageRow): SupportMessage => ({ id: row.id, authorId: row.author_id, authorRole: row.author_role, body: row.body, createdAt: row.created_at.toISOString() })
const map = (row: TicketRow, messages: SupportMessage[] = []): SupportTicket => ({ id: row.id, requesterId: row.requester_id, subject: row.subject, message: row.message, status: row.status, response: row.response, respondedBy: row.responded_by, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), messages })

export class SupportRepository {
  constructor(private readonly pool: Pool) {}
  async create(input: { requesterId: string; subject: string; message: string }): Promise<SupportTicket> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<TicketRow>(`INSERT INTO dashboard.support_tickets (requester_id, subject, message) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`, [input.requesterId, input.subject, input.message])
      if (!rows[0]) throw new Error('INSERT support ticket returned no row')
      const messageResult = await client.query<MessageRow>(`INSERT INTO dashboard.support_ticket_messages (ticket_id, author_id, author_role, body) VALUES ($1, $2, 'representative', $3) RETURNING id, author_id, author_role, body, created_at`, [rows[0].id, input.requesterId, input.message])
      await client.query('COMMIT')
      return map(rows[0], messageResult.rows.map(mapMessage))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  async list(input: { requesterId?: string; status?: string; page: number; limit: number }): Promise<{ items: SupportTicket[]; total: number; page: number; totalPages: number }> {
    const where: string[] = []; const params: unknown[] = []
    if (input.requesterId) { params.push(input.requesterId); where.push(`requester_id = $${params.length}`) }
    if (input.status) { params.push(input.status); where.push(`status = $${params.length}`) }
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
        updated_at = now()
        WHERE id = $1 AND status <> 'closed' RETURNING ${COLUMNS}`, [id, response, authorRole, authorId])
      if (!rows[0]) { await client.query('ROLLBACK'); return undefined }
      await client.query(`INSERT INTO dashboard.support_ticket_messages (ticket_id, author_id, author_role, body) VALUES ($1, $2, $3, $4)`, [id, authorId, authorRole, response])
      const messageResult = await client.query<MessageRow>(`SELECT id, author_id, author_role, body, created_at FROM dashboard.support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at, id`, [id])
      await client.query('COMMIT')
      return map(rows[0], messageResult.rows.map(mapMessage))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  async close(id: string, actorId: string, actorRole: SupportAuthorRole): Promise<SupportTicket | undefined> {
    if (!isUuid(id)) return undefined
    const { rows } = await this.pool.query<TicketRow>(`UPDATE dashboard.support_tickets SET status = 'closed', responded_by = CASE WHEN $3 = 'admin' THEN COALESCE(responded_by, $2) ELSE responded_by END, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`, [id, actorId, actorRole])
    return rows[0] ? this.findById(id) : undefined
  }
}
