import { describe, expect, it } from 'vitest'
import { canSendLetter } from '../src/dashboard/letter-policy.js'

describe('letter recipient roles', () => {
  it('limits company support and reviewers to their roles', () => {
    expect(canSendLetter('representative', 'central-secretariat', false)).toBe(true)
    expect(canSendLetter('representative', 'chief-reviewer', true)).toBe(false)
    expect(canSendLetter('reviewer', 'chief-reviewer', false)).toBe(false)
    expect(canSendLetter('reviewer', 'chief-reviewer', true)).toBe(true)
    expect(canSendLetter('employer-reviewer', 'reviewer', true)).toBe(false)
    expect(canSendLetter('investment-reviewer', 'central-secretariat', false)).toBe(false)
  })
  it('permits owner and chief general correspondence', () => {
    expect(canSendLetter('system-owner', 'reviewer', false)).toBe(true)
    expect(canSendLetter('chief-reviewer', 'representative', false)).toBe(true)
  })
  it('keeps case letters of the investment person within the staff of the financial audience', () => {
    for (const role of ['system-owner', 'central-secretariat'] as const) {
      expect(canSendLetter('investment-reviewer', role, true)).toBe(true)
      expect(canSendLetter(role, 'investment-reviewer', true)).toBe(true)
    }
    for (const role of ['chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer', 'representative'] as const) {
      expect(canSendLetter('investment-reviewer', role, true)).toBe(false)
      expect(canSendLetter(role, 'investment-reviewer', true)).toBe(false)
    }
  })
  it('gives the investment person no general letters to send', () => {
    for (const role of ['system-owner', 'central-secretariat', 'chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer', 'representative'] as const) {
      expect(canSendLetter('investment-reviewer', role, false)).toBe(false)
    }
    expect(canSendLetter('system-owner', 'investment-reviewer', false)).toBe(true)
    expect(canSendLetter('chief-reviewer', 'investment-reviewer', false)).toBe(true)
    expect(canSendLetter('central-secretariat', 'investment-reviewer', false)).toBe(false)
  })

})
