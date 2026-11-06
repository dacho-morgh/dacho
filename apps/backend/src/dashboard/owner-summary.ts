import { operationalRoleOf } from '../access/roles.js'
import type { User } from '../auth/user-store.js'

/** Representatives by the decision on their latest verification; a company without a submission has none. */
export function companyVerificationCounts(statuses: readonly (string | undefined)[]) {
  return {
    total: statuses.length,
    approved: statuses.filter((status) => status === 'approved').length,
    pending: statuses.filter((status) => status === 'pending').length,
  }
}

/** Active staff accounts, by the groups the owner overview shows. Representatives are not staff. */
export function activeStaffCounts(users: readonly User[]) {
  const counts = { total: 0, reviewers: 0, chiefs: 0, employersAndExperts: 0 }
  for (const user of users) {
    const role = operationalRoleOf(user)
    if (!role || role === 'representative' || user.isActive !== true) continue
    counts.total += 1
    if (role === 'reviewer') counts.reviewers += 1
    else if (role === 'chief-reviewer') counts.chiefs += 1
    else if (role === 'employer-reviewer' || role === 'investment-reviewer') counts.employersAndExperts += 1
  }
  return counts
}

/** Registration is open from its open instant up to, and excluding, its close instant. */
export function openEventCounts(
  events: readonly { registrationOpenAt: string; registrationCloseAt: string }[],
  now: Date,
) {
  const at = now.getTime()
  return {
    total: events.length,
    open: events.filter((event) => Date.parse(event.registrationOpenAt) <= at && at < Date.parse(event.registrationCloseAt)).length,
  }
}
