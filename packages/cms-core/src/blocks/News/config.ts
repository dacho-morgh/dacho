import type { Block } from 'payload'

export const NewsBlock: Block = {
  slug: 'news',
  labels: {
    singular: 'News',
    plural: 'News',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 3,
      label: 'Number of items',
      admin: {
        description: 'How many news items to display',
      },
    },
  ],
}
