import { describe, expect, it } from 'vitest'

import { BOOTH_NEXT_ROLE_RULES, NEXT_ROLE_RULES, isNextStep } from '../src/dashboard/next-role.js'
import { TRANSITION_TITLES } from '../src/dashboard/transition-history.js'

describe('next-role rules (S1)', () => {
  it('names only recorded transitions and known steps', () => {
    for (const [action, rule] of Object.entries({ ...NEXT_ROLE_RULES, ...BOOTH_NEXT_ROLE_RULES })) {
      expect(TRANSITION_TITLES[action], action).toBeDefined()
      for (const notice of rule.notices) {
        if (notice.step !== null) expect(isNextStep(notice.step), `${action} → ${notice.step}`).toBe(true)
      }
      for (const step of rule.clears ?? []) expect(isNextStep(step), `${action} clears ${step}`).toBe(true)
    }
  })

  it('settles every step some transition asks for', () => {
    const rules = Object.values({ ...NEXT_ROLE_RULES, ...BOOTH_NEXT_ROLE_RULES })
    const asked = new Set(rules.flatMap((rule) => rule.notices.map((notice) => notice.step)))
    const cleared = new Set(rules.flatMap((rule) => rule.clears ?? []))
    for (const step of asked) {
      // Evaluate is also settled per reviewer when they finalize; the rest need a rule.
      if (step !== null) expect(cleared.has(step), step).toBe(true)
    }
  })
})
