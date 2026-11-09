import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { REVIEW_STAGE_OPTIONS, REQUEST_STATUS_VALUES, parseRequestFilters, requestFiltersQuery, requestQueueHref } from '@/components/dashboard/requests/types'
import {
  COMPANY_REQUEST_STAGES,
  COMPANY_REQUEST_STAGE_FILTER_OPTIONS,
  COMPANY_REQUEST_STAGE_LABELS,
  INTERNAL_REQUEST_STATUSES,
  INTERNAL_REVIEW_STAGES,
  companyRequestStage,
  companyRequestStageLabel,
  parseCompanyRequestStage,
} from '@/utilities/company-request-stage'
import { REQUEST_STATUS_LABELS } from '@/utilities/dashboard-api'

const ALLOWED_LABELS = ['احراز هویت', 'در حال داوری', 'تمام‌شده (نتیجهٔ نهایی)']

describe('company-facing request stages (design QA #280)', () => {
  it('has exactly the three company stages', () => {
    expect(COMPANY_REQUEST_STAGES.map((stage) => COMPANY_REQUEST_STAGE_LABELS[stage])).toEqual(ALLOWED_LABELS)
    expect(COMPANY_REQUEST_STAGE_FILTER_OPTIONS.map((option) => option.label)).toEqual(['همه', ...ALLOWED_LABELS])
  })

  it('knows every status and review stage the frontend lists elsewhere', () => {
    expect(new Set(INTERNAL_REQUEST_STATUSES)).toEqual(new Set(REQUEST_STATUS_VALUES))
    expect(new Set(INTERNAL_REQUEST_STATUSES)).toEqual(new Set(Object.keys(REQUEST_STATUS_LABELS)))
    expect(new Set(INTERNAL_REVIEW_STAGES)).toEqual(new Set(REVIEW_STAGE_OPTIONS.map((option) => option.value)))
  })

  it('knows every review stage the backend can store', () => {
    const source = readFileSync(resolve(__dirname, '../../../backend/src/dashboard/request-repo.ts'), 'utf8')
    const declared = /export type ReviewStage = ([^\n]+)/.exec(source)?.[1].match(/'([a-z_]+)'/g)?.map((value) => value.slice(1, -1))
    expect(declared && new Set(declared)).toEqual(new Set(INTERNAL_REVIEW_STAGES))
  })

  it('maps every internal status and review stage combination to one of the three stages', () => {
    for (const status of INTERNAL_REQUEST_STATUSES) {
      for (const reviewStage of [...INTERNAL_REVIEW_STAGES, null, undefined]) {
        const stage = companyRequestStage({ status, reviewStage })
        expect(COMPANY_REQUEST_STAGES).toContain(stage)
        expect(ALLOWED_LABELS).toContain(companyRequestStageLabel({ status, reviewStage }))
      }
    }
  })

  it('folds the secretariat and review stages into verification, reviewing and finished', () => {
    expect(companyRequestStage({ status: 'draft', reviewStage: null })).toBe('verification')
    expect(companyRequestStage({ status: 'in_review', reviewStage: 'chief_triage' })).toBe('verification')
    expect(companyRequestStage({ status: 'action_needed', reviewStage: 'chief_triage' })).toBe('verification')
    expect(companyRequestStage({ status: 'in_review', reviewStage: 'triaged' })).toBe('reviewing')
    expect(companyRequestStage({ status: 'in_review', reviewStage: 'advanced' })).toBe('reviewing')
    // A decision ends the case whichever stage it was taken in.
    for (const reviewStage of INTERNAL_REVIEW_STAGES) {
      expect(companyRequestStage({ status: 'approved', reviewStage })).toBe('finished')
      expect(companyRequestStage({ status: 'rejected', reviewStage })).toBe('finished')
    }
  })

  it('reads a value this client does not know as in review, never as finished or unlabelled', () => {
    expect(companyRequestStage({ status: 'in_review', reviewStage: 'future_stage' })).toBe('reviewing')
    expect(companyRequestStage({ status: 'archived' })).toBe('reviewing')
    expect(companyRequestStage({ status: 'toString' })).toBe('reviewing')
  })

  it('keeps only valid stages from the URL and carries them through list links and to the API', () => {
    expect(parseCompanyRequestStage('finished')).toBe('finished')
    expect(parseCompanyRequestStage('chief_triage')).toBeUndefined()
    expect(parseCompanyRequestStage(['finished'])).toBeUndefined()
    const filters = parseRequestFilters({ phase: 'reviewing', search: 'x' })
    expect(filters).toEqual({ phase: 'reviewing', search: 'x' })
    expect(requestQueueHref('/dashboard/requests', undefined, 2, filters)).toBe('/dashboard/requests?page=2&phase=reviewing&search=x')
    // The API folds status and review stage into `phase` with the same table (#280).
    expect(requestFiltersQuery(filters)).toBe('&phase=reviewing&search=x')
  })

  it('is the table the backend filters and counts with', () => {
    // apps/backend/tests/company-request-phase.spec.ts asserts the two agree for every combination;
    // this guards that the backend module the test reads still exists and lists the same phases.
    const source = readFileSync(resolve(__dirname, '../../../backend/src/dashboard/company-request-phase.ts'), 'utf8')
    const declared = /export const COMPANY_REQUEST_PHASES = \[([^\]]+)\]/.exec(source)?.[1].match(/'([a-z_]+)'/g)?.map((value) => value.slice(1, -1))
    expect(declared).toEqual([...COMPANY_REQUEST_STAGES])
  })
})
