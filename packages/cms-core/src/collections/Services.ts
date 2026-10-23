import type { CollectionConfig } from 'payload'
import { revalidatePath } from 'next/cache'

import { anyone } from '@cms-core/access/anyone'
import { adminOnly } from '@cms-core/access/adminOnly'

export const Services: CollectionConfig = {
  slug: 'services',
  orderable: true,
  labels: {
    singular: 'Service',
    plural: 'Services',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'createdAt'],
    description:
      'Drag rows using their handles to set the homepage grid order. Cards flow right to left, then onto the next row. New services appear at the end.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title',
    },
    {
      name: 'key',
      type: 'select',
      label: 'Key',
      admin: {
        description: 'Stable machine key mapping the service to the dashboard quick-access cards',
      },
      options: [
        { label: 'Financing', value: 'financing' },
        { label: 'Events', value: 'events' },
        { label: 'Exhibitions', value: 'exhibitions' },
        { label: 'Knowledge-based', value: 'knowledge' },
        { label: 'Commercialization', value: 'commercialization' },
      ],
    },
    {
      name: 'icon',
      type: 'select',
      label: 'Icon',
      admin: {
        description: 'Icon key the frontend resolves to a lucide icon',
      },
      options: [
        { label: 'Coins', value: 'coins' },
        { label: 'Calendar', value: 'calendar' },
        { label: 'Store', value: 'store' },
        { label: 'Graduation cap', value: 'graduation-cap' },
        { label: 'Trending up', value: 'trending-up' },
        { label: 'Sparkles', value: 'sparkles' },
      ],
    },
    {
      name: 'tag',
      type: 'text',
      label: 'Tag',
      admin: {
        description: 'Short label shown on the quick-access card (e.g. «سرمایه‌گذاری»)',
      },
    },
    {
      name: 'gradient',
      type: 'select',
      label: 'Gradient',
      admin: {
        description: 'Gradient key the frontend resolves to a Tailwind gradient',
      },
      options: [
        { label: 'Blue → Cyan', value: 'blue-cyan' },
        { label: 'Indigo → Purple', value: 'indigo-purple' },
        { label: 'Fuchsia → Rose', value: 'fuchsia-rose' },
        { label: 'Emerald → Teal', value: 'emerald-teal' },
        { label: 'Amber → Orange', value: 'amber-orange' },
      ],
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Excerpt',
      admin: {
        description: 'Description shown on the homepage service card and in listings.',
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Service Illustration (SVG or WebP)',
      filterOptions: { mimeType: { in: ['image/svg+xml', 'image/webp'] } },
      admin: {
        description: 'SVG or WebP illustration shown on the homepage service card.',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Hero Image',
      admin: {
        description: 'Large hero banner shown on the service detail page',
      },
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Description',
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      label: 'Request Form',
      admin: {
        description: 'The form-builder form applicants fill to request this service',
      },
    },
  ],
  hooks: {
    afterChange: [
      ({ doc, req: { context } }) => {
        if (!context.disableRevalidate) revalidatePath('/')
        return doc
      },
    ],
    afterDelete: [
      ({ doc, req: { context } }) => {
        if (!context.disableRevalidate) revalidatePath('/')
        return doc
      },
    ],
  },
}
