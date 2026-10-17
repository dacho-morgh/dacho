import type { Access, AccessArgs } from 'payload'

import type { User } from '@cms-core/payload-types'

import { isInternalAdmin } from '@cms-core/access/roles'

/**
 * Write access reserved for an `admin`.
 *
 * This is the gate for everything outside an `editor`'s scope — pages, events,
 * exhibitions, services, sponsors, sliders, newsletter subscribers, and the site
 * chrome globals. Those were previously on the bare `authenticated` gate, under
 * which *any* signed-in person could write them, including a self-registered
 * company representative who has no business touching the CMS at all.
 *
 * Read access is a separate question and is usually public: only the writes are
 * restricted.
 */
export const adminOnly: Access = ({ req }: AccessArgs<User>) => isInternalAdmin(req.user)