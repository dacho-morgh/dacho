import type { CollectionConfig } from 'payload'
import { authenticated } from '@cms-core/access/authenticated'

export const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter-subscribers',
  labels: { singular: 'Newsletter subscriber', plural: 'Newsletter subscribers' },
  admin: { group: 'Mag', useAsTitle: 'email', defaultColumns: ['email', 'createdAt'] },
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    { name: 'source', type: 'text', defaultValue: 'mag', admin: { readOnly: true } },
  ],
}
