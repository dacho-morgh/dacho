import type { User } from '@cms-core/payload-types'

/**
 * The single authorization axis (decided 2026-10-17, superseding the previous
 * `role: applicant|staff` + `cmsRole: admin|editor` pair).
 *
 * A user holds zero or more roles, so the field is a multi-valued select. Every
 * capability in the system — CMS panel access, the internal dashboard, acting
 * for a company, reviewing plans — is derived from membership in this set.
 */
export const USER_ROLES = ['admin', 'representative', 'referee'] as const

export type UserRole = (typeof USER_ROLES)[number]

/**
 * A user document narrowed to just the fields authorization reads. Kept
 * structural rather than importing the generated `User` so these checks keep
 * compiling while `payload-types.ts` is regenerated.
 */
export type RoleCarrier = { roles?: readonly string[] | null } | null | undefined

/** True when the carrier holds the given role. */
export function hasRole(user: RoleCarrier, role: UserRole): boolean {
  return Array.isArray(user?.roles) && user.roles.includes(role)
}

/**
 * True when the user may act on behalf of the Fund's own team: reach the
 * Payload admin panel and the internal dashboard. This is the collapsed
 * replacement for the old `cmsRole === 'admin'` test.
 *
 * The parameter is intentionally loose so this can be passed straight to
 * Payload's `Access` signature.
 */
export function isInternalAdmin(user: unknown): boolean {
  return hasRole(user as RoleCarrier, 'admin')
}

/** Convenience: the Payload-generated user type re-exported for callers. */
export type { User }