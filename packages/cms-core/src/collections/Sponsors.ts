import type { CollectionConfig } from 'payload'

import { anyone } from '@cms-core/access/anyone'
import { authenticated } from '@cms-core/access/authenticated'

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  labels: {
    singular: 'Sponsor',
    plural: 'Sponsors',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'createdAt'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Name',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: true,
      label: 'Logo',
    },
    {
      name: 'link',
      type: 'text',
      label: 'Website URL',
      admin: {
        description: 'Link to the partner or sponsor website',
      },
    },
  ],
}
