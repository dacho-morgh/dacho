import {
  APIError,
  commitTransaction,
  initTransaction,
  type Access,
  type CollectionConfig,
  type FieldAccess,
} from 'payload'

import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { compatibilityRoles, isActiveAccount, isBackendService, isInternalAdmin, OPERATIONAL_ROLE_LABELS, OPERATIONAL_ROLES, USER_ROLE_LABELS, USER_ROLES } from '@cms-core/access/roles'
import { createBackendJwtStrategy } from '@cms-core/auth/backendJwtStrategy'
import {
  isDuplicateNationalId,
  missingCompanyFields,
  missingUserFields,
  pickCompanyFields,
  pickUserFields,
  type SelfSignupBody,
} from '@cms-core/auth/self-signup'

const ownerOnlyField: FieldAccess = ({ req }) => isInternalAdmin(req.user)
const canReadUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user) || isBackendService(req.user)) return true
  if (!isActiveAccount(req.user) || !req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canUpdateUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user)) return true
  if (!isActiveAccount(req.user) || isBackendService(req.user) || !req.user?.id) return false
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
    // Personnel are deactivated so historical attribution remains intact.
    delete: () => false,
    read: canReadUser,
    update: canUpdateUser,
  },
  hooks: {
    beforeLogin: [({ user }) => {
      if (!isActiveAccount(user) || user.backendService) throw new APIError('Account is inactive.', 403)
    }],
    beforeChange: [
      ({ data, originalDoc, req, context, operation }) => {
        if (typeof data.phone === 'string' && data.phone.trim() !== '') data.username = data.phone.trim()
        const provision = !req.user && context.allowPersonnelProvisioning === true
        const owner = isInternalAdmin(req.user)
        const selfSignup = context.forceRepresentativeSignup === true || (operation === 'create' && !owner && !provision)
        if (selfSignup) {
          data.operationalRole = 'representative'
          data.isActive = true
          data.contentEditor = false
          data.backendService = false
        } else if (!owner && !provision) {
          // Local API callers also obey this boundary even with overrideAccess.
          for (const field of ['operationalRole', 'isActive', 'contentEditor', 'backendService', 'legacyRoles']) delete data[field]
        }
        if (owner) {
          delete data.backendService
          delete data.legacyRoles
        }
        if (operation === 'create' || 'operationalRole' in data) {
          if (!OPERATIONAL_ROLES.includes(data.operationalRole)) {
            throw new APIError('هر شخص باید دقیقاً یک نقش عملیاتی داشته باشد.', 400)
          }
        }
        const account = { ...originalDoc, ...data }
        if (account.backendService && !provision && operation === 'create') throw new APIError('Forbidden service provisioning.', 403)
        delete data.personnelHistory
        const keys = ['operationalRole', 'isActive', 'contentEditor', 'backendService'] as const
        if (operation === 'create' || keys.some((key) => originalDoc?.[key] !== account[key])) {
          data.personnelHistory = [...(Array.isArray(originalDoc?.personnelHistory) ? originalDoc.personnelHistory : []), {
            actorId: req.user ? String(req.user.id) : null,
            source: provision ? 'operator' : selfSignup ? 'signup' : 'owner',
            timestamp: new Date().toISOString(),
            before: originalDoc ? Object.fromEntries(keys.map((key) => [key, originalDoc[key] ?? null])) : null,
            after: Object.fromEntries(keys.map((key) => [key, account[key] ?? null])),
          }]
        }
        data.roles = compatibilityRoles(account)
        return data
      },
    ],
    afterRead: [({ doc }) => ({ ...doc, roles: compatibilityRoles(doc) })],
  },
  endpoints: [
    {
      path: '/backend-profile/:id', method: 'patch',
      handler: async (req) => {
        if (!isBackendService(req.user) && !isInternalAdmin(req.user)) return Response.json({ error: 'forbidden' }, { status: 403 })
        const body = await req.json?.().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'invalid_profile' }, { status: 400 })
        const data: Record<string, string> = {}
        for (const key of ['name', 'phone', 'email', 'position']) {
          if (key in body) {
            if (typeof body[key] !== 'string') return Response.json({ error: 'invalid_profile' }, { status: 400 })
            data[key] = body[key]
          }
        }
        const doc = await req.payload.update({ collection: 'users', id: String(req.routeParams?.id), data, overrideAccess: true, req })
        return Response.json({ doc })
      },
    },
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
    defaultColumns: ['name', 'email', 'phone', 'operationalRole', 'isActive'],
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
    {
      name: 'operationalRole', type: 'select', label: 'نقش عملیاتی',
      options: OPERATIONAL_ROLES.map((role) => ({ label: OPERATIONAL_ROLE_LABELS[role], value: role })),
      defaultValue: 'representative',
      admin: { position: 'sidebar', description: 'هر شخص دقیقاً یک نقش عملیاتی دارد.' },
      access: { create: ownerOnlyField, update: ownerOnlyField },
    },
    {
      name: 'isActive', type: 'checkbox', label: 'حساب فعال', defaultValue: true,
      admin: { position: 'sidebar' }, access: { create: ownerOnlyField, update: ownerOnlyField },
    },
    {
      name: 'contentEditor', type: 'checkbox', label: 'مجوز تحریر محتوا', defaultValue: false,
      admin: { position: 'sidebar', description: 'مجوز محتوا مستقل از نقش عملیاتی است.' },
      access: { create: ownerOnlyField, update: ownerOnlyField },
    },
    {
      name: 'backendService', type: 'checkbox', defaultValue: false,
      admin: { hidden: true }, access: { create: () => false, update: () => false },
    },
    {
      name: 'legacyRoles', type: 'json', label: 'نقش‌های پیش از مهاجرت',
      admin: { readOnly: true }, access: { create: () => false, update: () => false, read: ownerOnlyField },
    },
    {
      name: 'personnelHistory', type: 'json', label: 'تاریخچه دسترسی',
      admin: { readOnly: true }, access: { create: () => false, update: () => false, read: ownerOnlyField },
    },
    // Stored compatibility projection for older dashboard queries. It is never
    // an input to authorization, and legacy assignments are retained above.
    {
      name: 'roles', type: 'select', hasMany: true,
      options: USER_ROLES.map((role) => ({ label: USER_ROLE_LABELS[role], value: role })),
      admin: { hidden: true }, access: { create: () => false, update: () => false },
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
