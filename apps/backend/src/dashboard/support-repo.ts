import type { Pool } from 'pg'

export type TicketStatus = 'open' | 'answered' | 'closed'
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
}
interface TicketRow { id: string; requester_id: string; subject: string; message: string; status: TicketStatus; response: string | null; responded_by: string | null; created_at: Date; updated_at: Date }
const COLUMNS = 'id, requester_id, subject, message, status, response, responded_by, created_at, updated_at'
const map = (row: TicketRow): SupportTicket => ({ id: row.id, requesterId: row.requester_id, subject: row.subject, message: row.message, status: row.status, response: row.response, respondedBy: row.responded_by, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() })

export class SupportRepository {
  constructor(private readonly pool: Pool) {}
  async create(input: { requesterId: string; subject: string; message: string }): Promise<SupportTicket> {
    const { rows } = await this.pool.query<TicketRow>(`INSERT INTO dashboard.support_tickets (requester_id, subject, message) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`, [input.requesterId, input.subject, input.message])
    if (!rows[0]) throw new Error('INSERT support ticket returned no row')
    return map(rows[0])
  }
  async list(input: { requesterId?: string; status?: string; page: number; limit: number }): Promise<{ items: SupportTicket[]; total: number; page: number; totalPages: number }> {
    const where: string[] = []; const params: unknown[] = []
    if (input.requesterId) { params.push(input.requesterId); where.push(`requester_id = $${params.length}`) }
    if (input.status) { params.push(input.status); where.push(`status = $${params.length}`) }
    const sqlWhere = where.length ? where.join(' AND ') : 'TRUE'
    const count = await this.pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM dashboard.support_tickets WHERE ${sqlWhere}`, params)
    const total = Number(count.rows[0]?.total ?? 0); const offset = (input.page - 1) * input.limit
    const result = await this.pool.query<TicketRow>(`SELECT ${COLUMNS} FROM dashboard.support_tickets WHERE ${sqlWhere} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, input.limit, offset])
    return { items: result.rows.map(map), total, page: input.page, totalPages: Math.max(1, Math.ceil(total / input.limit)) }
  }
  async findById(id: string): Promise<SupportTicket | undefined> {
    const { rows } = await this.pool.query<TicketRow>(`SELECT ${COLUMNS} FROM dashboard.support_tickets WHERE id = $1`, [id]); return rows[0] ? map(rows[0]) : undefined
  }
  async respond(id: string, staffId: string, response: string): Promise<SupportTicket | undefined> {
    const { rows } = await this.pool.query<TicketRow>(`UPDATE dashboard.support_tickets SET response = $2, responded_by = $3, status = 'answered', updated_at = now() WHERE id = $1 AND status <> 'closed' RETURNING ${COLUMNS}`, [id, response, staffId]); return rows[0] ? map(rows[0]) : undefined
  }
  async close(id: string, staffId: string): Promise<SupportTicket | undefined> {
    const { rows } = await this.pool.query<TicketRow>(`UPDATE dashboard.support_tickets SET status = 'closed', responded_by = COALESCE(responded_by, $2), updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`, [id, staffId]); return rows[0] ? map(rows[0]) : undefined
  }
}
