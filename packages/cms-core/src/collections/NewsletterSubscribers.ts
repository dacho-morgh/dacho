import type { CollectionConfig } from 'payload'
import { adminOnly } from '@cms-core/access/adminOnly'

export const NewsletterSubscribers: CollectionConfig = {
  slug: 'newsletter-subscribers',
  labels: { singular: 'Newsletter subscriber', plural: 'Newsletter subscribers' },
  admin: { group: 'Mag', useAsTitle: 'email', defaultColumns: ['email', 'createdAt'] },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    { name: 'source', type: 'text', defaultValue: 'mag', admin: { readOnly: true } },
  ],
}
