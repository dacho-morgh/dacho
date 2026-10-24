import type { User } from '../auth/user-store.js'

/**
 * The seven operational roles from the approved domain model. One person has
 * exactly one of these values; `editor` remains a separate CMS content
 * privilege and is never an authority for workflow data.
 */
export const OPERATIONAL_ROLES = [
  'system-owner',
  'central-secretariat',
  'chief-reviewer',
  'reviewer',
  'employer-reviewer',
  'investment-reviewer',
  'representative',
] as const

export type OperationalRole = (typeof OPERATIONAL_ROLES)[number]

export function isOperationalRole(value: unknown): value is OperationalRole {
  return typeof value === 'string' && (OPERATIONAL_ROLES as readonly string[]).includes(value)
}

/**
 * Internal case roles that may receive an explicit request assignment. Owner,
 * Secretariat and representative authority comes from the role itself, not an
 * assignment row.
 */
export const ASSIGNABLE_CASE_ROLES = [
  'chief-reviewer',
  'reviewer',
  'employer-reviewer',
  'investment-reviewer',
] as const

export type CaseAssignmentRole = (typeof ASSIGNABLE_CASE_ROLES)[number]

export function isCaseAssignmentRole(value: unknown): value is CaseAssignmentRole {
  return typeof value === 'string' && (ASSIGNABLE_CASE_ROLES as readonly string[]).includes(value)
}

/**
 * Resolve authority from the **current** persisted account. The compatibility
 * `roles` array is used only by the in-memory test boundary and by legacy
 * records without an operational role; it is never read from a request header.
 */
export function operationalRoleOf(user: User | null | undefined): OperationalRole | null {
  if (!user || user.isActive === false || user.backendService === true) return null
  if (isOperationalRole(user.operationalRole)) return user.operationalRole
  if (user.operationalRole === null || user.operationalRole === undefined) {
    const roles = Array.isArray(user.roles) ? user.roles : []
    if (roles.includes('admin')) return 'system-owner'
    if (roles.includes('representative')) return 'representative'
    if (roles.includes('referee')) return 'reviewer'
  }
  return null
}

export function isInternalOperationalRole(role: OperationalRole): boolean {
  return role !== 'representative'
}
