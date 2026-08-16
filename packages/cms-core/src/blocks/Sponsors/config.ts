import type { Block } from 'payload'

export const SponsorsBlock: Block = {
  slug: 'sponsors',
  labels: {
    singular: 'Sponsors',
    plural: 'Sponsors',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
    },
    {
      name: 'sponsors',
      type: 'relationship',
      relationTo: 'sponsors',
      hasMany: true,
      label: 'Sponsors',
    },
  ],
}
