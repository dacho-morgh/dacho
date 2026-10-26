import type { OperationalRole } from '../access/roles.js'

const managementRoles: readonly OperationalRole[] = ['system-owner', 'central-secretariat']
const caseRoles: readonly OperationalRole[] = [
  'system-owner', 'central-secretariat', 'chief-reviewer', 'reviewer',
  'employer-reviewer', 'investment-reviewer',
]

/** Validate a route before applying the current actor's server-side page policy. */
export function canOpenDashboardDestination(role: OperationalRole, value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[%\u0000-\u001f]/.test(value)) return false
  const path = value.replace(/\/+$/, '') || '/'
  const segments = path.split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) return false
  if (path === '/dashboard') return true

  if (path === '/dashboard/requests' || path.startsWith('/dashboard/requests/')) {
    return true
  }
  if (path === '/dashboard/letters' || path.startsWith('/dashboard/letters/') ||
      path === '/dashboard/inbox' || path.startsWith('/dashboard/inbox/')) {
    return true
  }
  if (path === '/dashboard/profile' || path === '/dashboard/profile/account') return true
  if (path === '/dashboard/profile/company' || path.startsWith('/dashboard/profile/company/')) {
    return role === 'representative'
  }
  if (path === '/dashboard/profile/resume' || path.startsWith('/dashboard/profile/resume/')) {
    return role === 'representative'
  }
  if (path === '/dashboard/profile/staff' || path.startsWith('/dashboard/profile/staff/')) {
    return role !== 'representative'
  }
  if (path === '/dashboard/companies' || path.startsWith('/dashboard/companies/')) {
    return managementRoles.includes(role)
  }
  if (path === '/dashboard/employees' || path.startsWith('/dashboard/employees/')) {
    return managementRoles.includes(role)
  }
  if (path === '/dashboard/events') return role === 'representative'
  if (path === '/dashboard/new-request') return role === 'representative'

  return false
}
