import type { CollectionConfig } from 'payload'

import { anyone } from '@cms-core/access/anyone'
import { authenticated } from '@cms-core/access/authenticated'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  labels: {
    singular: 'Review',
    plural: 'Reviews',
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'priority', 'createdAt'],
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Enforce mutual exclusivity at data level: clear the opposing field
        if (data?.companyName) {
          data.userName = null
        } else if (data?.userName) {
          data.companyName = null
        }
        return data
      },
    ],
    beforeValidate: [
      ({ data }) => {
        if (!data?.companyName && !data?.userName) {
          return 'Either Company Name or User Name must be provided.'
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'companyName',
      type: 'text',
      label: 'Company Name',
      admin: {
        condition: (_data, siblingData) => !siblingData?.userName,
      },
    },
    {
      name: 'userName',
      type: 'text',
      label: 'User Name',
      admin: {
        condition: (_data, siblingData) => !siblingData?.companyName,
      },
    },
    {
      name: 'displayName',
      type: 'text',
      label: 'Display Name',
      admin: {
        readOnly: true,
        hidden: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            return siblingData?.companyName || siblingData?.userName || 'Anonymous'
          },
        ],
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      label: 'Avatar',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'review',
      type: 'richText',
      required: true,
      label: 'Review',
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
