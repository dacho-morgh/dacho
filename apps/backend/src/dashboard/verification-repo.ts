import type { Pool } from 'pg'
import { isUuid } from '../db/uuid.js'

export type VerificationStatus = 'unsubmitted' | 'pending' | 'approved' | 'returned' | 'rejected'

export interface CompanyVerificationDto {
  id: string
  companyId: string
  representativeId: string
  status: VerificationStatus
  revision: number
  snapshot: Record<string, unknown>
  submittedAt: string
  decidedAt: string | null
  reviewerId: string | null
  reason: string | null
  createdAt: string
  updatedAt: string
}

export interface SubmitVerificationInput {
  companyId: string
  representativeId: string
  snapshot: Record<string, unknown>
}

export type VerificationSubmitResult =
  | { ok: true; verification: CompanyVerificationDto }
  | { ok: false; reason: 'already_submitted' | 'already_approved' }

export interface VerificationDecisionInput {
  id?: string
  companyId?: string
  action: 'approve' | 'return' | 'reject'
  reviewerId: string
  reason?: string | null
  expectedRevision?: number
}

export type VerificationDecisionResult =
  | { ok: true; verification: CompanyVerificationDto }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'stale_revision' }

export interface VerificationQueueFilter {
  status?: string
  search?: string
}

export interface VerificationQueueItem {
  id: string
  companyId: string
  companyName: string
  nationalId: string
  companyType: string
  province: string
  city: string
  representativeId: string
  representativeName: string | null
  representativePhone: string | null
  status: VerificationStatus
  revision: number
  submittedAt: string
  decidedAt: string | null
  reviewerId: string | null
  reason: string | null
}

export interface VerificationStore {
  findCurrentByCompanyId(companyId: string): Promise<CompanyVerificationDto | null>
  findById(id: string): Promise<CompanyVerificationDto | null>
  listHistory(companyId: string): Promise<CompanyVerificationDto[]>
  submit(input: SubmitVerificationInput): Promise<VerificationSubmitResult>
  decide(input: VerificationDecisionInput): Promise<VerificationDecisionResult>
  listQueue(filter?: VerificationQueueFilter): Promise<VerificationQueueItem[]>
  isVerified(companyId: string): Promise<boolean>
  invalidateApproval(companyId: string, reason: string): Promise<boolean>
}

interface VerificationRow {
  id: string
  company_id: string
  representative_id: string
  status: VerificationStatus
  revision: number
  snapshot: Record<string, unknown>
  submitted_at: Date
  decided_at: Date | null
  reviewer_id: string | null
  reason: string | null
  created_at: Date
  updated_at: Date
}

const VERIFICATION_COLUMNS = `
  id, company_id, representative_id, status, revision, snapshot,
  submitted_at, decided_at, reviewer_id, reason, created_at, updated_at
`

