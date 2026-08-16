import type { GlobalConfig } from 'payload'

import { authenticated } from '@cms-core/access/authenticated'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  access: {
    read: () => true,
    update: authenticated,
  },
  admin: {
    group: 'Globals',
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      label: 'Site Name',
    },
    {
      name: 'favicon',
      type: 'upload',
      relationTo: 'media',
      label: 'Favicon',
      admin: {
        description: 'Default browser favicon. Per-page favicons take priority when set.',
        position: 'sidebar',
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo',
      admin: {
        description: 'Site logo for header and footer',
      },
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'Social Links',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'platform',
          type: 'text',
          required: true,
          label: 'Platform',
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'URL',
        },
      ],
    },
  ],
}
