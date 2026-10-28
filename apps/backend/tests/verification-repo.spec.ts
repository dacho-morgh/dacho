import { describe, expect, it } from 'vitest'
import { InMemoryVerificationStore } from '../src/dashboard/verification-repo.js'

describe('InMemoryVerificationStore', () => {
  const input = { companyId: 'company-1', representativeId: 'rep-1', snapshot: {} }

  it('accepts only one simultaneous submission per company', async () => {
    const store = new InMemoryVerificationStore()
    const results = await Promise.all([store.submit(input), store.submit(input)])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.find((result) => !result.ok)).toEqual({ ok: false, reason: 'already_submitted' })
    expect(await store.listHistory(input.companyId)).toHaveLength(1)
  })

  it('persists decisions addressed by company ID', async () => {
    const store = new InMemoryVerificationStore()
    await store.submit(input)
    const decision = await store.decide({ companyId: input.companyId, action: 'return', reviewerId: 'reviewer', reason: 'Correct documents' })
    expect(decision.ok).toBe(true)
    expect(await store.findCurrentByCompanyId(input.companyId)).toMatchObject({ status: 'returned' })
    const resubmit = await store.submit(input)
    expect(resubmit).toMatchObject({ ok: true, verification: { revision: 2 } })
  })
})
