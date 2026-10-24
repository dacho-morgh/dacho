import type { AccessArgs } from 'payload'

import type { User } from '@cms-core/payload-types'

import { isContentEditor } from '@cms-core/access/roles'

/** The active owner or an independently authorized editorial account may
 * enter Payload. Editorial permission never grants personnel authority. */
type HasCmsRole = (args: AccessArgs<User>) => boolean

export const hasCmsRole: HasCmsRole = ({ req: { user } }) => {
  return isContentEditor(user)
}