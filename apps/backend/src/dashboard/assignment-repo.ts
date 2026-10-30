import type { Pool } from 'pg'

import type { CaseAssignmentRole } from '../access/roles.js'

export interface CaseAssignmentDto {
  id: string
  requestId: string
  userId: string
  role: CaseAssignmentRole
  active: boolean
  assignedBy: string
  assignedAt: string
  revokedBy: string | null
  revokedAt: string | null
  revokeReason: string | null
  /** Set when a review round created the assignment (T22); null for manual grants. */
  roundId: string | null
  slot: 'employer' | 'ordinary' | null
}

interface AssignmentRow {
  id: string
  request_id: string
  user_id: string
  role: CaseAssignmentRole
  active: boolean
  assigned_by: string
  assigned_at: Date
  revoked_by: string | null
  revoked_at: Date | null
  revoke_reason: string | null
  round_id: string | null
  slot: 'employer' | 'ordinary' | null
}

const ASSIGNMENT_COLUMNS = `
  id, request_id, user_id, role, active, assigned_by, assigned_at,
  revoked_by, revoked_at, revoke_reason, round_id, slot
`

function mapRow(row: AssignmentRow): CaseAssignmentDto {
  return {
    id: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    role: row.role,
    active: row.active,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at.toISOString(),
    revokedBy: row.revoked_by,
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    revokeReason: row.revoke_reason,
    roundId: row.round_id,
    slot: row.slot,
  }
}

export type CreateAssignmentResult =
  | { ok: true; assignment: CaseAssignmentDto }
  | { ok: false; reason: 'already_assigned' }

export class AssignmentRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    requestId: string
    userId: string
    role: CaseAssignmentRole
    assignedBy: string
  }): Promise<CreateAssignmentResult> {
    try {
      const { rows } = await this.pool.query<AssignmentRow>(
        `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by)
         VALUES ($1, $2, $3, $4)
         RETURNING ${ASSIGNMENT_COLUMNS}`,
        [input.requestId, input.userId, input.role, input.assignedBy],
      )
      const row = rows[0]
      if (!row) throw new Error('INSERT case_assignments returned no row')
      return { ok: true, assignment: mapRow(row) }
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return { ok: false, reason: 'already_assigned' }
      }
      throw error
    }
  }

  async listForRequest(requestId: string): Promise<CaseAssignmentDto[]> {
    const { rows } = await this.pool.query<AssignmentRow>(
      `SELECT ${ASSIGNMENT_COLUMNS} FROM dashboard.case_assignments
       WHERE request_id = $1 ORDER BY assigned_at ASC`,
      [requestId],
    )
    return rows.map(mapRow)
  }

  async revoke(input: {
    requestId: string
    userId: string
    revokedBy: string
    reason: string | null
  }): Promise<CaseAssignmentDto | undefined> {
    const { rows } = await this.pool.query<AssignmentRow>(
      `UPDATE dashboard.case_assignments
       SET active = false, revoked_by = $3, revoked_at = now(), revoke_reason = $4
       WHERE request_id = $1 AND user_id = $2 AND active
       RETURNING ${ASSIGNMENT_COLUMNS}`,
      [input.requestId, input.userId, input.revokedBy, input.reason],
    )
    const row = rows[0]
    return row ? mapRow(row) : undefined
  }

  async activeFor(requestId: string, userId: string, role: CaseAssignmentRole): Promise<boolean> {
    const { rows } = await this.pool.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM dashboard.case_assignments
         WHERE request_id = $1 AND user_id = $2 AND role = $3 AND active
       ) AS present`,
      [requestId, userId, role],
    )
    return rows[0]?.present === true
  }

  async listForUser(userId: string): Promise<CaseAssignmentDto[]> {
    const { rows } = await this.pool.query<AssignmentRow>(
      `SELECT ${ASSIGNMENT_COLUMNS} FROM dashboard.case_assignments
       WHERE user_id = $1 AND active ORDER BY assigned_at ASC`,
      [userId],
    )
    return rows.map(mapRow)
  }
}
