import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import {
  compatibilityRoles,
  hasOperationalRole,
  isActiveAccount,
  isBackendService,
  isInternalAdmin,
  OPERATIONAL_ROLE_LABELS,
  OPERATIONAL_ROLES,
  USER_ROLE_LABELS,
  USER_ROLES,
} from '@cms-core/access/roles'
import { createBackendJwtStrategy } from '@cms-core/auth/backendJwtStrategy'
import {
  normalizeDigits,
  normalizeLoginIdentifier,
  runSelfSignup,
} from '@cms-core/auth/self-signup'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import {
  APIError,
  commitTransaction,
  initTransaction,
  type Access,
  type CollectionConfig,
  type FieldAccess,
} from 'payload'

/**
 * The only fields the profile command may echo back. `apiKey`, `enableAPIKey`,
 * `sessions`, `personnelHistory`, `legacyRoles` and password material stay
 * server-side: this handler runs with `overrideAccess`, so field-level read
 * access does not filter its own write result.
 */
const BACKEND_PROFILE_FIELDS = ['id', 'name', 'phone', 'email', 'position', 'updatedAt'] as const

/**
 * A service credential may only correct contact details of an ordinary active
 * representative. Phone and email are authentication recovery identifiers, so
 * owner, staff, editorial, service and inactive identities are refused: a
 * rewritten number would allow OTP login as that account.
 */
const isServiceProfileTarget = (target: unknown): boolean => {
  const account = target as {
    operationalRole?: string | null
    isActive?: boolean | null
    contentEditor?: boolean | null
    backendService?: boolean | null
  } | null
  return (
    isActiveAccount(account) &&
    account?.operationalRole === 'representative' &&
    account.contentEditor !== true &&
    account.backendService !== true
  )
}

