import type { Pool } from 'pg'

export interface ActivityDto {
  id: string
  ownerId: string
  requestId: string | null
  letterId: string | null
  type: string
  title: string
  description: string | null
  at: string
}

interface ActivityRow {
  id: string
  owner_id: string
  request_id: string | null
  letter_id: string | null
  type: string
  title: string
  description: string | null
  at: Date
}

const ACTIVITY_COLUMNS = 'id, owner_id, request_id, letter_id, type, title, description, at'

function mapActivity(row: ActivityRow): ActivityDto {
  return {
    id: row.id,
    ownerId: row.owner_id,
    requestId: row.request_id,
    letterId: row.letter_id,
    type: row.type,
    title: row.title,
    description: row.description,
    at: row.at.toISOString(),
  }
}

export interface ActivityList {
  items: ActivityDto[]
  total: number
  page: number
  totalPages: number
}

export class ActivityRepository {
  constructor(private readonly pool: Pool) {}

  async list(ownerId: string, page: number, limit: number): Promise<ActivityList> {
    const { rows: countRows } = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM activities WHERE owner_id = $1',
      [ownerId],
    )
    const total = Number(countRows[0]?.total ?? 0)

    const offset = (page - 1) * limit
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${ACTIVITY_COLUMNS} FROM activities
       WHERE owner_id = $1
       ORDER BY at DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset],
    )

    return {
      items: rows.map(mapActivity),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  /** Chronological event log for a single request (the detail timeline). */
  async listForRequest(requestId: string): Promise<ActivityDto[]> {
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE request_id = $1 ORDER BY at ASC`,
      [requestId],
    )
    return rows.map(mapActivity)
  }
}