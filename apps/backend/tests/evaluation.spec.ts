import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { InMemoryUserStore, type User } from '../src/auth/user-store.js'
import { InMemoryEvaluationStore } from '../src/reviews/evaluation-repo.js'
import { createTestApp } from './helpers.js'

const REQUEST_ID = '00000000-0000-4000-8000-000000000001'
const MISSING_REQUEST_ID = '00000000-0000-4000-8000-000000000002'

const USERS: User[] = [
  { id: 'owner-1', phone: '09000000001', name: 'System Owner', operationalRole: 'system-owner', isActive: true },
  { id: 'chief-1', phone: '09000000002', name: 'Chief Reviewer', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'reviewer-1', phone: '09000000003', name: 'Reviewer One', operationalRole: 'reviewer', isActive: true },
  { id: 'reviewer-2', phone: '09000000004', name: 'Reviewer Two', operationalRole: 'reviewer', isActive: true },
  { id: 'employer-1', phone: '09000000005', name: 'Employer Reviewer', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'rep-1', phone: '09000000006', name: 'Representative', operationalRole: 'representative', isActive: true },
]

function validOrdinaryScores() {
  return {
    a: {
      technologyLevel: { tier: 'mid', score: 5 },
      interdisciplinary: 6,
      innovation: { articles: true, domesticPatentCount: 2, international: true },
      customization: 7,
      developmentMethod: { tier: 'improvement', score: 5 },
      environment: { tier: 'appropriate', score: 7 },
    },
    b: {
      developmentStage: { tier: 'industrial', score: 8 },
      addedValue: 6,
      marketReach: { tier: 'international', score: 12 },
      futureOilGasDemand: 7,
      importSubstitution: 8,
    },
    c: {
      technicalReportQuality: { tier: 'appropriate', score: 8 },
      scientificAuthorityEndorsement: 5,
      nationalStandard: 10,
      isoProductQuality: 10,
      salesContracts: 4,
    },
  }
}

function validOrdinaryAnswers() {
  return {
    technicalApproachClear: 'yes',
    objectivesAchievableOnTime: 'yes',
    scientificPrinciplesSound: 'yes',
    operationsDetailedRealistic: 'yes',
    resourcesListed: 'no', // valid negative answer
    scheduleExecutable: 'yes',
    budgetBreakdown: 'yes',
    costsJustified: 'yes',
    costBenefitAnalysis: 'yes',
    environmentalImpactsIdentified: 'yes',
    environmentalMitigation: 'yes',
    riskAssessmentDone: 'yes',
    risksMitigated: 'no', // valid negative answer
    recommendation: 'recommend',
    topFive: { answer: 'yes', rationale: 'Strong proposal with high impact.' },
  }
}

function validEmployerRisk() {
  return {
    assessment: { done: 'yes' },
    financial: { budgetSufficiency: 'no', costDrivers: 'Raw material volatility', minMaxCosts: 'Between 10M and 30M' },
    technical: { newTechnology: 'yes', teamSkills: 'yes', materialsEquipmentTimely: 'yes', productionIssues: 'Minor supply chain risks' },
    schedule: { schedule: '3 months milestone phase', supplyDelays: 'no', otherTimingFactors: 'Weather dependent' },
    legal: { permits: 'yes', localNationalCompliance: 'yes', futureIssues: 'no' },
    human: { teamSizeSkills: 'yes', tensionsConflicts: 'no', training: 'yes' },
    environment: { negativeImpacts: 'no', mitigation: 'yes' },
    stakeholders: { keyStakeholders: 'Ministry of Petroleum', support: 'yes', conflicts: 'no' },
    external: { economicPoliticalSocial: 'no', unpredictable: 'Currency fluctuations' },
  }
}

async function setupTest(assignments: Array<{ requestId: string; userId: string; role: string; active?: boolean }> = []) {
  const userStore = new InMemoryUserStore(USERS)
  const evaluationStore = new InMemoryEvaluationStore()

  // Mock pool for request and assignment lookups
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM dashboard.requests') && sql.includes('id = $1')) {
      const id = params[0]
      if (id === REQUEST_ID) {
        return {
          rows: [{
            id: REQUEST_ID,
            tracking_code: 'DCH-2026-0001',
            title: 'طرح آزمایشی',
            service_id: '1',
            service_key: 'financing',
            owner_id: 'rep-1',
            status: 'in_review',
            current_step_index: 0,
            revision: 1,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        }
      }
      return { rows: [] }
    }
    if (sql.includes('FROM dashboard.case_assignments')) {
      const reqId = params[0]
      const userId = params[1]
      const found = assignments.filter((a) => a.requestId === reqId && a.userId === userId && (a.active ?? true))
      return {
        rows: found.map((a, i) => ({
          id: `assignment-${i + 1}`,
          request_id: a.requestId,
          user_id: a.userId,
          role: a.role,
          active: a.active ?? true,
          assigned_by: 'owner-1',
          assigned_at: new Date(),
          revoked_by: null,
          revoked_at: null,
          revoke_reason: null,
        })),
      }
    }
    return { rows: [] }
  }

  const { app } = await createTestApp({
    userStore,
    evaluationStore,
    pool: { query } as any,
  })

  const authHeader = (userId: string) => ({
    'x-internal-proxy-secret': 'test-proxy-secret',
    'x-user-id': userId,
  })

  return { app, evaluationStore, authHeader }
}

