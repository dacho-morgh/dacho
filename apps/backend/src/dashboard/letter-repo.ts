import type { Pool } from 'pg'

import type { RequestScope } from '../access/policy.js'

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

/**
 * Case letters are visible to current case participants only. Personal letters
 * retain sender/recipient mailbox access. Case assignment by itself is not
 * enough to reveal correspondence between other participants.
 */
function letterScopeClause(scope: RequestScope, params: unknown[], alias = 'l'): string {
  switch (scope.kind) {
    case 'all':
      return 'TRUE'
    case 'none':
      return 'FALSE'
    case 'owner':
      params.push(scope.userId)
      return `(
        (${alias}.request_id IS NULL AND (${alias}.recipient_id = $${params.length} OR ${alias}.sender_id = $${params.length}))
        OR (${alias}.request_id IN (SELECT r.id FROM dashboard.requests r WHERE r.owner_id = $${params.length})
            AND (${alias}.recipient_id = $${params.length} OR ${alias}.sender_id = $${params.length}))
      )`
    case 'assigned':
      params.push(scope.userId)
      const userParam = params.length
      params.push(scope.role)
      return `(
        (${alias}.request_id IS NULL AND (${alias}.recipient_id = $${userParam} OR ${alias}.sender_id = $${userParam}))
        OR (${alias}.request_id IN (
          SELECT ca.request_id FROM dashboard.case_assignments ca
          WHERE ca.user_id = $${userParam} AND ca.role = $${params.length} AND ca.active
        ) AND (${alias}.recipient_id = $${userParam} OR ${alias}.sender_id = $${userParam}))
      )`
  }
}

/** Deletion is a mailbox action for recipients; assignment and authorship do not grant it. */
function letterDeleteScopeClause(scope: RequestScope, params: unknown[], alias = 'l'): string {
  switch (scope.kind) {
    case 'all': return 'TRUE'
    case 'none': return 'FALSE'
    case 'owner':
    case 'assigned':
      const readable = letterScopeClause(scope, params, alias)
      params.push(scope.userId)
      return `(${readable}) AND ${alias}.recipient_id = $${params.length}`
  }
}

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

export interface CreateLetterInput {
  type: LetterType
  title: string
  body: string
  recipientId: string
  senderId?: string | null
  senderName?: string | null
  senderRole?: string | null
  requestId?: string | null
}

