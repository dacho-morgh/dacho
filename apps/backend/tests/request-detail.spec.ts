import { describe, expect, it } from 'vitest'

import { companyAgeYears, eventStage, eventWorkflow } from '../src/dashboard/request-detail.js'

describe('company age on the request page (#288)', () => {
  // 2026-11-09 is 1405-08-18 in the Persian calendar.
  const now = new Date('2026-11-09T12:00:00Z')

  it('counts a Persian founding year against the Persian year and a Gregorian one against the Gregorian year', () => {
    expect(companyAgeYears('1395', now)).toBe(10)
    expect(companyAgeYears('۱۳۹۵', now)).toBe(10)
    expect(companyAgeYears('1395/04/12', now)).toBe(10)
    expect(companyAgeYears('2010', now)).toBe(16)
  })

  it('has no age without a readable year', () => {
    expect(companyAgeYears(null, now)).toBeNull()
    expect(companyAgeYears('', now)).toBeNull()
    expect(companyAgeYears('قدیمی', now)).toBeNull()
    expect(companyAgeYears('1100', now)).toBeNull()
  })
})

describe('event application stages (#288)', () => {
  const facts = { resultPublished: false, lastAction: null }

  it.each([
    [{ status: 'draft', reviewStage: null }, facts, 'submission', 'current'],
    [{ status: 'in_review', reviewStage: 'chief_triage' }, facts, 'chief_triage', 'current'],
    [{ status: 'action_needed', reviewStage: 'chief_triage' }, facts, 'submission', 'current'],
    [{ status: 'in_review', reviewStage: 'triaged' }, facts, 'review', 'current'],
    [{ status: 'in_review', reviewStage: 'advanced' }, facts, 'investment', 'current'],
    [{ status: 'in_review', reviewStage: 'advanced' }, { resultPublished: true, lastAction: null }, 'result', 'current'],
    [{ status: 'rejected', reviewStage: 'chief_triage' }, { resultPublished: false, lastAction: 'chief_reject' }, 'chief_triage', 'rejected'],
    [{ status: 'rejected', reviewStage: 'chief_triage' }, { resultPublished: false, lastAction: 'chief_review_reject' }, 'review', 'rejected'],
    [{ status: 'approved', reviewStage: 'advanced' }, facts, 'result', 'done'],
  ] as const)('%o -> %s', (request, given, key, state) => {
    expect(eventStage(request, given)).toEqual({ key, state })
  })

  it('marks the steps before the current one done and the rest upcoming', () => {
    const steps = eventWorkflow({ status: 'in_review', reviewStage: 'triaged' }, facts)
    expect(steps.map((step) => [step.key, step.state])).toEqual([
      ['submission', 'done'],
      ['chief_triage', 'done'],
      ['review', 'current'],
      ['investment', 'upcoming'],
      ['result', 'upcoming'],
    ])
    expect(steps.map((step) => step.order)).toEqual([0, 1, 2, 3, 4])
  })

  it('never names the financial package, which the chief and reviewers may not see', () => {
    const text = JSON.stringify(eventWorkflow({ status: 'in_review', reviewStage: 'advanced' }, facts))
    expect(text).not.toMatch(/financial/i)
  })
})
