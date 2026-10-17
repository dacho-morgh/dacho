import type { CollectionConfig } from 'payload'

import { anyone } from '@cms-core/access/anyone'
import { hasContentRole } from '@cms-core/access/editorContent'

export const FAQ: CollectionConfig = {
  slug: 'faq',
  access: {
    create: hasContentRole,
    delete: hasContentRole,
    read: anyone,
    update: hasContentRole,
  },
  labels: {
    singular: 'FAQ',
    plural: 'FAQs',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'priority', 'updatedAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Question',
    },
    {
      name: 'description',
      type: 'richText',
      required: true,
      label: 'Answer',
    },
    {
      name: 'priority',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Lower numbers appear first',
      },
      label: 'Priority',
    },
  ],
}