export class LetterRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateLetterInput): Promise<LetterDto> {
    const { rows } = await this.pool.query<LetterRow>(
      `INSERT INTO dashboard.letters (type, title, body, sender_id, sender_name, sender_role, recipient_id, request_id, read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING ${LETTER_COLUMNS}`,
      [input.type, input.title, input.body, input.senderId ?? null, input.senderName ?? null, input.senderRole ?? null, input.recipientId, input.requestId ?? null],
    )
    if (!rows[0]) throw new Error('INSERT dashboard.letters returned no row')
    return mapRow(rows[0])
  }

  async listAll(options: { page: number; limit: number; recipientId?: string }): Promise<LetterList> {
    const where = options.recipientId ? 'WHERE recipient_id = $1' : ''
    const params: unknown[] = options.recipientId ? [options.recipientId] : []
    const count = await this.pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM dashboard.letters ${where}`, params)
    const total = Number(count.rows[0]?.total ?? 0)
    const offset = (options.page - 1) * options.limit
    const result = await this.pool.query<LetterRow>(`SELECT ${LETTER_COLUMNS} FROM dashboard.letters ${where} ORDER BY sent_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, options.limit, offset])
    return { items: result.rows.map(mapRow), total, page: options.page, totalPages: Math.max(1, Math.ceil(total / options.limit)) }
  }

  async list(options: ListLetterOptions): Promise<LetterList> {
    const where: string[] = ['recipient_id = $1']
    const params: unknown[] = [options.ownerId]

    if (options.read !== undefined) {
      params.push(options.read)
      where.push(`read = $${params.length}`)
    }

    const whereSql = where.join(' AND ')

    const { rows: countRows } = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM dashboard.letters WHERE ${whereSql}`,
      params,
    )
    const total = Number(countRows[0]?.total ?? 0)

    const offset = (options.page - 1) * options.limit
    const { rows } = await this.pool.query<LetterRow>(
      `SELECT ${LETTER_COLUMNS} FROM dashboard.letters
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

  async listScoped(
    scope: RequestScope,
    options: { read?: boolean; page: number; limit: number },
  ): Promise<LetterList> {
    const params: unknown[] = []
    const where: string[] = [letterScopeClause(scope, params, 'l')]
    if (options.read !== undefined) {
      params.push(options.read)
      where.push(`l.read = $${params.length}`)
    }
    const whereSql = where.join(' AND ')
    const count = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM dashboard.letters l WHERE ${whereSql}`,
      params,
    )
    const total = Number(count.rows[0]?.total ?? 0)
    const offset = (options.page - 1) * options.limit
    const { rows } = await this.pool.query<LetterRow>(
      `SELECT l.id, l.type, l.title, l.body, l.sender_id, l.sender_name, l.sender_role,
              l.recipient_id, l.request_id, l.read, l.sent_at, l.attachments,
              l.created_at, l.updated_at
       FROM dashboard.letters l
       WHERE ${whereSql}
       ORDER BY l.sent_at DESC
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

  async findByIdScoped(id: string, scope: RequestScope): Promise<LetterDto | undefined> {
    const params: unknown[] = [id]
    const whereSql = letterScopeClause(scope, params, 'l')
    const { rows } = await this.pool.query<LetterRow>(
      `SELECT l.id, l.type, l.title, l.body, l.sender_id, l.sender_name, l.sender_role,
              l.recipient_id, l.request_id, l.read, l.sent_at, l.attachments,
              l.created_at, l.updated_at
       FROM dashboard.letters l WHERE l.id = $1 AND ${whereSql}`,
      params,
    )
    return rows[0] ? mapRow(rows[0]) : undefined
  }

  async findByIdAndMarkReadScoped(id: string, scope: RequestScope): Promise<LetterDto | undefined> {
    const existing = await this.findByIdScoped(id, scope)
    if (!existing) return undefined
    const params: unknown[] = [id]
    const whereSql = letterScopeClause(scope, params, 'l')
    const { rows } = await this.pool.query<LetterRow>(
      `UPDATE dashboard.letters l SET read = true, updated_at = now()
       WHERE l.id = $1 AND ${whereSql}
       RETURNING l.id, l.type, l.title, l.body, l.sender_id, l.sender_name, l.sender_role,
                 l.recipient_id, l.request_id, l.read, l.sent_at, l.attachments,
                 l.created_at, l.updated_at`,
      params,
    )
    return rows[0] ? mapRow(rows[0]) : undefined
  }

  async deleteScoped(id: string, scope: RequestScope): Promise<boolean> {
    const params: unknown[] = [id]
    const whereSql = letterDeleteScopeClause(scope, params, 'l')
    const result = await this.pool.query(
      `DELETE FROM dashboard.letters l WHERE l.id = $1 AND ${whereSql}`,
      params,
    )
    return (result.rowCount ?? 0) > 0
  }

  /** Owner-scoped detail that also marks the letter read (idempotent). */
  async findByIdAndMarkRead(id: string, ownerId: string): Promise<LetterDto | undefined> {
    const { rows } = await this.pool.query<LetterRow>(
      `UPDATE dashboard.letters SET read = true, updated_at = now()
       WHERE id = $1 AND recipient_id = $2
       RETURNING ${LETTER_COLUMNS}`,
      [id, ownerId],
    )
    const row = rows[0]
    return row ? mapRow(row) : undefined
  }

  async findById(id: string): Promise<LetterDto | undefined> {
    const { rows } = await this.pool.query<LetterRow>(`SELECT ${LETTER_COLUMNS} FROM dashboard.letters WHERE id = $1`, [id])
    return rows[0] ? mapRow(rows[0]) : undefined
  }

  async delete(id: string, ownerId: string, staff = false): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM dashboard.letters WHERE id = $1 AND ($2::boolean OR recipient_id = $3)', [id, staff, ownerId])
    return (result.rowCount ?? 0) > 0
  }
}
