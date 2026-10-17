import type { CollectionConfig } from 'payload'

import { anyone } from '@cms-core/access/anyone'
import { adminOnly } from '@cms-core/access/adminOnly'

const sliderImageMimeTypes = ['image/jpeg', 'image/webp']

export const Sliders: CollectionConfig = {
  slug: 'sliders',
  labels: {
    singular: 'Slider',
    plural: 'Sliders',
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Name',
    },
    {
      name: 'images',
      type: 'array',
      required: true,
      minRows: 1,
      labels: {
        singular: 'Image',
        plural: 'Images',
      },
      fields: [
        {
          name: 'landscapeImage',
          type: 'upload',
          relationTo: 'media',
          required: true,
          filterOptions: {
            mimeType: {
              in: sliderImageMimeTypes,
            },
          },
          label: 'Landscape Image',
          admin: {
            description: 'Landscape image for desktop and tablet. Only JPG and WebP are allowed.',
          },
        },
        {
          name: 'mobileImage',
          type: 'upload',
          relationTo: 'media',
          required: true,
          filterOptions: {
            mimeType: {
              in: sliderImageMimeTypes,
            },
          },
          label: 'Mobile Image',
          admin: {
            description: 'Portrait image for mobile screens. Only JPG and WebP are allowed.',
          },
        },
      ],
    },
  ],
}
