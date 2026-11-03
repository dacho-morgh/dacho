import type { Access, AccessArgs } from 'payload'

import type { User } from '@cms-core/payload-types'

import { isBackendService, isInternalAdmin } from '@cms-core/access/roles'

/**
 * Write access for the public pages of events and exhibitions: an `admin`, or the
 * backend's service account (API key only). The System Owner creates and edits
 * these from the dashboard, whose backend writes them through that account
 * together with the operational record (S5, T60). Owner-only access is enforced
 * by the backend route; the service account is never a person.
 */
export const adminOrBackendService: Access = ({ req }: AccessArgs<User>) =>
  isInternalAdmin(req.user) || isBackendService(req.user)
