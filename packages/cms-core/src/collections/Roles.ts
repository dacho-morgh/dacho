import type { CollectionConfig } from 'payload'

import { anyone } from '@cms-core/access/anyone'
import { authenticated } from '@cms-core/access/authenticated'

// Workflow roles (داور، دبیرخانه، واحد حسابداری، …) — the permission unit the
// workflow engine gates on. Distinct from `users.role` (applicant | staff) and
// `users.cmsRole` (admin | editor). Many-to-many with users.
export const Roles: CollectionConfig = {
  slug: 'roles',
  labels: {
    singular: 'Role',
    plural: 'Roles',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'createdAt'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: 'Name',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
  ],
}
