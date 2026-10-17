import type { Access, CollectionConfig } from 'payload'

import { adminOnly } from '@cms-core/access/adminOnly'
import { anyone } from '@cms-core/access/anyone'
import { isInternalAdmin } from '@cms-core/access/roles'

/**
 * A Company (شرکت) — the organization that applies for the Innovation
 * Factory's services. First-class record, keyed by national id.
 *
 * Users stay the single source of truth for *people*: a company holds exactly
 * one `representative` (نماینده) relationship to `users`, and the person
 * carries the `representative` role. The company owns no credentials, no
 * password and no login of its own.
 */
/**
 * An internal admin enrolls any company; public self-signup enrolls one through
 * the `/self-signup` endpoint, which owns a transaction and sets the
 * `allowCompanySignup` context flag. Nothing else may create a company.
 */
const canCreateCompany: Access = ({ req }) => {
  if (isInternalAdmin(req.user)) return true
  return (req.context as { allowCompanySignup?: boolean } | undefined)?.allowCompanySignup === true
}

/**
 * An internal admin edits any company; a company user edits only the company
 * they represent. Runs as a query constraint so Payload applies it to reads and
 * writes alike.
 */
const canEditCompany: Access = ({ req }) => {
  const user = req.user
  if (isInternalAdmin(user)) return true
  if (!user) return false
  // `representative` is the company's link back to the acting person.
  return { representative: { equals: user.id } }
}

export const Companies: CollectionConfig = {
  slug: 'companies',
  labels: {
    singular: 'Company',
    plural: 'Companies',
  },
  access: {
    // Directory is public (the site lists member companies); the record itself
    // is read by anyone so a company's own representative can load it.
    read: anyone,
    // An internal admin enrolls a company by hand. Public self-registration
    // creates one through the `/self-signup` endpoint, which sets the
    // `allowCompanySignup` context flag on the transaction it owns.
    create: canCreateCompany,
    delete: adminOnly,
    // An internal admin may edit any company; a company user may edit only the
    // company they represent.
    update: canEditCompany,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'nationalId', 'type', 'city', 'representative'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'نام شرکت',
      required: true,
      index: true,
    },
    // The company's natural key. Unique, so one company cannot be enrolled twice.
    {
      name: 'nationalId',
      type: 'text',
      label: 'شناسه ملی',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'registrationNumber',
      type: 'text',
      label: 'شماره ثبت',
    },
    {
      name: 'type',
      type: 'select',
      label: 'نوع شرکت',
      options: ['سهامی خاص', 'سهامی عام', 'مسئولیت محدود', 'دانش‌بنیان', 'استارتاپ', 'سایر'],
    },
    {
      name: 'province',
      type: 'text',
      label: 'استان',
    },
    {
      name: 'city',
      type: 'text',
      label: 'شهر',
    },
    {
      name: 'establishmentDate',
      type: 'text',
      label: 'تاریخ تأسیس',
    },
    {
      name: 'status',
      type: 'text',
      label: 'وضعیت شرکت',
    },
    {
      name: 'economicCode',
      type: 'text',
      label: 'کد اقتصادی',
    },
    // The نماینده — the one user who acts for this company. This is the single
    // link between the company record and the central `users` identity store.
    {
      name: 'representative',
      type: 'relationship',
      relationTo: 'users',
      label: 'نماینده',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'executives',
      type: 'array',
      label: 'اشخاص شرکت',
      fields: [
        { name: 'position', type: 'text', required: true, label: 'سمت' },
        { name: 'name', type: 'text', required: true, label: 'نام' },
      ],
    },
    {
      name: 'addresses',
      type: 'array',
      label: 'آدرس‌ها',
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
