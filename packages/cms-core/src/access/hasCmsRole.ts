import type { AccessArgs } from 'payload'

import type { User } from '@cms-core/payload-types'

import { isCmsOperator } from '@cms-core/access/roles'

/** The active owner, Secretariat verifier or an independently authorized
 * editorial account may enter Payload. Editorial permission never grants
 * personnel or workflow authority. */
type HasCmsRole = (args: AccessArgs<User>) => boolean

export const hasCmsRole: HasCmsRole = ({ req: { user } }) => {
  return isCmsOperator(user)
}