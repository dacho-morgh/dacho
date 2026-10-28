import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { runMigrations } from '../../src/db/migrate.js'
import { AssignmentRepository } from '../../src/dashboard/assignment-repo.js'
import { RequestRepository } from '../../src/dashboard/request-repo.js'
import { PostgresEvaluationRepository, type SaveEvaluationInput } from '../../src/reviews/evaluation-repo.js'

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString, application_name: 'evaluation-integration' })

describe('evaluation persistence and transaction authorization', () => {
  beforeAll(async () => { await runMigrations(connectionString) })
  beforeEach(async () => { await pool.query('DELETE FROM dashboard.requests') })
  afterAll(async () => { await pool.end() })

  async function fixture() {
    const requests = new RequestRepository(pool)
    const draft = await requests.create({
      serviceId: '1', serviceKey: 'financing', serviceName: 'Financing',
      title: 'Evaluation fixture', ownerId: 'representative', answers: {},
    })
    expect(await requests.submit(draft.id, 'representative')).toMatchObject({ revision: 2 })
    await new AssignmentRepository(pool).create({
      requestId: draft.id, userId: 'reviewer', role: 'reviewer', assignedBy: 'owner',
    })
    const input: SaveEvaluationInput = {
      requestId: draft.id, userId: 'reviewer', role: 'reviewer', variant: 'ordinary', revision: 2,
      scores: {}, answers: {}, scoreA: 0, scoreB: 0, scoreC: 0, weightedHundredths: 0,
    }
    return { repo: new PostgresEvaluationRepository(pool), input }
  }

  it('persists drafts, allows exactly one concurrent finalization and keeps finalized data immutable', async () => {
    const { repo, input } = await fixture()
    expect((await repo.saveDraft(input)).ok).toBe(true)
    expect(await repo.countFinalized(input.requestId, 2)).toBe(0)
    const results = await Promise.all([repo.finalize(input), repo.finalize(input)])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: 'locked' }])
    const saved = await repo.findByRequestAndUser(input.requestId, input.userId, 2)
    expect(saved?.state).toBe('final')
    expect(await repo.saveDraft({ ...input, answers: { altered: true } })).toEqual({ ok: false, reason: 'locked' })
    expect(await repo.findByRequestAndUser(input.requestId, input.userId, 2)).toEqual(saved)
  })

  it('rejects old revisions and closed workflow states inside the persistence transaction', async () => {
    const { repo, input } = await fixture()
    await pool.query('UPDATE dashboard.requests SET revision = 3 WHERE id = $1', [input.requestId])
    expect(await repo.saveDraft(input)).toEqual({ ok: false, reason: 'stale' })
    await pool.query("UPDATE dashboard.requests SET status = 'approved' WHERE id = $1", [input.requestId])
    expect(await repo.finalize({ ...input, revision: 3 })).toEqual({ ok: false, reason: 'stale' })
    expect(await repo.listForRequest(input.requestId)).toEqual([])
  })

  it('waits for concurrent assignment revocation and denies the stale evaluator without a write', async () => {
    const { repo, input } = await fixture()
    const blocker = await pool.connect()
    let writing: ReturnType<typeof repo.finalize> | undefined
    try {
      await blocker.query('BEGIN')
      await blocker.query('UPDATE dashboard.case_assignments SET active = false WHERE request_id = $1', [input.requestId])
      writing = repo.finalize(input)
      await blocker.query('COMMIT')
      expect(await writing).toEqual({ ok: false, reason: 'forbidden' })
      expect(await repo.listForRequest(input.requestId)).toEqual([])
    } finally {
      await blocker.query('ROLLBACK')
      blocker.release()
      await writing
    }
  })
})
