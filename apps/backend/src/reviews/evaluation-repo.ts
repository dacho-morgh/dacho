import type { Pool, PoolClient } from 'pg'

import { syncRoundCompletion } from './round-completion.js'

export interface EvaluationDto {
  id: string
  requestId: string
  userId: string
  role: 'reviewer' | 'employer-reviewer'
  variant: 'ordinary' | 'employer'
  state: 'draft' | 'final'
  revision: number
  scores: Record<string, unknown>
  scoreA: number
  scoreB: number
  scoreC: number
  weightedHundredths: number
  answers: Record<string, unknown>
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
}

export interface SaveEvaluationInput {
  requestId: string
  userId: string
  role: 'reviewer' | 'employer-reviewer'
  variant: 'ordinary' | 'employer'
  revision: number
  scores: Record<string, unknown>
  scoreA: number
  scoreB: number
  scoreC: number
  weightedHundredths: number
  answers: Record<string, unknown>
}

export type EvaluationSaveResult =
  | { ok: true; evaluation: EvaluationDto }
  | { ok: false; reason: 'locked' | 'stale' | 'forbidden' }

export interface EvaluationStore {
  findByRequestAndUser(requestId: string, userId: string, revision?: number): Promise<EvaluationDto | null>
  saveDraft(input: SaveEvaluationInput): Promise<EvaluationSaveResult>
  finalize(input: SaveEvaluationInput): Promise<EvaluationSaveResult>
  countFinalized(requestId: string, revision?: number): Promise<number>
  listForRequest(requestId: string, revision?: number): Promise<EvaluationDto[]>
}

interface EvaluationRow {
  id: string
  request_id: string
  user_id: string
  role: 'reviewer' | 'employer-reviewer'
  variant: 'ordinary' | 'employer'
  state: 'draft' | 'final'
  revision: number
  scores: Record<string, unknown>
  score_a: number
  score_b: number
  score_c: number
  weighted_hundredths: number
  answers: Record<string, unknown>
  created_at: Date
  updated_at: Date
  finalized_at: Date | null
}

const EVALUATION_COLUMNS = `
  id, request_id, user_id, role, variant, state, revision,
  scores, score_a, score_b, score_c, weighted_hundredths, answers,
  created_at, updated_at, finalized_at
`

function mapRow(row: EvaluationRow): EvaluationDto {
  return {
    id: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    role: row.role,
    variant: row.variant,
    state: row.state,
    revision: row.revision,
    scores: row.scores,
    scoreA: row.score_a,
    scoreB: row.score_b,
    scoreC: row.score_c,
    weightedHundredths: row.weighted_hundredths,
    answers: row.answers,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    finalizedAt: row.finalized_at ? row.finalized_at.toISOString() : null,
  }
}

export class PostgresEvaluationRepository implements EvaluationStore {
  constructor(private readonly pool: Pool) {}

  private async writeGuard(client: PoolClient, input: SaveEvaluationInput): Promise<'stale' | 'forbidden' | undefined> {
    // Share locks allow independent reviewers while preventing a revision change
    // or assignment revocation from committing between authorization and this write.
    const request = await client.query<{ revision: number; status: string; review_stage: string | null }>(
      'SELECT revision, status, review_stage FROM dashboard.requests WHERE id = $1 FOR SHARE',
      [input.requestId],
    )
    if (request.rows[0]?.revision !== input.revision || request.rows[0]?.status !== 'in_review') return 'stale'
    // Review is over once the chief advanced the case, even for a hand-made grant.
    if (request.rows[0]?.review_stage === 'advanced') return 'stale'
    const assignment = await client.query<{ round_revision: number | null }>(
      `SELECT rr.request_revision AS round_revision
       FROM dashboard.case_assignments a
       LEFT JOIN dashboard.review_rounds rr ON rr.id = a.round_id
       WHERE a.request_id = $1 AND a.user_id = $2 AND a.role = $3 AND a.active
       FOR SHARE OF a`,
      [input.requestId, input.userId, input.role],
    )
    const held = assignment.rows[0]
    if (!held) return 'forbidden'
    // A slot of an earlier round must not write into a revision it does not review.
    if (held.round_revision !== null && held.round_revision !== input.revision) return 'stale'
  }

