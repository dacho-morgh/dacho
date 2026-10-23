import {
  commitTransaction,
  initTransaction,
  type Access,
  type CollectionConfig,
  type FieldAccess,
} from 'payload'

import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { isInternalAdmin, USER_ROLE_LABELS, USER_ROLES } from '@cms-core/access/roles'
import { createBackendJwtStrategy } from '@cms-core/auth/backendJwtStrategy'
import {
  isDuplicateNationalId,
  missingCompanyFields,
  missingUserFields,
  pickCompanyFields,
  pickUserFields,
  type SelfSignupBody,
} from '@cms-core/auth/self-signup'

/**
 * Only an internal admin may grant or revoke roles. Everyone else — including
 * anonymous self-signup — is forced to the safe default via `defaultValue` +
 * this field-level gate, and the `beforeChange` hook below is defense-in-depth
 * against a Local API write that bypassed field access.
 *
 * Distinct from the collection-level `access/adminOnly`: Payload types field
 * access and collection access on incompatible argument shapes, so the shared
 * function cannot be reused here.
 */
const adminOnlyField: FieldAccess = ({ req }) => isInternalAdmin(req.user)

const canUpdateUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canReadUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canDeleteUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Only the Fund's own team reaches the /admin panel: `admin` or `editor`.
    admin: hasCmsRole,
    // Public self-registration. Escalation is prevented by the `adminOnly`
    // field-level access on `roles` plus the defaults below.
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
          data.roles = ['representative']
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
        ) as SelfSignupBody | null

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return Response.json(
            { errors: [{ message: 'Invalid registration data.' }] },
            { status: 400 },
          )
        }

        const missing = [...missingUserFields(body), ...missingCompanyFields(body)]
        if (missing.length > 0) {
          return Response.json(
            {
              errors: missing.map((field) => ({
                code: 'missing_field',
                field,
                message: `Missing required field: ${field}`,
              })),
            },
            { status: 400 },
          )
        }

        const nationalId = String(body.companyNationalId).trim()

        // Fail fast before creating anything: a national id already enrolled
        // must not produce a person record we then cannot attach.
        const existing = await req.payload.find({
          collection: 'companies',
          where: { nationalId: { equals: nationalId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.docs.length > 0) {
          return Response.json(
            {
              errors: [
                {
                  code: 'duplicate_national_id',
                  field: 'companyNationalId',
                  message: 'This company is already registered.',
                },
              ],
            },
            { status: 409 },
          )
        }

        // One transaction: the person and the company they represent are created
        // together or not at all. Both writes share `req`, so Payload binds them
        // to the same transaction.
        await initTransaction(req)

        try {
          const user = await req.payload.create({
            collection: 'users',
            data: pickUserFields(body) as never,
            overrideAccess: false,
            req,
            context: { ...req.context, forceRepresentativeSignup: true },
          })

          const company = await req.payload.create({
            collection: 'companies',
            data: pickCompanyFields(body, user.id) as never,
            // The handler selected every field explicitly and no role is among
            // them; `allowCompanySignup` is what the collection's create access
            // checks, so no access is overridden here.
            req,
            context: { ...req.context, allowCompanySignup: true },
          })

          await commitTransaction(req)

          return Response.json({ user, company }, { status: 201 })
        } catch (error) {
          // Nothing is persisted: the person is not left orphaned.
          if (req.transactionID !== undefined) {
            await req.payload.db.rollbackTransaction(req.transactionID)
          }

          if (isDuplicateNationalId(error)) {
            return Response.json(
              {
                errors: [
                  {
                    code: 'duplicate_national_id',
                    field: 'companyNationalId',
                    message: 'This company is already registered.',
                  },
                ],
              },
              { status: 409 },
            )
          }
          console.error('[users] self-signup failed', error)
          const payloadErrors = (error as { errors?: unknown[] })?.errors
          if (Array.isArray(payloadErrors) && payloadErrors.length > 0) {
            return Response.json({ errors: payloadErrors }, { status: 400 })
          }
          return Response.json(
            { errors: [{ message: 'Registration failed. Please try again.' }] },
            { status: 500 },
          )
        }
      },
    },
  ],
  admin: {
    defaultColumns: ['name', 'email', 'phone', 'roles'],
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
    // self-signup and is only ever changed by an internal admin. Plural because
    // it is multi-valued — Payload stores it in the `users_roles` join table.
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: USER_ROLES.map((role) => ({ label: USER_ROLE_LABELS[role], value: role })),
      defaultValue: ['representative'],
      saveToJWT: true,
      admin: {
        position: 'sidebar',
      },
      access: {
        create: adminOnlyField,
        update: adminOnlyField,
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
