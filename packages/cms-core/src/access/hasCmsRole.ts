import type { AccessArgs } from 'payload'

import type { User } from '@cms-core/payload-types'

/**
 * Collection-level access for the Payload admin panel: only users who hold a
 * CMS role (`cmsRole` of `admin` or `editor`) may reach `/admin`.
 *
 * Dashboard roles (`role`) are orthogonal — an `applicant` or `staff` without a
 * `cmsRole` is blocked here.
 */
type HasCmsRole = (args: AccessArgs<User>) => boolean

export const hasCmsRole: HasCmsRole = ({ req: { user } }) => {
  return Boolean(user?.cmsRole)
}
