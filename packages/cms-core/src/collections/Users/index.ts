import type { CollectionConfig, FieldAccess } from 'payload'

import { authenticated } from '@cms-core/access/authenticated'
import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { createBackendJwtStrategy } from '@cms-core/auth/backendJwtStrategy'

// Only an existing CMS admin may assign `role`/`cmsRole`. Everyone else —
// including anonymous self-signup — is forced to the safe defaults via
// `defaultValue` + this field-level gate. This is the privilege-escalation
// guard: a self-registering visitor cannot become `staff` or gain a `cmsRole`.
const adminOnly: FieldAccess = ({ req }) => Boolean(req.user?.cmsRole === 'admin')

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Only CMS staff (admin/editor) reach the /admin panel.
    admin: hasCmsRole,
    // Public self-registration (applicants). Escalation is prevented by the
    // `adminOnly` field-level access + defaults on `role`/`cmsRole` below.
    create: () => true,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  hooks: {
    // Defense-in-depth: even if field-level access were bypassed (e.g. a Local
    // API call with `overrideAccess`), a non-admin can never assign a role.
    beforeChange: [
      ({ data, req }) => {
        if (req.user?.cmsRole !== 'admin') {
          data.role = 'applicant'
          data.cmsRole = null
        }
        return data
      },
    ],
  },
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
    // Company (applicant) data — flattened onto the user for v1. Non-required
    // at the schema level (staff/editor/admin have no company); the signup form
    // enforces them for applicants.
    {
      name: 'companyName',
      type: 'text',
      label: 'نام شرکت',
    },
    {
      name: 'companyNationalId',
      type: 'text',
      label: 'شناسه ملی',
    },
    {
      name: 'companyRegistrationNumber',
      type: 'text',
      label: 'شماره ثبت',
    },
    {
      name: 'companyType',
      type: 'select',
      label: 'نوع شرکت',
      options: ['سهامی خاص', 'سهامی عام', 'مسئولیت محدود', 'دانش‌بنیان', 'استارتاپ', 'سایر'],
    },
    {
      name: 'companyProvince',
      type: 'text',
      label: 'استان',
    },
    {
      name: 'companyCity',
      type: 'text',
      label: 'شهر',
    },
  ],
  timestamps: true,
}
