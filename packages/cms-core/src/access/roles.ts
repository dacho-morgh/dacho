import type { User } from '@cms-core/payload-types'

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
export const OPERATIONAL_ROLE_LABELS: Record<OperationalRole, string> = {
  'system-owner': 'صاحب سیستم',
  'central-secretariat': 'دبیرخانه مرکزی',
  'chief-reviewer': 'سردبیر داوری',
  reviewer: 'داور',
  'employer-reviewer': 'کارفرما',
  'investment-reviewer': 'کمیته سرمایه‌گذاری',
  representative: 'نماینده شرکت',
}

// Transitional transport for the existing dashboard. Never accept this array
// as authority: it is projected from the current scalar role and active state.
export const USER_ROLES = ['admin', 'editor', 'representative', 'referee'] as const
export type UserRole = (typeof USER_ROLES)[number]
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'صاحب سیستم',
  editor: 'تحریر',
  representative: 'نماینده شرکت',
  referee: 'داور',
}
export type RoleCarrier =
  | {
      operationalRole?: string | null
      isActive?: boolean | null
      contentEditor?: boolean | null
      backendService?: boolean | null
      _strategy?: string | null
      roles?: readonly string[] | null
    }
  | null
  | undefined

export function isActiveAccount(user: RoleCarrier): boolean {
  return user?.isActive === true
}
export function compatibilityRoles(user: RoleCarrier): UserRole[] {
  if (!isActiveAccount(user) || user?.backendService) return []
  const result: UserRole[] = []
  if (user?.operationalRole === 'system-owner') result.push('admin')
  if (user?.operationalRole === 'representative') result.push('representative')
  if (user?.operationalRole === 'reviewer') result.push('referee')
  if (user?.contentEditor) result.push('editor')
  return result
}
export function hasRole(user: RoleCarrier, role: UserRole): boolean {
  return compatibilityRoles(user).includes(role)
}

/**
 * The current scalar operational role. Falls back to the compatibility
 * projection only for legacy/in-memory records without a scalar value; it never
 * reads a request header or browser claim.
 */
export function operationalRole(user: RoleCarrier): OperationalRole | null {
  if (!isActiveAccount(user) || user?.backendService) return null
  if (user?.operationalRole) {
    return (OPERATIONAL_ROLES as readonly string[]).includes(user.operationalRole)
      ? (user.operationalRole as OperationalRole)
      : null
  }
  const roles = Array.isArray(user?.roles) ? user.roles : []
  if (roles.includes('admin')) return 'system-owner'
  if (roles.includes('representative')) return 'representative'
  if (roles.includes('referee')) return 'reviewer'
  return null
}

export function hasOperationalRole(user: RoleCarrier, role: OperationalRole): boolean {
  return operationalRole(user) === role
}

/** Operational staff allowed to read private dossiers (owner and Secretariat). */
export function isCompanyAdministrator(user: RoleCarrier): boolean {
  const role = operationalRole(user)
  return role === 'system-owner' || role === 'central-secretariat'
}

/**
 * The Payload admin panel remains a content desk. Secretariat may enter to read
 * verification records; chief/reviewer/employer/investment and representatives
 * do not.
 */
export function isCmsOperator(user: RoleCarrier): boolean {
  return isContentEditor(user) || hasOperationalRole(user, 'central-secretariat')
}
export function isInternalAdmin(user: unknown): boolean {
  return hasRole(user as RoleCarrier, 'admin')
}
export function isContentEditor(user: unknown): boolean {
  return isInternalAdmin(user) || hasRole(user as RoleCarrier, 'editor')
}
export function isBackendService(user: unknown): boolean {
  const account = user as RoleCarrier
  return (
    isActiveAccount(account) && account?.backendService === true && account?._strategy === 'api-key'
  )
}
export type { User }
