import type { AccessArgs } from 'payload'

import type { User } from '@cms-core/payload-types'

import { isContentEditor } from '@cms-core/access/roles'

/**
 * Collection-level access for the Payload admin panel: only a member of the
 * Fund's own team may reach `/admin` — an `admin` (who administers the whole
 * system) or an `editor` («تحریر», who publishes content). Both live on the
 * single `roles` axis; this is what "holds a CMS role" means now that the
 * separate `cmsRole` field is gone.
 */
type HasCmsRole = (args: AccessArgs<User>) => boolean

export const hasCmsRole: HasCmsRole = ({ req: { user } }) => {
  return isContentEditor(user)
}