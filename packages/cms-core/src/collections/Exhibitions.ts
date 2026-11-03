import type { CollectionConfig } from 'payload'
import { anyone } from '@cms-core/access/anyone'
import { adminOrBackendService } from '@cms-core/access/adminOrBackendService'

export const Exhibitions: CollectionConfig = {
  slug: 'exhibitions',
  labels: {
    singular: 'Exhibition',
    plural: 'Exhibitions',
  },
  access: {
    create: adminOrBackendService,
    delete: adminOrBackendService,
    read: anyone,
    update: adminOrBackendService,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'startDate', 'status', 'createdAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title',
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Description',
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Featured Image',
    },
    {
      name: 'location',
      type: 'text',
      required: true,
      label: 'Location',
    },
    {
      name: 'startDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      label: 'Start Date',
    },
    {
      name: 'endDate',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
      label: 'End Date',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'upcoming',
      options: [
        { label: 'Upcoming', value: 'upcoming' },
        { label: 'Ongoing', value: 'ongoing' },
        { label: 'Past', value: 'past' },
      ],
      admin: {
        position: 'sidebar',
      },
      label: 'Status',
    },
  ],
}
