import type { Access, CollectionConfig } from 'payload'

import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { isInternalAdmin, USER_ROLES } from '@cms-core/access/roles'
import { createBackendJwtStrategy } from '@cms-core/auth/backendJwtStrategy'

const isBackendService = (req: { user?: { email?: string | null } | null }): boolean =>
  req.user?.email === 'backend@dacho.local'

/**
 * Only an internal admin may grant or revoke roles. Everyone else — including
 * anonymous self-signup — is forced to the safe default via `defaultValue` +
 * this field-level gate, and the `beforeChange` hook below is defense-in-depth
 * against a Local API write that bypassed field access.
 */
const adminOnly = ({ req }: { req: { user?: { role?: readonly string[] | null } | null } }): boolean =>
  isInternalAdmin(req.user)

const canUpdateUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user) || isBackendService(req)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canReadUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user) || isBackendService(req)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canDeleteUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user) || isBackendService(req)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Only internal admins reach the /admin panel.
    admin: hasCmsRole,
    // Public self-registration. Escalation is prevented by the `adminOnly`
    // field-level access on `role` plus the defaults below.
    create: () => true,
    delete: canDeleteUser,
    read: canReadUser,
    update: canUpdateUser,
  },
  hooks: {
    beforeChange: [
      ({ data, req, context, operation }) => {
        // `loginWithUsername` authenticates against username/email; phone is the
        // application's identifier, so it doubles as the username.
        if (typeof data.phone === 'string' && data.phone.trim() !== '') {
          data.username = data.phone.trim()
        }
        // A self-signup is a company representative and nothing else. Force the
        // role to exactly that, even if the browser already holds an admin
        // session (registration uses its own context for this reason).
        const selfSignup =
          context.forceRepresentativeSignup === true ||
          (operation === 'create' && !isInternalAdmin(req.user) && context.allowRoleAssignment !== true)
        if (selfSignup) {
          data.role = ['representative']
        }
        return data
      },
    ],
  },
  endpoints: [
    {
      path: '/self-signup',
      method: 'post',
      handler: async (req) => {
        const body = (
          typeof req.json === 'function' ? await req.json().catch(() => null) : req.json
        ) as Record<string, unknown> | null
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return Response.json(
            { errors: [{ message: 'Invalid registration data.' }] },
            { status: 400 },
          )
        }

        // Do not forward user-controlled role fields to the create operation.
        const userFields = ['email', 'username', 'password', 'phone', 'name', 'position']
        const userData = Object.fromEntries(
          userFields.filter((field) => field in body).map((field) => [field, body[field]]),
        )

        // 1. The person — the central identity store owns this record.
        const user = await req.payload.create({
          collection: 'users',
          data: userData as never,
          overrideAccess: false,
          req,
          context: { ...req.context, forceRepresentativeSignup: true },
        })

        // 2. The company they represent. The register form still posts the
        // `company`-prefixed field names, so map them onto the company record.
        const company = await req.payload.create({
          collection: 'companies',
          data: {
            name: body.companyName,
            nationalId: body.companyNationalId,
            registrationNumber: body.companyRegistrationNumber,
            type: body.companyType,
            province: body.companyProvince,
            city: body.companyCity,
            representative: user.id,
          } as never,
          // The handler picked these fields explicitly from the request body and
          // role assignment is not among them, so it is safe to create on the
          // signup's behalf even though `companies.create` requires auth.
          overrideAccess: true,
          req,
        })

        return Response.json({ user, company }, { status: 201 })
      },
    },
  ],
  admin: {
    defaultColumns: ['name', 'email', 'phone', 'role'],
    useAsTitle: 'name',
  },
  auth: {
    // Server-to-server access for the backend (Authorization: users API <key>).
    useAPIKey: true,
    // Progressive credentials: phone is the identifier; email/username are
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
    // The single authorization axis. A person may hold several roles at once
    // (e.g. `representative` + `referee`); it defaults to `representative` for
    // self-signup and is only ever changed by an internal admin.
    {
      name: 'role',
      type: 'select',
      hasMany: true,
      options: [...USER_ROLES],
      defaultValue: ['representative'],
      saveToJWT: true,
      admin: {
        position: 'sidebar',
      },
      access: {
        create: adminOnly,
        update: adminOnly,
      },
    },
    // The representative's job title within the company (سمت).
    {
      name: 'position',
      type: 'text',
      label: 'سمت',
    },
  ],
  timestamps: true,
}