import type { Pool, PoolClient } from 'pg'

export type RequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'

export interface RequestDto {
  id: string
  trackingCode: string
  title: string
  serviceId: string
  serviceKey: string
  serviceName: string
  ownerId: string
  status: RequestStatus
  currentStepIndex: number
  assignedRole: string | null
  currentStep: string | null
  answers: Record<string, unknown>
  submissionDate: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface RequestRow {
  id: string
  tracking_code: string
  title: string
  service_id: string
  service_key: string
  service_name: string
  owner_id: string
  status: RequestStatus
  current_step_index: number
  assigned_role: string | null
  current_step: string | null
  answers: Record<string, unknown>
  submission_date: Date | null
  due_date: Date | null
  created_at: Date
  updated_at: Date
}

export const REQUEST_COLUMNS = `
  id, tracking_code, title, service_id, service_key, service_name, owner_id, status,
  current_step_index, assigned_role, current_step, answers, submission_date, due_date,
  created_at, updated_at
`

export function mapRequestRow(row: RequestRow): RequestDto {
  return {
    id: row.id,
    trackingCode: row.tracking_code,
    title: row.title,
    serviceId: row.service_id,
    serviceKey: row.service_key,
    serviceName: row.service_name,
    ownerId: row.owner_id,
    status: row.status,
    currentStepIndex: row.current_step_index,
    assignedRole: row.assigned_role,
    currentStep: row.current_step,
    answers: row.answers,
    submissionDate: row.submission_date ? row.submission_date.toISOString() : null,
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function trackingCodeForYear(year: number, seq: number): string {
  return `DCH-${year}-${seq}`
}

async function nextTrackingCode(client: PoolClient, year: number): Promise<string> {
  const { rows } = await client.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM requests WHERE tracking_code LIKE $1`,
    [`DCH-${year}-%`],
  )
  const count = rows[0]?.c ?? 0
  return trackingCodeForYear(year, count + 1)
}

export interface CreateRequestInput {
  serviceId: string
  serviceKey: string
  serviceName: string
  title: string
  ownerId: string
  answers: Record<string, unknown>
}

export interface ListRequestOptions {
  ownerId: string
  status?: string
  page: number
  limit: number
}

export interface RequestList {
  items: RequestDto[]
  total: number
  page: number
  totalPages: number
}

export class RequestRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateRequestInput): Promise<RequestDto> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const year = new Date().getFullYear()
      const trackingCode = await nextTrackingCode(client, year)
      const { rows } = await client.query<RequestRow>(
        `INSERT INTO requests (tracking_code, title, service_id, service_key, service_name, owner_id, answers)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${REQUEST_COLUMNS}`,
        [trackingCode, input.title, input.serviceId, input.serviceKey, input.serviceName, input.ownerId, JSON.stringify(input.answers)],
      )
      await client.query('COMMIT')
      const created = rows[0]
      if (!created) throw new Error('INSERT requests returned no row')
      return mapRequestRow(created)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async list(options: ListRequestOptions): Promise<RequestList> {
    const where: string[] = ['owner_id = $1']
    const params: unknown[] = [options.ownerId]

    if (options.status) {
      params.push(options.status)
      where.push(`status = $${params.length}`)
    }

    const whereSql = where.join(' AND ')

    const { rows: countRows } = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM requests WHERE ${whereSql}`,
      params,
    )
    const total = Number(countRows[0]?.total ?? 0)

    const offset = (options.page - 1) * options.limit
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS} FROM requests
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, options.limit, offset],
    )

    return {
      items: rows.map(mapRequestRow),
      total,
      page: options.page,
      totalPages: Math.max(1, Math.ceil(total / options.limit)),
    }
  }

  async findById(id: string, ownerId: string): Promise<RequestDto | undefined> {
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS} FROM requests WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    )
    return rows[0] ? mapRequestRow(rows[0]) : undefined
  }

  /** Draft → in_review, stamping submissionDate + the first workflow step. */
  async submit(
    id: string,
    ownerId: string,
    step?: { assignedRole: string; currentStep: string },
  ): Promise<RequestDto | 'not_found' | 'already_submitted'> {
    const existing = await this.findById(id, ownerId)
    if (!existing) return 'not_found'
    if (existing.status !== 'draft') return 'already_submitted'

    const { rows } = await this.pool.query<RequestRow>(
      `UPDATE requests
       SET status = 'in_review', submission_date = now(), updated_at = now(),
           assigned_role = $3, current_step = $4
       WHERE id = $1 AND owner_id = $2
       RETURNING ${REQUEST_COLUMNS}`,
      [id, ownerId, step?.assignedRole ?? null, step?.currentStep ?? null],
    )
    const updated = rows[0]
    if (!updated) throw new Error('UPDATE requests returned no row')
    return mapRequestRow(updated)
  }
}
