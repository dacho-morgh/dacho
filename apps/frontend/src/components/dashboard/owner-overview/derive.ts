import type { OperationalRole } from '@cms-core/access/roles'

export interface CompanyRow {
  verificationStatus: string
}

export interface EmployeeRow {
  operationalRole: OperationalRole
  isActive: boolean
}

export interface EventRow {
  registrationOpenAt: string
  registrationCloseAt: string
}

export function companyVerification(rows: readonly CompanyRow[]) {
  return {
    total: rows.length,
    approved: rows.filter((row) => row.verificationStatus === 'approved').length,
    pending: rows.filter((row) => row.verificationStatus === 'pending').length,
  }
}

export function activeEmployees(rows: readonly EmployeeRow[]) {
  const active = rows.filter((row) => row.isActive)
  const count = (...roles: OperationalRole[]) =>
    active.filter((row) => roles.includes(row.operationalRole)).length
  return {
    total: active.length,
    reviewers: count('reviewer'),
    chiefs: count('chief-reviewer'),
    employersAndExperts: count('employer-reviewer', 'investment-reviewer'),
  }
}

/** Registration is open from its open instant up to, and excluding, its close instant. */
export function openEvents(rows: readonly EventRow[], now: Date) {
  const at = now.getTime()
  return rows.filter(
    (row) => Date.parse(row.registrationOpenAt) <= at && at < Date.parse(row.registrationCloseAt),
  ).length
}
