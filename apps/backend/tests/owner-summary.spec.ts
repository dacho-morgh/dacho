import { describe, expect, it } from 'vitest'

import {
  activeStaffCounts,
  companyVerificationCounts,
  openEventCounts,
} from '../src/dashboard/owner-summary.js'

describe('owner summary counts', () => {
  it('counts approved and pending companies among all of them', () => {
    expect(companyVerificationCounts(['approved', 'pending', undefined])).toEqual({
      total: 3,
      approved: 1,
      pending: 1,
    })
  })

  it('counts active staff by group and ignores representatives and inactive accounts', () => {
    expect(
      activeStaffCounts([
        { id: '1', phone: '1', operationalRole: 'reviewer', isActive: true },
        { id: '2', phone: '2', operationalRole: 'reviewer', isActive: false },
        { id: '3', phone: '3', operationalRole: 'chief-reviewer', isActive: true },
        { id: '4', phone: '4', operationalRole: 'investment-reviewer', isActive: true },
        { id: '5', phone: '5', operationalRole: 'representative', isActive: true },
      ]),
    ).toEqual({ total: 3, reviewers: 1, chiefs: 1, employersAndExperts: 1 })
  })

  it('counts an event open from its open instant up to, and excluding, its close instant', () => {
    const now = new Date('2026-11-02T08:00:00Z')
    expect(
      openEventCounts(
        [
          { registrationOpenAt: '2026-10-01T00:00:00Z', registrationCloseAt: '2026-12-01T00:00:00Z' },
          { registrationOpenAt: '2026-10-01T00:00:00Z', registrationCloseAt: '2026-11-02T08:00:00Z' },
          { registrationOpenAt: '2026-12-01T00:00:00Z', registrationCloseAt: '2027-01-01T00:00:00Z' },
        ],
        now,
      ),
    ).toEqual({ total: 3, open: 1 })
  })
})
