import type { User } from '@cms-core/payload-types'

export const OPERATIONAL_ROLES = ['system-owner', 'central-secretariat', 'chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer', 'representative'] as const
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
export const USER_ROLE_LABELS: Record<UserRole, string> = { admin: 'صاحب سیستم', editor: 'تحریر', representative: 'نماینده شرکت', referee: 'داور' }
export type RoleCarrier = {
  operationalRole?: string | null
  isActive?: boolean | null
  contentEditor?: boolean | null
  backendService?: boolean | null
  roles?: readonly string[] | null
} | null | undefined

export function isActiveAccount(user: RoleCarrier): boolean { return user?.isActive === true }
export function compatibilityRoles(user: RoleCarrier): UserRole[] {
  if (!isActiveAccount(user) || user?.backendService) return []
  const result: UserRole[] = []
  if (user?.operationalRole === 'system-owner') result.push('admin')
  if (user?.operationalRole === 'representative') result.push('representative')
  if (user?.operationalRole === 'reviewer') result.push('referee')
  if (user?.contentEditor) result.push('editor')
  return result
}
export function hasRole(user: RoleCarrier, role: UserRole): boolean { return compatibilityRoles(user).includes(role) }
export function isInternalAdmin(user: unknown): boolean { return hasRole(user as RoleCarrier, 'admin') }
export function isContentEditor(user: unknown): boolean {
  return isInternalAdmin(user) || hasRole(user as RoleCarrier, 'editor')
}
export function isBackendService(user: unknown): boolean {
  const account = user as RoleCarrier
  return isActiveAccount(account) && account?.backendService === true
}
export type { User }
