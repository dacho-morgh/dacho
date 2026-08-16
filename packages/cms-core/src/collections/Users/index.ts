import type { CollectionConfig } from 'payload'

import { authenticated } from '@cms-core/access/authenticated'
import { createBackendJwtStrategy } from '@cms-core/auth/backendJwtStrategy'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email', 'phone'],
    useAsTitle: 'name',
  },
  auth: {
    // Server-to-server access for the backend (Authorization: users API-Key <key>).
    useAPIKey: true,
    // Progressive credentials: phone is the OTP identifier; email/username are
    // optional. Editors set email (+password) to log in; app users opt in later.
    loginWithUsername: {
      allowEmailLogin: true,
      requireEmail: false,
      requireUsername: false,
    },
    // Verify backend-issued ES256 JWTs (from the OTP flow) against its JWKS.
    strategies: [createBackendJwtStrategy(process.env.BACKEND_JWKS_URL)],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
}
