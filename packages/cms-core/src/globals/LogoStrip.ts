import type { GlobalConfig } from 'payload'

import { authenticated } from '@cms-core/access/authenticated'
import { link } from '@cms-core/fields/link'
import { revalidateLogoStrip } from './hooks/revalidateLogoStrip'

export const LogoStrip: GlobalConfig = {
  slug: 'logo-strip',
  label: 'Logo Strip',
  access: {
    read: () => true,
    update: authenticated,
  },
  admin: {
    group: 'Pages',
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Show logo strip',
      defaultValue: true,
    },
    {
      name: 'logos',
      type: 'array',
      label: 'Logos',
      admin: {
        initCollapsed: true,
        description:
          'Add and reorder SVG logos. All logos use the fixed frontend gray color. Leave empty to use the default partners, or uncheck Show logo strip to hide the section.',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Name',
          admin: { description: 'Accessible label for the logo link.' },
        },
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
          required: true,
          label: 'SVG logo',
          filterOptions: { mimeType: { equals: 'image/svg+xml' } },
          admin: { description: 'SVG only. Uploaded colors are ignored on the frontend.' },
        },
        link({ appearances: false, disableLabel: true }),
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateLogoStrip],
  },
}
