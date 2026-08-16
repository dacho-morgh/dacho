import type { Block } from 'payload'

export const ServicesBlock: Block = {
  slug: 'services',
  labels: {
    singular: 'Services',
    plural: 'Services',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
    },
    {
      name: 'services',
      type: 'relationship',
      relationTo: 'services',
      hasMany: true,
      label: 'Services',
    },
  ],
}
