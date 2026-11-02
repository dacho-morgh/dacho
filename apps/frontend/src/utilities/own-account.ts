import type { User } from '@dacho/cms-core'
import type { OwnAccountDto } from '@/utilities/dashboard-api'

/** The editable own-account projection of the session user (T58); never the full CMS record. */
export function ownAccountOf(user: Pick<User, 'id' | 'name' | 'phone' | 'email' | 'updatedAt'>): OwnAccountDto {
  return {
    id: user.id,
    name: user.name ?? '',
    phone: user.phone ?? '',
    // Accounts created by OTP carry a placeholder address nobody can receive mail at.
    email: user.email && !user.email.endsWith('@dacho.local') ? user.email : '',
    updatedAt: user.updatedAt,
  }
}
