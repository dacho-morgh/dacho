import type { Pool } from 'pg'

import type { RequestScope } from '../access/policy.js'

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

  async listScoped(scope: RequestScope, page: number, limit: number): Promise<ActivityList> {
    const params: unknown[] = []
    let whereSql: string
    switch (scope.kind) {
      case 'all':
        whereSql = 'TRUE'
        break
      case 'none':
        whereSql = 'FALSE'
        break
      case 'owner':
        params.push(scope.userId)
        whereSql = `a.owner_id = $${params.length}`
        break
      case 'company': {
        params.push(scope.companyId)
        const compParam = params.length
        if (scope.userId) {
          params.push(scope.userId)
          whereSql = `a.request_id IN (
            SELECT r.id FROM dashboard.requests r
            WHERE r.company_id = $${compParam} OR (r.company_id IS NULL AND r.owner_id = $${params.length})
          )`
        } else {
          whereSql = `a.request_id IN (
            SELECT r.id FROM dashboard.requests r
            WHERE r.company_id = $${compParam}
          )`
        }
        break
      }
      case 'assigned':
        params.push(scope.userId)
        const userParam = params.length
        params.push(scope.role)
        whereSql = `a.request_id IN (
          SELECT ca.request_id FROM dashboard.case_assignments ca
          WHERE ca.user_id = $${userParam} AND ca.role = $${params.length} AND ca.active
        )`
        break
    }

    const { rows: countRows } = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM dashboard.activities a WHERE ${whereSql}`,
      params,
    )
    const total = Number(countRows[0]?.total ?? 0)
    const offset = (page - 1) * limit
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT a.id, a.owner_id, a.request_id, a.letter_id, a.type, a.title, a.description, a.at
       FROM dashboard.activities a
       WHERE ${whereSql}
       ORDER BY a.at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    )
    return {
      items: rows.map(mapActivity),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  async list(ownerId: string, page: number, limit: number): Promise<ActivityList> {
    const { rows: countRows } = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM dashboard.activities WHERE owner_id = $1',
      [ownerId],
    )
    const total = Number(countRows[0]?.total ?? 0)

    const offset = (page - 1) * limit
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${ACTIVITY_COLUMNS} FROM dashboard.activities
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
      `SELECT ${ACTIVITY_COLUMNS} FROM dashboard.activities WHERE request_id = $1 ORDER BY at ASC`,
      [requestId],
    )
    return rows.map(mapActivity)
  }
}