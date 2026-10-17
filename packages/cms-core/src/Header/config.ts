import type { GlobalConfig } from 'payload'

import { adminOnly } from '@cms-core/access/adminOnly'
import { link } from '@cms-core/fields/link'
import { revalidateHeader } from './hooks/revalidateHeader'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    // Stated explicitly: Payload's implicit default for a global with no
    // `update` is `Boolean(req.user)`, which let any signed-in user rewrite the
    // site navigation.
    update: adminOnly,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/RowLabel#RowLabel',
        },
      },
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