describe('[T25] Evaluation draft, finalization and lock', () => {
  it('rejects unassigned or non-evaluating actors with 403', async () => {
    const { app, authHeader } = await setupTest([
      { requestId: REQUEST_ID, userId: 'reviewer-1', role: 'reviewer' },
    ])

    // Representative cannot evaluate
    const repRes = await request(app)
      .get(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('rep-1'))
    expect(repRes.status).toBe(403)

    // Unassigned reviewer cannot evaluate this request
    const unassignedRes = await request(app)
      .get(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-2'))
    expect(unassignedRes.status).toBe(403)

    // Missing request returns 404
    const notFoundRes = await request(app)
      .get(`/requests/${MISSING_REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-1'))
    expect(notFoundRes.status).toBe(404)
  })

  it('allows saving an incomplete draft without counting toward completed evaluations', async () => {
    const { app, evaluationStore, authHeader } = await setupTest([
      { requestId: REQUEST_ID, userId: 'reviewer-1', role: 'reviewer' },
    ])

    // Save partial draft (only 1 score row and no qualitative answers)
    const draftRes = await request(app)
      .put(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-1'))
      .send({
        scores: {
          a: { technologyLevel: { tier: 'mid', score: 5 } },
        },
        answers: {
          technicalApproachClear: 'unanswered',
        },
      })

    expect(draftRes.status).toBe(200)
    expect(draftRes.body.evaluation).toMatchObject({
      requestId: REQUEST_ID,
      userId: 'reviewer-1',
      variant: 'ordinary',
      state: 'draft',
      scoreA: 5,
    })

    // Draft does NOT count toward 4 completed evaluations
    const count = await evaluationStore.countFinalized(REQUEST_ID)
    expect(count).toBe(0)

    // Read back own draft
    const getRes = await request(app)
      .get(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-1'))

    expect(getRes.status).toBe(200)
    expect(getRes.body.evaluation.state).toBe('draft')
    expect(getRes.body.completedEvaluationsCount).toBe(0)
  })

  it('prohibits reviewer from viewing or editing another reviewer evaluation', async () => {
    const { app, authHeader } = await setupTest([
      { requestId: REQUEST_ID, userId: 'reviewer-1', role: 'reviewer' },
      { requestId: REQUEST_ID, userId: 'reviewer-2', role: 'reviewer' },
    ])

    // Reviewer 1 saves draft
    await request(app)
      .put(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-1'))
      .send({ scores: { a: { interdisciplinary: 4 } } })

    // Reviewer 2 checks their own evaluation -> null, cannot see reviewer 1's draft
    const res2 = await request(app)
      .get(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-2'))

    expect(res2.status).toBe(200)
    expect(res2.body.evaluation).toBeNull()

    // Reviewer cannot list all evaluations (only chief or owner)
    const listRes = await request(app)
      .get(`/requests/${REQUEST_ID}/evaluations`)
      .set(authHeader('reviewer-1'))

    expect(listRes.status).toBe(403)
  })

  it('rejects finalization when required rubric or qualitative questions are incomplete', async () => {
    const { app, authHeader } = await setupTest([
      { requestId: REQUEST_ID, userId: 'reviewer-1', role: 'reviewer' },
    ])

    // Save partial draft first
    await request(app)
      .put(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-1'))
      .send({
        scores: validOrdinaryScores(),
        answers: {
          ...validOrdinaryAnswers(),
          technicalApproachClear: undefined, // missing required question
        },
      })

    // Finalization fails with validation errors
    const failRes = await request(app)
      .post(`/requests/${REQUEST_ID}/evaluation/finalize`)
      .set(authHeader('reviewer-1'))
      .send({
        scores: validOrdinaryScores(),
        answers: {
          ...validOrdinaryAnswers(),
          technicalApproachClear: undefined,
        },
      })

    expect(failRes.status).toBe(400)
    expect(failRes.body.error).toBe('validation_failed')
    expect(failRes.body.errors['answers.technicalApproachClear']).toBeDefined()
  })

  it('finalizes a complete evaluation, locks it, and increments completed count', async () => {
    const { app, evaluationStore, authHeader } = await setupTest([
      { requestId: REQUEST_ID, userId: 'reviewer-1', role: 'reviewer' },
    ])

    const payload = {
      scores: validOrdinaryScores(),
      answers: validOrdinaryAnswers(),
    }

    const finalRes = await request(app)
      .post(`/requests/${REQUEST_ID}/evaluation/finalize`)
      .set(authHeader('reviewer-1'))
      .send(payload)

    expect(finalRes.status).toBe(200)
    expect(finalRes.body.evaluation).toMatchObject({
      requestId: REQUEST_ID,
      userId: 'reviewer-1',
      variant: 'ordinary',
      state: 'final',
    })
    expect(finalRes.body.evaluation.finalizedAt).toBeTruthy()

    // Count is now 1
    const count = await evaluationStore.countFinalized(REQUEST_ID)
    expect(count).toBe(1)

    // Attempting to modify locked evaluation with PUT draft returns 409
    const editRes = await request(app)
      .put(`/requests/${REQUEST_ID}/evaluation`)
      .set(authHeader('reviewer-1'))
      .send({ scores: { a: { interdisciplinary: 9 } } })

    expect(editRes.status).toBe(409)
    expect(editRes.body.error).toBe('evaluation_locked')

    // Attempting to re-finalize returns 409
    const reFinalRes = await request(app)
      .post(`/requests/${REQUEST_ID}/evaluation/finalize`)
      .set(authHeader('reviewer-1'))
      .send(payload)

    expect(reFinalRes.status).toBe(409)
    expect(reFinalRes.body.error).toBe('evaluation_locked')

    // Count remains 1 (no duplicate increment)
    expect(await evaluationStore.countFinalized(REQUEST_ID)).toBe(1)
  })

  it('validates employer risk checklist and locks employer evaluation', async () => {
    const { app, evaluationStore, authHeader } = await setupTest([
      { requestId: REQUEST_ID, userId: 'employer-1', role: 'employer-reviewer' },
    ])

    // Employer with incomplete risk checklist fails finalization
    const badEmployerRes = await request(app)
      .post(`/requests/${REQUEST_ID}/evaluation/finalize`)
      .set(authHeader('employer-1'))
      .send({
        scores: validOrdinaryScores(),
        answers: {
          risk: { assessment: { done: 'yes' } }, // incomplete!
          recommendation: 'recommend',
          topFive: { answer: 'yes', rationale: 'Good.' },
        },
      })

    expect(badEmployerRes.status).toBe(400)
    expect(badEmployerRes.body.error).toBe('validation_failed')

    // Employer with complete risk checklist succeeds and locks
    const goodEmployerRes = await request(app)
      .post(`/requests/${REQUEST_ID}/evaluation/finalize`)
      .set(authHeader('employer-1'))
      .send({
        scores: validOrdinaryScores(),
        answers: {
          risk: validEmployerRisk(),
          recommendation: 'strongly_recommend',
          topFive: { answer: 'yes', rationale: 'Key industry fit.' },
        },
      })

    expect(goodEmployerRes.status).toBe(200)
    expect(goodEmployerRes.body.evaluation).toMatchObject({
      variant: 'employer',
      state: 'final',
    })
    expect(await evaluationStore.countFinalized(REQUEST_ID)).toBe(1)
  })

  it('allows chief-reviewer and system-owner to view evaluations', async () => {
    const { app, authHeader } = await setupTest([
      { requestId: REQUEST_ID, userId: 'reviewer-1', role: 'reviewer' },
      { requestId: REQUEST_ID, userId: 'chief-1', role: 'chief-reviewer' },
    ])

    // Reviewer finalizes
    await request(app)
      .post(`/requests/${REQUEST_ID}/evaluation/finalize`)
      .set(authHeader('reviewer-1'))
      .send({
        scores: validOrdinaryScores(),
        answers: validOrdinaryAnswers(),
      })

    // Chief views evaluations
    const chiefRes = await request(app)
      .get(`/requests/${REQUEST_ID}/evaluations`)
      .set(authHeader('chief-1'))

    expect(chiefRes.status).toBe(200)
    expect(chiefRes.body.items).toHaveLength(1)
    expect(chiefRes.body.completedCount).toBe(1)
    expect(chiefRes.body.items[0].userId).toBe('reviewer-1')

    // System owner views evaluations
    const ownerRes = await request(app)
      .get(`/requests/${REQUEST_ID}/evaluations`)
      .set(authHeader('owner-1'))

    expect(ownerRes.status).toBe(200)
    expect(ownerRes.body.completedCount).toBe(1)
  })

  describe('PostgresEvaluationRepository (database operations & locking)', () => {
    it('executes atomic saveDraft, finalize and rejects modifications when locked', async () => {
      const { PostgresEvaluationRepository } = await import('../src/reviews/evaluation-repo.js')

      let evaluationRow: any = null
      const client = {
        query: async (sql: string, params: unknown[] = []) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [] }
          }
          if (sql.includes('SELECT state FROM dashboard.evaluations')) {
            return { rows: evaluationRow ? [{ state: evaluationRow.state }] : [] }
          }
          if (sql.includes('INSERT INTO dashboard.evaluations')) {
            const isFinal = sql.includes("'final', $5")
            evaluationRow = {
              id: '00000000-0000-4000-8000-000000000099',
              request_id: params[0],
              user_id: params[1],
              role: params[2],
              variant: params[3],
              revision: params[4],
              scores: params[5],
              score_a: params[6],
              score_b: params[7],
              score_c: params[8],
              weighted_hundredths: params[9],
              answers: params[10],
              state: isFinal ? 'final' : 'draft',
              created_at: new Date(),
              updated_at: new Date(),
              finalized_at: isFinal ? new Date() : null,
            }
            return { rows: [evaluationRow] }
          }
          if (sql.includes('SELECT count(*)::integer AS count FROM dashboard.evaluations')) {
            const count = evaluationRow?.state === 'final' ? 1 : 0
            return { rows: [{ count }] }
          }
          if (sql.includes('FROM dashboard.evaluations WHERE request_id = $1')) {
            return { rows: evaluationRow ? [evaluationRow] : [] }
          }
          return { rows: [] }
        },
        release: () => {},
      }

      const mockPool = {
        connect: async () => client,
        query: async (sql: string, params: unknown[] = []) => client.query(sql, params),
      } as any

      const repo = new PostgresEvaluationRepository(mockPool)

      // 1. Initial state is empty
      expect(await repo.findByRequestAndUser(REQUEST_ID, 'reviewer-1')).toBeNull()
      expect(await repo.countFinalized(REQUEST_ID)).toBe(0)

      // 2. Save draft
      const draftResult = await repo.saveDraft({
        requestId: REQUEST_ID,
        userId: 'reviewer-1',
        role: 'reviewer',
        variant: 'ordinary',
        revision: 1,
        scores: { a: { interdisciplinary: 5 } },
        scoreA: 5,
        scoreB: 0,
        scoreC: 0,
        weightedHundredths: 225,
        answers: {},
      })
      expect(draftResult.ok).toBe(true)
      expect(await repo.countFinalized(REQUEST_ID)).toBe(0)

      // 3. Finalize
      const finalizeResult = await repo.finalize({
        requestId: REQUEST_ID,
        userId: 'reviewer-1',
        role: 'reviewer',
        variant: 'ordinary',
        revision: 1,
        scores: validOrdinaryScores(),
        scoreA: 40,
        scoreB: 30,
        scoreC: 20,
        weightedHundredths: 3300,
        answers: validOrdinaryAnswers(),
      })
      expect(finalizeResult.ok).toBe(true)
      if (finalizeResult.ok) {
        expect(finalizeResult.evaluation.state).toBe('final')
      }
      expect(await repo.countFinalized(REQUEST_ID)).toBe(1)

      // 4. Try saving draft after finalization -> locked
      const postFinalDraft = await repo.saveDraft({
        requestId: REQUEST_ID,
        userId: 'reviewer-1',
        role: 'reviewer',
        variant: 'ordinary',
        revision: 1,
        scores: {},
        scoreA: 0,
        scoreB: 0,
        scoreC: 0,
        weightedHundredths: 0,
        answers: {},
      })
      expect(postFinalDraft.ok).toBe(false)
      expect(postFinalDraft).toEqual({ ok: false, reason: 'locked' })

      // 5. Try finalizing again -> locked
      const postFinalFinalize = await repo.finalize({
        requestId: REQUEST_ID,
        userId: 'reviewer-1',
        role: 'reviewer',
        variant: 'ordinary',
        revision: 1,
        scores: {},
        scoreA: 0,
        scoreB: 0,
        scoreC: 0,
        weightedHundredths: 0,
        answers: {},
      })
      expect(postFinalFinalize.ok).toBe(false)
      expect(postFinalFinalize).toEqual({ ok: false, reason: 'locked' })

      // 6. List for request
      const list = await repo.listForRequest(REQUEST_ID)
      expect(list).toHaveLength(1)
      expect(list[0]?.state).toBe('final')
    })
  })
})
