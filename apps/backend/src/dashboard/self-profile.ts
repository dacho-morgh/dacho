import type { OperationalRole } from '../access/roles.js'
import type { User } from '../auth/user-store.js'

/** Explicit own-profile projection. Never serialize the CMS/user-store record. */
export function dashboardSelfProfile(user: User, role: OperationalRole) {
  return {
    name: user.name ?? '',
    position: user.position ?? '',
    role,
    contacts: { phone: user.phone ?? '', email: user.email ?? '' },
  }
}
