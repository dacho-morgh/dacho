import type { Block } from 'payload'

export const EventsBlock: Block = {
  slug: 'events',
  labels: {
    singular: 'Events',
    plural: 'Events',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
    },
    {
      name: 'events',
      type: 'relationship',
      relationTo: 'events',
      hasMany: true,
      label: 'Events',
    },
    {
      name: 'exhibitions',
      type: 'relationship',
      relationTo: 'exhibitions',
      hasMany: true,
      label: 'Exhibitions',
    },
  ],
}
