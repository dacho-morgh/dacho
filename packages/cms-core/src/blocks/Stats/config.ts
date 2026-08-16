import type { Block } from 'payload'

export const StatsBlock: Block = {
  slug: 'stats',
  labels: {
    singular: 'Stats',
    plural: 'Stats',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Heading',
    },
    {
      name: 'stats',
      type: 'array',
      label: 'Stats',
      minRows: 1,
      maxRows: 4,
      fields: [
        {
          name: 'number',
          type: 'number',
          required: true,
          label: 'Number',
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Label',
        },
      ],
    },
  ],
}