function mapRow(row: VerificationRow): CompanyVerificationDto {
  return {
    id: row.id,
    companyId: row.company_id,
    representativeId: row.representative_id,
    status: row.status,
    revision: row.revision,
    snapshot: row.snapshot,
    submittedAt: row.submitted_at.toISOString(),
    decidedAt: row.decided_at ? row.decided_at.toISOString() : null,
    reviewerId: row.reviewer_id,
    reason: row.reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresVerificationStore implements VerificationStore {
  constructor(private readonly pool: Pool) {}

  async findCurrentByCompanyId(companyId: string): Promise<CompanyVerificationDto | null> {
    const { rows } = await this.pool.query<VerificationRow>(
      `SELECT ${VERIFICATION_COLUMNS} FROM dashboard.company_verifications
       WHERE company_id = $1 ORDER BY revision DESC LIMIT 1`,
      [companyId],
    )
    return rows[0] ? mapRow(rows[0]) : null
  }

  async findById(id: string): Promise<CompanyVerificationDto | null> {
    if (!isUuid(id)) return null
    const { rows } = await this.pool.query<VerificationRow>(
      `SELECT ${VERIFICATION_COLUMNS} FROM dashboard.company_verifications WHERE id = $1`,
      [id],
    )
    return rows[0] ? mapRow(rows[0]) : null
  }

  async listHistory(companyId: string): Promise<CompanyVerificationDto[]> {
    const { rows } = await this.pool.query<VerificationRow>(
      `SELECT ${VERIFICATION_COLUMNS} FROM dashboard.company_verifications
       WHERE company_id = $1 ORDER BY revision DESC`,
      [companyId],
    )
    return rows.map(mapRow)
  }

  async isVerified(companyId: string): Promise<boolean> {
    const current = await this.findCurrentByCompanyId(companyId)
    return current?.status === 'approved'
  }

  async invalidateApproval(companyId: string, reason: string): Promise<boolean> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<VerificationRow>(
        `SELECT ${VERIFICATION_COLUMNS} FROM dashboard.company_verifications
         WHERE company_id = $1 ORDER BY revision DESC LIMIT 1 FOR UPDATE`,
        [companyId],
      )
      const current = rows[0]
      if (!current || current.status !== 'approved') {
        await client.query('ROLLBACK')
        return false
      }
      await client.query(
        `UPDATE dashboard.company_verifications
         SET status = 'returned', reason = $1, updated_at = now()
         WHERE id = $2`,
        [reason, current.id],
      )
      await client.query(
        `INSERT INTO dashboard.activities
           (owner_id, request_id, letter_id, type, title, description,
            actor_id, action, reason, from_state, to_state, revision)
         VALUES ($1, NULL, NULL, 'transition', 'ابطال تأیید احراز جهت احراز مجدد', NULL, $2, 'verification_return', $3, 'approved', 'returned', $4)`,
        [current.representative_id, current.representative_id, reason, current.revision],
      )
      await client.query('COMMIT')
      return true
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }

  async submit(input: SubmitVerificationInput): Promise<VerificationSubmitResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      // A row lock cannot serialize the first submission: there is no row yet.
      // Serialize submissions for a company across connections and API instances.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `company-verification:${input.companyId}`,
      ])
      const existingRes = await client.query<VerificationRow>(
        `SELECT ${VERIFICATION_COLUMNS} FROM dashboard.company_verifications
         WHERE company_id = $1 ORDER BY revision DESC LIMIT 1 FOR UPDATE`,
        [input.companyId],
      )
      const existing = existingRes.rows[0]
      if (existing?.status === 'pending') {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'already_submitted' }
      }
      if (existing?.status === 'approved') {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'already_approved' }
      }

      const nextRevision = (existing?.revision ?? 0) + 1
      const insertRes = await client.query<VerificationRow>(
        `INSERT INTO dashboard.company_verifications
           (company_id, representative_id, status, revision, snapshot, submitted_at, created_at, updated_at)
         VALUES ($1, $2, 'pending', $3, $4, now(), now(), now())
         RETURNING ${VERIFICATION_COLUMNS}`,
        [input.companyId, input.representativeId, nextRevision, JSON.stringify(input.snapshot)],
      )
      const created = insertRes.rows[0]
      if (!created) throw new Error('Failed to create verification record')

      // Record activity in dashboard.activities
      await client.query(
        `INSERT INTO dashboard.activities
           (owner_id, request_id, letter_id, type, title, description,
            actor_id, action, reason, from_state, to_state, revision)
         VALUES ($1, NULL, NULL, 'transition', 'ارسال مدارک برای احراز', NULL, $2, 'verification_submit', NULL, $3, 'pending', $4)`,
        [input.representativeId, input.representativeId, existing?.status ?? 'unsubmitted', nextRevision],
      )

      await client.query('COMMIT')
      return { ok: true, verification: mapRow(created) }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }

  async decide(input: VerificationDecisionInput): Promise<VerificationDecisionResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const querySql = input.id && isUuid(input.id)
        ? `SELECT ${VERIFICATION_COLUMNS} FROM dashboard.company_verifications WHERE id = $1 FOR UPDATE`
        : `SELECT ${VERIFICATION_COLUMNS} FROM dashboard.company_verifications WHERE company_id = $1 ORDER BY revision DESC LIMIT 1 FOR UPDATE`
      const queryParam = input.id && isUuid(input.id) ? input.id : input.companyId

      if (!queryParam) {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'not_found' }
      }

      const res = await client.query<VerificationRow>(querySql, [queryParam])
      const row = res.rows[0]
      if (!row) {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'not_found' }
      }
      if (row.status !== 'pending') {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'not_pending' }
      }
      if (typeof input.expectedRevision === 'number' && row.revision !== input.expectedRevision) {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'stale_revision' }
      }

      const targetStatus: VerificationStatus =
        input.action === 'approve'
          ? 'approved'
          : input.action === 'return'
            ? 'returned'
            : 'rejected'

      const updateRes = await client.query<VerificationRow>(
        `UPDATE dashboard.company_verifications
         SET status = $1, decided_at = now(), reviewer_id = $2, reason = $3, updated_at = now()
         WHERE id = $4
         RETURNING ${VERIFICATION_COLUMNS}`,
        [targetStatus, input.reviewerId, input.reason ?? null, row.id],
      )
      const updated = updateRes.rows[0]
      if (!updated) throw new Error('Failed to update verification record')

      const title =
        input.action === 'approve'
          ? 'تأیید مدارک احراز'
          : input.action === 'return'
            ? 'برگشت مدارک احراز جهت اصلاح'
            : 'رد مدارک احراز'

      await client.query(
        `INSERT INTO dashboard.activities
           (owner_id, request_id, letter_id, type, title, description,
            actor_id, action, reason, from_state, to_state, revision)
         VALUES ($1, NULL, NULL, 'transition', $2, $3, $4, $5, $6, 'pending', $7, $8)`,
        [
          row.representative_id,
          title,
          input.reason ?? null,
          input.reviewerId,
          `verification_${input.action}`,
          input.reason ?? null,
          targetStatus,
          row.revision,
        ],
      )

      const letterType =
        input.action === 'approve'
          ? 'approved'
          : input.action === 'return'
            ? 'needs_fix'
            : 'rejected'
      const letterTitle =
        input.action === 'approve'
          ? 'تأیید مدارک احراز هویت شرکت'
          : input.action === 'return'
            ? 'برگشت مدارک احراز هویت شرکت جهت اصلاح'
            : 'رد مدارک احراز هویت شرکت'
      const letterBody = input.reason?.trim()
        ? input.reason.trim()
        : (input.action === 'approve' ? 'مدارک احراز هویت شرکت شما توسط دبیرخانه تأیید شد.' : '')

      await client.query(
        `INSERT INTO dashboard.letters
           (type, title, body, sender_id, sender_name, sender_role, recipient_id, read, sent_at)
         VALUES ($1, $2, $3, $4, 'دبیرخانه', 'central-secretariat', $5, false, now())`,
        [letterType, letterTitle, letterBody, input.reviewerId, row.representative_id],
      )

      await client.query('COMMIT')
      return { ok: true, verification: mapRow(updated) }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }

  async listQueue(filter?: VerificationQueueFilter): Promise<VerificationQueueItem[]> {
    const { rows } = await this.pool.query<VerificationRow>(
      `SELECT DISTINCT ON (company_id) ${VERIFICATION_COLUMNS}
       FROM dashboard.company_verifications
       ORDER BY company_id, revision DESC`,
    )
    return rows
      .map(mapRow)
      .map(toQueueItem)
      .filter((item) => {
        if (filter?.status && filter.status !== 'all' && item.status !== filter.status) {
          return false
        }
        if (filter?.search) {
          const needle = filter.search.toLowerCase()
          const matched =
            item.companyName.toLowerCase().includes(needle) ||
            item.nationalId.toLowerCase().includes(needle)
          if (!matched) return false
        }
        return true
      })
  }
}

