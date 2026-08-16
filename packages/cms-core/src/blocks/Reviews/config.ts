import type { Block } from 'payload'

export const ReviewsBlock: Block = {
  slug: 'reviews',
  labels: {
    singular: 'Reviews',
    plural: 'Reviews',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
    },
    {
      name: 'reviews',
      type: 'relationship',
      relationTo: 'reviews',
      hasMany: true,
      label: 'Reviews',
    },
  ],
}
