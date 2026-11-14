import type { OperationalRole } from '../access/roles.js'

const managementRoles: readonly OperationalRole[] = ['system-owner', 'central-secretariat']
const caseRoles: readonly OperationalRole[] = [
  'system-owner', 'central-secretariat', 'chief-reviewer', 'reviewer',
  'employer-reviewer', 'investment-reviewer',
]

/** Validate a route before applying the current actor's server-side page policy. */
export function canOpenDashboardDestination(role: OperationalRole, rawValue: string): boolean {
  // A support or form mail id is «prefix:uuid», which the browser sends as «prefix%3Auuid».
  // That one escape is a plain colon; every other escape stays refused below.
  const value = rawValue.replace(/%3a/gi, ':')
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
  // A chief reviewer opens one company's page from a case of theirs (the server limits which), never the list.
  if (role === 'chief-reviewer' && /^\/dashboard\/companies\/[^/]+$/.test(path)) return true
  if (path === '/dashboard/companies' || path.startsWith('/dashboard/companies/')) {
    return managementRoles.includes(role)
  }
  if (path === '/dashboard/follow-ups' || path.startsWith('/dashboard/follow-ups/')) {
    return managementRoles.includes(role)
  }
  if (path === '/dashboard/employees' || path.startsWith('/dashboard/employees/')) {
    return managementRoles.includes(role)
  }
  // The owner's event and exhibition admin pages (S5): create, edit and subtopics.
  if (path === '/dashboard/events/new' ||
      /^\/dashboard\/events\/[^/]+\/(edit|subtopics)$/.test(path) ||
      /^\/dashboard\/exhibitions\/[^/]+\/edit$/.test(path)) {
    return role === 'system-owner'
  }
  if (path === '/dashboard/events' || path.startsWith('/dashboard/events/')) {
    return role === 'representative' || role === 'system-owner'
  }
  if (path === '/dashboard/exhibitions' || path.startsWith('/dashboard/exhibitions/')) {
    // Companies open a booth page from the events list; S7 (#245).
    return managementRoles.includes(role) || role === 'representative'
  }
  if (path === '/dashboard/new-request') return role === 'representative'

  return false
}