const ownerOnlyField: FieldAccess = ({ req }) => isInternalAdmin(req.user)
const canReadUser: Access = ({ req }) => {
  if (
    isInternalAdmin(req.user) ||
    isBackendService(req.user) ||
    hasOperationalRole(req.user, 'central-secretariat')
  )
    return true
  if (!isActiveAccount(req.user) || req.user?.backendService || !req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canUpdateUser: Access = ({ req }) => {
  if (isInternalAdmin(req.user)) return true
  if (!isActiveAccount(req.user) || req.user?.backendService || !req.user?.id) return false
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
    beforeOperation: [
      ({ args, operation }) => {
        // Phone login must accept the digits a Persian/Arabic keyboard emits.
        // Payload lower-cases email/username itself; only the phone form needs
        // canonicalizing, and an email identifier is left untouched.
        if (operation !== 'login') return
        const data = (args as { data?: Record<string, unknown> }).data
        if (data && typeof data.username === 'string' && data.username.trim() !== '')
          data.username = normalizeLoginIdentifier(data.username)
      },
    ],
    beforeLogin: [
      ({ user }) => {
        if (!isActiveAccount(user) || user.backendService)
          throw new APIError('Account is inactive.', 403)
      },
    ],
    beforeChange: [
      ({ data, originalDoc, req, context, operation }) => {
        if (typeof data.phone === 'string' && data.phone.trim() !== '') {
          data.phone = normalizeDigits(data.phone.trim())
          data.username = data.phone
        }
        const provision = !req.user && context.allowPersonnelProvisioning === true
        const owner = isInternalAdmin(req.user)
        const selfSignup =
          context.forceRepresentativeSignup === true ||
          (operation === 'create' && !owner && !provision)
        if (selfSignup) {
          data.operationalRole = 'representative'
          data.isActive = true
          data.contentEditor = false
          data.backendService = false
          data.enableAPIKey = false
          data.apiKey = null
        } else if (!owner && !provision) {
          // Local API callers also obey this boundary even with overrideAccess.
          for (const field of [
            'operationalRole',
            'isActive',
            'contentEditor',
            'backendService',
            'legacyRoles',
          ])
            delete data[field]
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
        if (account.isActive && !account.operationalRole && !account.contentEditor) {
          throw new APIError('حساب فعال باید یک نقش عملیاتی داشته باشد.', 400)
        }

        if (account.backendService && !provision && operation === 'create')
          throw new APIError('Forbidden service provisioning.', 403)
        delete data.personnelHistory
        const keys = ['operationalRole', 'isActive', 'contentEditor', 'backendService'] as const
        if (operation === 'create' || keys.some((key) => originalDoc?.[key] !== account[key])) {
          data.personnelHistory = [
            ...(Array.isArray(originalDoc?.personnelHistory) ? originalDoc.personnelHistory : []),
            {
              actorId: req.user ? String(req.user.id) : null,
              source: provision ? 'operator' : selfSignup ? 'signup' : 'owner',
              timestamp: new Date().toISOString(),
              before: originalDoc
                ? Object.fromEntries(keys.map((key) => [key, originalDoc[key] ?? null]))
                : null,
              after: Object.fromEntries(keys.map((key) => [key, account[key] ?? null])),
            },
          ]
        }
        data.roles = compatibilityRoles(account)
        return data
      },
    ],
    afterRead: [({ doc }) => ({ ...doc, roles: compatibilityRoles(doc) })],
  },
  endpoints: [
    {
      path: '/personnel/:id',
      method: 'patch',
      handler: async (req) => {
        if (!isInternalAdmin(req.user))
          return Response.json({ error: 'forbidden' }, { status: 403 })
        const id = req.routeParams?.id
        const body = await req.json?.().catch(() => null)
        if (
          typeof id !== 'string' ||
          !/^[1-9]\d*$/.test(id) ||
          !Number.isSafeInteger(Number(id)) ||
          Number(id) > 2147483647 ||
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          typeof body.expectedUpdatedAt !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.expectedUpdatedAt) ||
          !Number.isFinite(Date.parse(body.expectedUpdatedAt)) ||
          new Date(body.expectedUpdatedAt).toISOString() !== body.expectedUpdatedAt
        )
          return Response.json({ error: 'invalid_personnel' }, { status: 400 })
        const data: {
          name?: string
          phone?: string
          email?: string | null
          password?: string
          operationalRole?: (typeof OPERATIONAL_ROLES)[number]
          isActive?: boolean
        } = {}
        for (const key of ['name', 'phone', 'email', 'password'] as const) {
          if (!(key in body)) continue
          if (key === 'email' && body[key] === null) data.email = null
          else {
            if (typeof body[key] !== 'string')
              return Response.json({ error: 'invalid_personnel' }, { status: 400 })
            data[key] = body[key]
          }
        }
        if ('operationalRole' in body) {
          if (!OPERATIONAL_ROLES.includes(body.operationalRole))
            return Response.json({ error: 'invalid_personnel' }, { status: 400 })
          data.operationalRole = body.operationalRole
        }
        if ('isActive' in body) {
          if (typeof body.isActive !== 'boolean')
            return Response.json({ error: 'invalid_personnel' }, { status: 400 })
          data.isActive = body.isActive
        }
        await initTransaction(req)
        try {
          const transactionID = await req.transactionID
          // Never fall back to the pool: the row lock and Payload hooks must share a session.
          if (transactionID == null)
            throw new Error('Personnel commands require a database transaction.')
          const db = (req.payload.db as unknown as PostgresAdapter).sessions[transactionID]?.db
          if (!db) throw new Error('Personnel commands require a database transaction.')
          const locked = await db.execute(sql`
            SELECT id, updated_at FROM public.users WHERE id = ${Number(id)} FOR UPDATE
          `)
          const current = locked.rows[0] as { id: number; updated_at: string | Date } | undefined
          if (!current || new Date(current.updated_at).toISOString() !== body.expectedUpdatedAt) {
            await req.payload.db.rollbackTransaction(transactionID)
            delete req.transactionID
            return Response.json(
              { error: current ? 'stale_personnel' : 'not_found' },
              { status: current ? 409 : 404 },
            )
          }
          const updated = await req.payload.update({
            collection: 'users',
            id: Number(id),
            data,
            overrideAccess: false,
            depth: 0,
            req,
          })
          // Payload uses wall time; preserve CAS even within one millisecond or after clock skew.
          const advanced = await db.execute(sql`
            UPDATE public.users
            SET updated_at = GREATEST(updated_at, ${body.expectedUpdatedAt}::timestamptz + interval '1 millisecond')
            WHERE id = ${Number(id)} RETURNING updated_at
          `)
          const timestamp = advanced.rows[0] as { updated_at: string | Date }
          const doc = {
            id: updated.id,
            name: updated.name ?? null,
            phone: updated.phone,
            email: updated.email ?? null,
            operationalRole: updated.operationalRole,
            isActive: updated.isActive,
            updatedAt: new Date(timestamp.updated_at).toISOString(),
          }
          await commitTransaction(req)
          return Response.json({ doc })
        } catch (error) {
          if (req.transactionID != null) {
            await req.payload.db.rollbackTransaction(await req.transactionID)
            delete req.transactionID
          }
          throw error
        }
      },
    },
    {
      path: '/backend-profile/:id',
      method: 'patch',
      handler: async (req) => {
        const service = isBackendService(req.user)
        if (!service && !isInternalAdmin(req.user))
          return Response.json({ error: 'forbidden' }, { status: 403 })
        const body = await req.json?.().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body))
          return Response.json({ error: 'invalid_profile' }, { status: 400 })
        if (service) {
          // Unknown targets and privileged identities are refused identically so
          // the command does not reveal which accounts exist.
          const target = await req.payload
            .findByID({
              collection: 'users',
              id: String(req.routeParams?.id),
              depth: 0,
              overrideAccess: true,
              req,
            })
            .catch(() => null)
          if (!isServiceProfileTarget(target))
            return Response.json({ error: 'forbidden' }, { status: 403 })
        }
        const data: Record<string, string> = {}
        for (const key of ['name', 'phone', 'email', 'position']) {
          if (key in body) {
            if (typeof body[key] !== 'string')
              return Response.json({ error: 'invalid_profile' }, { status: 400 })
            data[key] = body[key]
          }
        }
        const updated = await req.payload.update({
          collection: 'users',
          id: String(req.routeParams?.id),
          data,
          overrideAccess: true,
          req,
        })
        const record: Record<string, unknown> = { ...updated }
        const doc = Object.fromEntries(
          BACKEND_PROFILE_FIELDS.map((field) => [field, record[field] ?? null]),
        )
        return Response.json({ doc })
      },
    },
    {
      path: '/self-signup',
      method: 'post',
      handler: async (req) => {
        const body = typeof req.json === 'function' ? await req.json().catch(() => null) : req.json

        const result = await runSelfSignup(
          body,
          {
            companyNationalIdExists: async (nationalId) => {
              const existing = await req.payload.find({
                collection: 'companies',
                where: { nationalId: { equals: nationalId } },
                limit: 1,
                depth: 0,
                overrideAccess: true,
              })
              return existing.docs.length > 0
            },
            inTransaction: async (run) => {
              // One transaction: the person and the company they represent are
              // created together or not at all. Both writes share `req`, so
              // Payload binds them to the same transaction.
              await initTransaction(req)
              try {
                const value = await run()
                await commitTransaction(req)
                return value
              } catch (error) {
                // Nothing is persisted: the person is not left orphaned.
                if (req.transactionID !== undefined) {
                  await req.payload.db.rollbackTransaction(req.transactionID)
                }
                throw error
              }
            },
            createUser: async (data) =>
              req.payload.create({
                collection: 'users',
                data: data as never,
                overrideAccess: false,
                req,
                context: { ...req.context, forceRepresentativeSignup: true },
              }),
            createCompany: async (data) =>
              req.payload.create({
                collection: 'companies',
                data: data as never,
                // The handler selected every field explicitly and no role is
                // among them; `allowCompanySignup` is what the collection's
                // create access checks, so no access is overridden here.
                req,
                context: { ...req.context, allowCompanySignup: true },
              }),
          },
          (error) => console.error('[users] self-signup failed', error),
        )

        return Response.json(result.body, { status: result.status })
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
    // Payload's base auth fields otherwise expose decrypted API keys on user
    // reads. Service identity reads must never disclose another account's key.
    {
      name: 'apiKey',
      type: 'text',
      access: {
        read: ownerOnlyField,
        create: ownerOnlyField,
        update: ownerOnlyField,
      },
    },
    {
      name: 'enableAPIKey',
      type: 'checkbox',
      access: {
        read: ownerOnlyField,
        create: ownerOnlyField,
        update: ownerOnlyField,
      },
    },
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
      name: 'operationalRole',
      type: 'select',
      label: 'نقش عملیاتی',
      options: OPERATIONAL_ROLES.map((role) => ({
        label: OPERATIONAL_ROLE_LABELS[role],
        value: role,
      })),
      defaultValue: 'representative',
      admin: {
        position: 'sidebar',
        description: 'هر شخص دقیقاً یک نقش عملیاتی دارد.',
      },
      access: { create: ownerOnlyField, update: ownerOnlyField },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      label: 'حساب فعال',
      defaultValue: true,
      admin: { position: 'sidebar' },
      access: { create: ownerOnlyField, update: ownerOnlyField },
    },
    {
      name: 'contentEditor',
      type: 'checkbox',
      label: 'مجوز تحریر محتوا',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'مجوز محتوا مستقل از نقش عملیاتی است.',
      },
      access: { create: ownerOnlyField, update: ownerOnlyField },
    },
    {
      name: 'backendService',
      type: 'checkbox',
      defaultValue: false,
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'legacyRoles',
      type: 'json',
      label: 'نقش‌های پیش از مهاجرت',
      admin: { readOnly: true },
      access: {
        create: () => false,
        update: () => false,
        read: ownerOnlyField,
      },
    },
    {
      name: 'personnelHistory',
      type: 'json',
      label: 'تاریخچه دسترسی',
      admin: { readOnly: true },
      access: {
        create: () => false,
        update: () => false,
        read: ownerOnlyField,
      },
    },
    // Stored compatibility projection for older dashboard queries. It is never
    // an input to authorization, and legacy assignments are retained above.
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: USER_ROLES.map((role) => ({
        label: USER_ROLE_LABELS[role],
        value: role,
      })),
      admin: { hidden: true },
      access: { create: () => false, update: () => false },
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