function toQueueItem(v: CompanyVerificationDto): VerificationQueueItem {
  const comp = (v.snapshot.company ?? {}) as Record<string, unknown>
  const rep = (v.snapshot.representative ?? {}) as Record<string, unknown>
  return {
    id: v.id,
    companyId: v.companyId,
    companyName: String(comp.name ?? ''),
    nationalId: String(comp.nationalId ?? ''),
    companyType: String(comp.type ?? ''),
    province: String(comp.province ?? ''),
    city: String(comp.city ?? ''),
    representativeId: v.representativeId,
    representativeName: rep.name ? String(rep.name) : null,
    representativePhone: rep.phone ? String(rep.phone) : null,
    status: v.status,
    revision: v.revision,
    submittedAt: v.submittedAt,
    decidedAt: v.decidedAt,
    reviewerId: v.reviewerId,
    reason: v.reason,
  }
}

export class InMemoryVerificationStore implements VerificationStore {
  private items: CompanyVerificationDto[] = []
  private nextId = 1

  async findCurrentByCompanyId(companyId: string): Promise<CompanyVerificationDto | null> {
    const matching = this.items
      .filter((item) => item.companyId === companyId)
      .sort((a, b) => b.revision - a.revision)
    return matching[0] ? structuredClone(matching[0]) : null
  }

