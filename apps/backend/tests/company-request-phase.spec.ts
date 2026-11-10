import { describe, expect, it } from 'vitest'

import {
  COMPANY_REQUEST_PHASES,
  PHASE_BY_REVIEW_STAGE,
  PHASE_BY_STATUS,
  companyRequestPhase,
  companyRequestPhaseSql,
  isCompanyRequestPhase,
} from '../src/dashboard/company-request-phase.js'
import { requestFilterClauses } from '../src/dashboard/request-repo.js'
import { parseRequestFilters } from '../src/dashboard/routes/route-helpers.js'
// The frontend's own copy of the table (design QA #280). It has no imports, so it loads here as is.
import {
  COMPANY_REQUEST_STAGES,
  INTERNAL_REQUEST_STATUSES,
  INTERNAL_REVIEW_STAGES,
  companyRequestStage,
} from '../../frontend/src/utilities/company-request-stage.js'

const STATUSES = Object.keys(PHASE_BY_STATUS)
const REVIEW_STAGES = Object.keys(PHASE_BY_REVIEW_STAGE)
/** Every review stage plus none, and values neither side knows. */
const STAGE_CASES = [...REVIEW_STAGES, null, undefined, 'future_stage']
const STATUS_CASES = [...STATUSES, 'archived', 'toString']

/**
 * Evaluates the generated SQL CASE for one row, so the unit test checks the SQL the list and the
 * counts run, not only the TypeScript twin. It understands exactly the shapes the builder emits.
 */
function evaluatePhaseSql(sql: string, row: { status: string; reviewStage: string | null | undefined }): string {
  const body = /^\(CASE (.*) ELSE '([a-z_]+)' END\)$/.exec(sql)
  if (!body) throw new Error(`Unexpected SQL: ${sql}`)
  const branches = body[1]!.split(/ (?=WHEN )/)
  for (const branch of branches) {
    const simple = /^WHEN r\.status = '([a-z_]+)' THEN '([a-z_]+)'$/.exec(branch)
    if (simple) {
      if (row.status === simple[1]) return simple[2]!
      continue
    }
    const staged = /^WHEN r\.status IN \(([^)]*)\) AND r\.review_stage = '([a-z_]+)' THEN '([a-z_]+)'$/.exec(branch)
    if (!staged) throw new Error(`Unexpected branch: ${branch}`)
    const statuses = staged[1]!.split(', ').map((value) => value.slice(1, -1))
    if (statuses.includes(row.status) && row.reviewStage === staged[2]) return staged[3]!
  }
  return body[2]!
}

describe('company request phase (#280)', () => {
  it('has the three phases the frontend shows', () => {
    expect([...COMPANY_REQUEST_PHASES]).toEqual([...COMPANY_REQUEST_STAGES])
  })

  it('knows the same statuses and review stages as the frontend', () => {
    expect(new Set(STATUSES)).toEqual(new Set(INTERNAL_REQUEST_STATUSES))
    expect(new Set(REVIEW_STAGES)).toEqual(new Set(INTERNAL_REVIEW_STAGES))
  })

  it('names the same phase as the frontend for every status × review stage', () => {
    for (const status of STATUS_CASES) {
      for (const reviewStage of STAGE_CASES) {
        const row = { status, reviewStage }
        const expected = companyRequestStage(row)
        expect(companyRequestPhase(row), `${status} / ${String(reviewStage)}`).toBe(expected)
        // The stored column is NULL when there is no stage; `undefined` only exists in TypeScript.
        expect(evaluatePhaseSql(companyRequestPhaseSql('r'), { status, reviewStage: reviewStage ?? null }), `SQL ${status} / ${String(reviewStage)}`).toBe(expected)
      }
    }
  })

  it('folds the internal stages as the design asks', () => {
    expect(companyRequestPhase({ status: 'draft', reviewStage: null })).toBe('verification')
    expect(companyRequestPhase({ status: 'in_review', reviewStage: 'chief_triage' })).toBe('verification')
    expect(companyRequestPhase({ status: 'action_needed', reviewStage: 'chief_triage' })).toBe('verification')
    expect(companyRequestPhase({ status: 'in_review', reviewStage: 'triaged' })).toBe('reviewing')
    expect(companyRequestPhase({ status: 'action_needed', reviewStage: 'advanced' })).toBe('reviewing')
    expect(companyRequestPhase({ status: 'in_review', reviewStage: null })).toBe('reviewing')
    expect(companyRequestPhase({ status: 'approved', reviewStage: 'chief_triage' })).toBe('finished')
    expect(companyRequestPhase({ status: 'rejected', reviewStage: null })).toBe('finished')
  })

  it('accepts only the three phases', () => {
    for (const phase of COMPANY_REQUEST_PHASES) expect(isCompanyRequestPhase(phase)).toBe(true)
    for (const value of ['', 'Finished', 'chief_triage', 'in_review', ['finished'], 1, null]) {
      expect(isCompanyRequestPhase(value)).toBe(false)
    }
  })
})

describe('the phase filter', () => {
  const company = { id: 'company-user', operationalRole: 'representative' as const }
  const staff = { id: 'secretariat', operationalRole: 'central-secretariat' as const }

  it('is parsed for every role and refuses an unknown or repeated value', () => {
    expect(parseRequestFilters({ phase: 'reviewing' }, company)).toEqual({ phase: 'reviewing' })
    expect(parseRequestFilters({ phase: 'finished', search: 'x' }, staff)).toEqual({ phase: 'finished', search: 'x' })
    expect(parseRequestFilters({ phase: 'done' }, company)).toBe('invalid_phase')
    expect(parseRequestFilters({ phase: '' }, company)).toBe('invalid_phase')
    expect(parseRequestFilters({ phase: ['finished', 'reviewing'] }, company)).toBe('invalid_phase')
  })

  it('leaves the filters unchanged when absent', () => {
    expect(parseRequestFilters({}, staff)).toEqual({})
    expect(requestFilterClauses({}, [])).toEqual([])
  })

  it('is a bound parameter compared with the shared expression', () => {
    const params: unknown[] = ['scope']
    const clauses = requestFilterClauses({ phase: 'verification' }, params)
    expect(params).toEqual(['scope', 'verification'])
    expect(clauses).toEqual([`${companyRequestPhaseSql('r')} = $2`])
  })
})