  async findByRequestAndUser(requestId: string, userId: string, revision?: number): Promise<EvaluationDto | null> {
    const params: unknown[] = [requestId, userId]
    let sql = `SELECT ${EVALUATION_COLUMNS} FROM dashboard.evaluations WHERE request_id = $1 AND user_id = $2`
    if (typeof revision === 'number') {
      sql += ' AND revision = $3'
      params.push(revision)
    } else {
      sql += ' ORDER BY revision DESC LIMIT 1'
    }
    const { rows } = await this.pool.query<EvaluationRow>(sql, params)
    const row = rows[0]
    return row ? mapRow(row) : null
  }

  async saveDraft(input: SaveEvaluationInput): Promise<EvaluationSaveResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const denied = await this.writeGuard(client, input)
      if (denied) {
        await client.query('ROLLBACK')
        return { ok: false, reason: denied }
      }
      const { rows: existingRows } = await client.query<{ state: string }>(
        `SELECT state FROM dashboard.evaluations
         WHERE request_id = $1 AND user_id = $2 AND revision = $3
         FOR UPDATE`,
        [input.requestId, input.userId, input.revision],
      )
      if (existingRows[0]?.state === 'final') {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'locked' }
      }

      const { rows } = await client.query<EvaluationRow>(
        `INSERT INTO dashboard.evaluations (
           request_id, user_id, role, variant, state, revision,
           scores, score_a, score_b, score_c, weighted_hundredths, answers,
           updated_at
         ) VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (request_id, user_id, revision) DO UPDATE SET
           role = EXCLUDED.role,
           variant = EXCLUDED.variant,
           scores = EXCLUDED.scores,
           score_a = EXCLUDED.score_a,
           score_b = EXCLUDED.score_b,
           score_c = EXCLUDED.score_c,
           weighted_hundredths = EXCLUDED.weighted_hundredths,
           answers = EXCLUDED.answers,
           updated_at = now()
         WHERE dashboard.evaluations.state <> 'final'
         RETURNING ${EVALUATION_COLUMNS}`,
        [
          input.requestId, input.userId, input.role, input.variant, input.revision,
          input.scores, input.scoreA, input.scoreB, input.scoreC, input.weightedHundredths, input.answers,
        ],
      )
      await client.query('COMMIT')
      const row = rows[0]
      if (!row) return { ok: false, reason: 'locked' }
      return { ok: true, evaluation: mapRow(row) }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async finalize(input: SaveEvaluationInput): Promise<EvaluationSaveResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const denied = await this.writeGuard(client, input)
      if (denied) {
        await client.query('ROLLBACK')
        return { ok: false, reason: denied }
      }
      const { rows: existingRows } = await client.query<{ state: string }>(
        `SELECT state FROM dashboard.evaluations
         WHERE request_id = $1 AND user_id = $2 AND revision = $3
         FOR UPDATE`,
        [input.requestId, input.userId, input.revision],
      )
      if (existingRows[0]?.state === 'final') {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'locked' }
      }

      const { rows } = await client.query<EvaluationRow>(
        `INSERT INTO dashboard.evaluations (
           request_id, user_id, role, variant, state, revision,
           scores, score_a, score_b, score_c, weighted_hundredths, answers,
           finalized_at, updated_at
         ) VALUES ($1, $2, $3, $4, 'final', $5, $6, $7, $8, $9, $10, $11, now(), now())
         ON CONFLICT (request_id, user_id, revision) DO UPDATE SET
           role = EXCLUDED.role,
           variant = EXCLUDED.variant,
           scores = EXCLUDED.scores,
           score_a = EXCLUDED.score_a,
           score_b = EXCLUDED.score_b,
           score_c = EXCLUDED.score_c,
           weighted_hundredths = EXCLUDED.weighted_hundredths,
           answers = EXCLUDED.answers,
           state = 'final',
           finalized_at = now(),
           updated_at = now()
         WHERE dashboard.evaluations.state <> 'final'
         RETURNING ${EVALUATION_COLUMNS}`,
        [
          input.requestId, input.userId, input.role, input.variant, input.revision,
          input.scores, input.scoreA, input.scoreB, input.scoreC, input.weightedHundredths, input.answers,
        ],
      )
      const row = rows[0]
      if (!row) {
        await client.query('ROLLBACK')
        return { ok: false, reason: 'locked' }
      }
      await syncRoundCompletion(client, { requestId: input.requestId, revision: input.revision, actorId: input.userId })
      await client.query('COMMIT')
      return { ok: true, evaluation: mapRow(row) }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  async countFinalized(requestId: string, revision?: number): Promise<number> {
    const params: unknown[] = [requestId]
    let sql = `SELECT count(*)::integer AS count FROM dashboard.evaluations WHERE request_id = $1 AND state = 'final'`
    if (typeof revision === 'number') {
      sql += ' AND revision = $2'
      params.push(revision)
    }
    const { rows } = await this.pool.query<{ count: number }>(sql, params)
    return Number(rows[0]?.count ?? 0)
  }

  async listForRequest(requestId: string, revision?: number): Promise<EvaluationDto[]> {
    const params: unknown[] = [requestId]
    let sql = `SELECT ${EVALUATION_COLUMNS} FROM dashboard.evaluations WHERE request_id = $1`
    if (typeof revision === 'number') {
      sql += ' AND revision = $2'
      params.push(revision)
    }
    sql += ' ORDER BY finalized_at ASC NULLS LAST, created_at ASC'
    const { rows } = await this.pool.query<EvaluationRow>(sql, params)
    return rows.map(mapRow)
  }
}