  async findById(id: string): Promise<CompanyVerificationDto | null> {
    const found = this.items.find((item) => item.id === id)
    return found ? structuredClone(found) : null
  }

  async listHistory(companyId: string): Promise<CompanyVerificationDto[]> {
    return this.items
      .filter((item) => item.companyId === companyId)
      .sort((a, b) => b.revision - a.revision)
      .map((item) => structuredClone(item))
  }

  async isVerified(companyId: string): Promise<boolean> {
    const current = await this.findCurrentByCompanyId(companyId)
    return current?.status === 'approved'
  }

  async invalidateApproval(companyId: string, reason: string): Promise<boolean> {
    const target = this.items
      .filter((item) => item.companyId === companyId)
      .sort((a, b) => b.revision - a.revision)[0]
    if (!target || target.status !== 'approved') return false
    target.status = 'returned'
    target.reason = reason
    target.updatedAt = new Date().toISOString()
    return true
  }

  async submit(input: SubmitVerificationInput): Promise<VerificationSubmitResult> {
    const existing = this.items
      .filter((item) => item.companyId === input.companyId)
      .sort((a, b) => b.revision - a.revision)[0]
    if (existing?.status === 'pending') {
      return { ok: false, reason: 'already_submitted' }
    }
    if (existing?.status === 'approved') {
      return { ok: false, reason: 'already_approved' }
    }

    const nextRevision = (existing?.revision ?? 0) + 1
    const now = new Date().toISOString()
    const created: CompanyVerificationDto = {
      id: `verif-${this.nextId++}`,
      companyId: input.companyId,
      representativeId: input.representativeId,
      status: 'pending',
      revision: nextRevision,
      snapshot: structuredClone(input.snapshot),
      submittedAt: now,
      decidedAt: null,
      reviewerId: null,
      reason: null,
      createdAt: now,
      updatedAt: now,
    }
    this.items.push(created)
    return { ok: true, verification: structuredClone(created) }
  }

  async decide(input: VerificationDecisionInput): Promise<VerificationDecisionResult> {
    let target: CompanyVerificationDto | undefined
    if (input.id) {
      target = this.items.find((item) => item.id === input.id)
    }
    if (!target && input.companyId) {
      target = this.items
        .filter((item) => item.companyId === input.companyId)
        .sort((a, b) => b.revision - a.revision)[0]
    }
    if (!target) return { ok: false, reason: 'not_found' }
    if (target.status !== 'pending') return { ok: false, reason: 'not_pending' }
    if (typeof input.expectedRevision === 'number' && target.revision !== input.expectedRevision) {
      return { ok: false, reason: 'stale_revision' }
    }

    const targetStatus: VerificationStatus =
      input.action === 'approve'
        ? 'approved'
        : input.action === 'return'
          ? 'returned'
          : 'rejected'

    const now = new Date().toISOString()
    target.status = targetStatus
    target.decidedAt = now
    target.reviewerId = input.reviewerId
    target.reason = input.reason ?? null
    target.updatedAt = now

    return { ok: true, verification: structuredClone(target) }
  }

  async listQueue(filter?: VerificationQueueFilter): Promise<VerificationQueueItem[]> {
    const byCompany = new Map<string, CompanyVerificationDto>()
    const sorted = [...this.items].sort((a, b) => b.revision - a.revision)
    for (const item of sorted) {
      if (!byCompany.has(item.companyId)) {
        byCompany.set(item.companyId, item)
      }
    }

    return Array.from(byCompany.values())
      .map(toQueueItem)
      .filter((item) => {
        if (filter?.status && filter.status !== 'all' && item.status !== filter.status) {
          return false
        }
        if (filter?.search) {
          const needle = filter.search.toLowerCase()
          const matched =
            item.companyName.toLowerCase().includes(needle) ||
            item.nationalId.toLowerCase().includes(needle)
          if (!matched) return false
        }
        return true
      })
  }
}
