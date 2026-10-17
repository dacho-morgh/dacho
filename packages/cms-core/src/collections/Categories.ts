import type { CollectionConfig } from 'payload'

import { anyone } from '@cms-core/access/anyone'
import { hasContentRole } from '@cms-core/access/editorContent'
import { slugField } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    create: hasContentRole,
    delete: hasContentRole,
    read: anyone,
    update: hasContentRole,
  },
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField({
      position: undefined,
    }),
  ],
}