export class InMemoryEvaluationStore implements EvaluationStore {
  private readonly items: EvaluationDto[] = []

  async findByRequestAndUser(requestId: string, userId: string, revision?: number): Promise<EvaluationDto | null> {
    const filtered = this.items.filter((item) => {
      if (item.requestId !== requestId || item.userId !== userId) return false
      if (typeof revision === 'number') return item.revision === revision
      return true
    })
    return filtered.at(-1) ?? null
  }

  async saveDraft(input: SaveEvaluationInput): Promise<EvaluationSaveResult> {
    const existing = this.items.find((item) => item.requestId === input.requestId && item.userId === input.userId && item.revision === input.revision)
    if (existing?.state === 'final') {
      return { ok: false, reason: 'locked' }
    }
    const now = new Date().toISOString()
    if (existing) {
      existing.role = input.role
      existing.variant = input.variant
      existing.scores = input.scores
      existing.scoreA = input.scoreA
      existing.scoreB = input.scoreB
      existing.scoreC = input.scoreC
      existing.weightedHundredths = input.weightedHundredths
      existing.answers = input.answers
      existing.updatedAt = now
      return { ok: true, evaluation: { ...existing } }
    }
    const created: EvaluationDto = {
      id: `eval-${this.items.length + 1}`,
      requestId: input.requestId,
      userId: input.userId,
      role: input.role,
      variant: input.variant,
      state: 'draft',
      revision: input.revision,
      scores: input.scores,
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      scoreC: input.scoreC,
      weightedHundredths: input.weightedHundredths,
      answers: input.answers,
      createdAt: now,
      updatedAt: now,
      finalizedAt: null,
    }
    this.items.push(created)
    return { ok: true, evaluation: { ...created } }
  }

  async finalize(input: SaveEvaluationInput): Promise<EvaluationSaveResult> {
    const existing = this.items.find((item) => item.requestId === input.requestId && item.userId === input.userId && item.revision === input.revision)
    if (existing?.state === 'final') {
      return { ok: false, reason: 'locked' }
    }
    const now = new Date().toISOString()
    if (existing) {
      existing.role = input.role
      existing.variant = input.variant
      existing.scores = input.scores
      existing.scoreA = input.scoreA
      existing.scoreB = input.scoreB
      existing.scoreC = input.scoreC
      existing.weightedHundredths = input.weightedHundredths
      existing.answers = input.answers
      existing.state = 'final'
      existing.finalizedAt = now
      existing.updatedAt = now
      return { ok: true, evaluation: { ...existing } }
    }
    const created: EvaluationDto = {
      id: `eval-${this.items.length + 1}`,
      requestId: input.requestId,
      userId: input.userId,
      role: input.role,
      variant: input.variant,
      state: 'final',
      revision: input.revision,
      scores: input.scores,
      scoreA: input.scoreA,
      scoreB: input.scoreB,
      scoreC: input.scoreC,
      weightedHundredths: input.weightedHundredths,
      answers: input.answers,
      createdAt: now,
      updatedAt: now,
      finalizedAt: now,
    }
    this.items.push(created)
    return { ok: true, evaluation: { ...created } }
  }

  async countFinalized(requestId: string, revision?: number): Promise<number> {
    return this.items.filter((item) => {
      if (item.requestId !== requestId || item.state !== 'final') return false
      if (typeof revision === 'number') return item.revision === revision
      return true
    }).length
  }

  async listForRequest(requestId: string, revision?: number): Promise<EvaluationDto[]> {
    return this.items
      .filter((item) => {
        if (item.requestId !== requestId) return false
        if (typeof revision === 'number') return item.revision === revision
        return true
      })
      .map((item) => ({ ...item }))
  }
}
