import type { Access, CollectionConfig, Condition, FieldAccess, Validate } from 'payload'

import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { createBackendJwtStrategy } from '@cms-core/auth/backendJwtStrategy'

// Only an existing CMS admin may assign `role`/`cmsRole`. Everyone else —
// including anonymous self-signup — is forced to the safe defaults via
// `defaultValue` + this field-level gate. This is the privilege-escalation
// guard: a self-registering visitor cannot become `staff` or gain a `cmsRole`.
const adminOnly: FieldAccess = ({ req }) => Boolean(req.user?.cmsRole === 'admin')
const applicantOnly: Condition = (_data, siblingData) => siblingData?.role !== 'staff'
const requiredForApplicant = (label: string): Validate => (value, { siblingData }) => {
  if (siblingData?.role !== 'staff' && (typeof value !== 'string' || value.trim() === '')) {
    return `${label} برای متقاضی الزامی است.`
  }
  return true
}
const isBackendService = (req: { user?: { email?: string | null } | null }): boolean => req.user?.email === 'backend@dacho.local'
const canUpdateUser: Access = ({ req }) => {
  if (req.user?.cmsRole === 'admin' || isBackendService(req)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canReadUser: Access = ({ req }) => {
  if (req.user?.cmsRole === 'admin' || req.user?.cmsRole === 'editor' || isBackendService(req)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}
const canDeleteUser: Access = ({ req }) => {
  if (req.user?.cmsRole === 'admin' || isBackendService(req)) return true
  if (!req.user?.id) return false
  return { id: { equals: req.user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Only CMS staff (admin/editor) reach the /admin panel.
    admin: hasCmsRole,
    // Public self-registration (applicants). Escalation is prevented by the
    // `adminOnly` field-level access + defaults on `role`/`cmsRole` below.
    create: () => true,
    delete: canDeleteUser,
    read: canReadUser,
    update: canUpdateUser,
  },
  hooks: {
    // Defense-in-depth: even if field-level access were bypassed (e.g. a Local
    // API call with `overrideAccess`), a non-admin can never assign a role.
    // Trusted internal writes (seed scripts, service-account bootstrap) opt out
    // via `context.allowRoleAssignment`.
      beforeChange: [
      ({ data, req, context, operation }) => {
        if (operation === 'update' && typeof data.phone === 'string' && data.phone.trim() !== '') {
          data.username = data.phone.trim()
        }
        if (
          operation === 'create' &&
          (context.forceApplicantSignup === true ||
            (req.user?.cmsRole !== 'admin' && context.allowRoleAssignment !== true))
        ) {
          // Payload authenticates `loginWithUsername` against username/email.
          // Applicants use their unique phone as the username so the public
          // login form can truthfully accept either phone or email.
          if (typeof data.phone === 'string') data.username = data.phone.trim()
          data.role = 'applicant'
          data.cmsRole = null
          data.roles = []
        }
        // Profile updates must never silently demote existing operational or CMS users.
        // Role fields remain protected by their field-level access gate.
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
          typeof req.json === 'function' ? await req.json().catch(() => null) : null
        ) as Record<string, unknown> | null
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return Response.json(
            { errors: [{ message: 'Invalid registration data.' }] },
            { status: 400 },
          )
        }

        // Registration uses an explicit context so it always creates an
        // applicant, even when this browser already has a CMS admin session.
        // Do not forward user-controlled role fields to the create operation.
        const registrationFields = [
          'email',
          'username',
          'password',
          'phone',
          'name',
          'position',
          'companyName',
          'companyNationalId',
          'companyRegistrationNumber',
          'companyType',
          'companyProvince',
          'companyCity',
        ]
        const data = Object.fromEntries(
          registrationFields.filter((field) => field in body).map((field) => [field, body[field]]),
        )

        const doc = await req.payload.create({
          collection: 'users',
          data: data as never,
          overrideAccess: false,
          req,
          context: { ...req.context, forceApplicantSignup: true },
        })

        return Response.json({ doc }, { status: 201 })
      },
    },
  ],
  admin: {
    defaultColumns: ['name', 'email', 'phone', 'role', 'cmsRole'],
    useAsTitle: 'name',
  },
  auth: {
    // Server-to-server access for the backend (Authorization: users API <key>).
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
    // Dashboard-side role: applicant (a company applying for services) vs
    // staff (the دبیرخانه / operations team reviewing requests). Not
    // `required` — it defaults to `applicant` and is only ever set by an admin.
    {
      name: 'role',
      type: 'select',
      options: ['applicant', 'staff'],
      defaultValue: 'applicant',
      saveToJWT: true,
      admin: {
        position: 'sidebar',
      },
      access: {
        create: adminOnly,
        update: adminOnly,
      },
    },
    // CMS-side role: null (no CMS access) | editor | admin. Orthogonal to `role`.
    {
      name: 'cmsRole',
      type: 'select',
      options: ['admin', 'editor'],
      saveToJWT: true,
      admin: {
        position: 'sidebar',
      },
      access: {
        create: adminOnly,
        update: adminOnly,
      },
    },
    // Representative's job title within the company (سمت).
    {
      name: 'position',
      type: 'text',
      label: 'سمت',
    },
    // Workflow roles (داور، دبیرخانه، واحد حسابداری، …) — many-to-many with the
    // `roles` collection. Same escalation guard as `role`/`cmsRole`: only an
    // admin may assign them.
    {
      name: 'roles',
      type: 'relationship',
      relationTo: 'roles',
      hasMany: true,
      label: 'Roles',
      admin: {
        position: 'sidebar',
      },
      access: {
        create: adminOnly,
        update: adminOnly,
      },
    },
    // Company data belongs only to applicants. Staff accounts only need their
    // credentials and phone number, while applicants must identify their company.
    {
      name: 'companyName',
      type: 'text',
      label: 'نام شرکت',
      validate: requiredForApplicant('نام شرکت'),
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyNationalId',
      type: 'text',
      label: 'شناسه ملی',
      validate: requiredForApplicant('شناسه ملی'),
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyRegistrationNumber',
      type: 'text',
      label: 'شماره ثبت',
      validate: requiredForApplicant('شماره ثبت'),
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyType',
      type: 'select',
      label: 'نوع شرکت',
      options: ['سهامی خاص', 'سهامی عام', 'مسئولیت محدود', 'دانش‌بنیان', 'استارتاپ', 'سایر'],
      validate: requiredForApplicant('نوع شرکت'),
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyProvince',
      type: 'text',
      label: 'استان',
      validate: requiredForApplicant('استان'),
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyCity',
      type: 'text',
      label: 'شهر',
      validate: requiredForApplicant('شهر'),
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyEstablishmentDate',
      type: 'text',
      label: 'تاریخ تأسیس',
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyStatus',
      type: 'text',
      label: 'وضعیت شرکت',
      admin: { condition: applicantOnly },
    },
    {
      name: 'companyEconomicCode',
      type: 'text',
      label: 'کد اقتصادی',
      admin: { condition: applicantOnly },
    },
    {
      name: 'executives',
      type: 'array',
      label: 'اشخاص شرکت',
      admin: { condition: applicantOnly },
      fields: [
        { name: 'role', type: 'text', required: true, label: 'سمت' },
        { name: 'name', type: 'text', required: true, label: 'نام' },
      ],
    },
    {
      name: 'addresses',
      type: 'array',
      label: 'آدرس‌ها',
      admin: { condition: applicantOnly },
      fields: [
        { name: 'title', type: 'text', required: true, label: 'عنوان' },
        { name: 'province', type: 'text', label: 'استان' },
        { name: 'city', type: 'text', label: 'شهر' },
        { name: 'postalCode', type: 'text', label: 'کد پستی' },
        { name: 'address', type: 'textarea', required: true, label: 'نشانی' },
      ],
    },
  ],
  timestamps: true,
}
