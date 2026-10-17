import type { AccessArgs } from 'payload'

import type { User } from '@cms-core/payload-types'

import { isInternalAdmin } from '@cms-core/access/roles'

/**
 * Collection-level access for the Payload admin panel: only a user holding the
 * `admin` role may reach `/admin`. This replaces the old `cmsRole` test — the
 * CMS axis is now folded into the single multi-valued `role` field.
 */
type HasCmsRole = (args: AccessArgs<User>) => boolean

export const hasCmsRole: HasCmsRole = ({ req: { user } }) => {
  return isInternalAdmin(user)
}