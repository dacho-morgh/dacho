import type { Pool } from 'pg'

export type LetterType = 'rejected' | 'approved' | 'needs_fix' | 'official' | 'notification'

export interface LetterDto {
  id: string
  type: LetterType
  title: string
  body: string
  senderId: string | null
  senderName: string | null
  senderRole: string | null
  recipientId: string
  requestId: string | null
  read: boolean
  sentAt: string
  attachments: unknown[]
  createdAt: string
  updatedAt: string
}

interface LetterRow {
  id: string
  type: LetterType
  title: string
  body: string
  sender_id: string | null
  sender_name: string | null
  sender_role: string | null
  recipient_id: string
  request_id: string | null
  read: boolean
  sent_at: Date
  attachments: unknown[]
  created_at: Date
  updated_at: Date
}

const LETTER_COLUMNS = `
  id, type, title, body, sender_id, sender_name, sender_role, recipient_id,
  request_id, read, sent_at, attachments, created_at, updated_at
`

function mapRow(row: LetterRow): LetterDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    recipientId: row.recipient_id,
    requestId: row.request_id,
    read: row.read,
    sentAt: row.sent_at.toISOString(),
    attachments: row.attachments,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export interface ListLetterOptions {
  ownerId: string
  read?: boolean
  page: number
  limit: number
}

export interface LetterList {
  items: LetterDto[]
  total: number
  page: number
  totalPages: number
}

export class LetterRepository {
  constructor(private readonly pool: Pool) {}

  async list(options: ListLetterOptions): Promise<LetterList> {
    const where: string[] = ['recipient_id = $1']
    const params: unknown[] = [options.ownerId]

    if (options.read !== undefined) {
      params.push(options.read)
      where.push(`read = $${params.length}`)
    }

    const whereSql = where.join(' AND ')

    const { rows: countRows } = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM letters WHERE ${whereSql}`,
      params,
    )
    const total = Number(countRows[0]?.total ?? 0)

    const offset = (options.page - 1) * options.limit
    const { rows } = await this.pool.query<LetterRow>(
      `SELECT ${LETTER_COLUMNS} FROM letters
       WHERE ${whereSql}
       ORDER BY sent_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, options.limit, offset],
    )

    return {
      items: rows.map(mapRow),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    }
  }

  /** Owner-scoped detail that also marks the letter read (idempotent). */
  async findByIdAndMarkRead(id: string, ownerId: string): Promise<LetterDto | undefined> {
    const { rows } = await this.pool.query<LetterRow>(
      `UPDATE letters SET read = true, updated_at = now()
       WHERE id = $1 AND recipient_id = $2
       RETURNING ${LETTER_COLUMNS}`,
      [id, ownerId],
    )
    const row = rows[0]
    return row ? mapRow(row) : undefined
  }
}
