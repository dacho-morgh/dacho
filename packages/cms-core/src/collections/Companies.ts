import type { Access, CollectionConfig, FieldAccess } from 'payload'

import { adminOnly } from '@cms-core/access/adminOnly'
import {
  isBackendService,
  isCompanyAdministrator,
  isInternalAdmin,
  isActiveAccount,
  hasOperationalRole,
} from '@cms-core/access/roles'
import { companyDirectory } from '@cms-core/endpoints/companyDirectory'

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
 * Owner and Secretariat read the private dossier; a representative reads only
 * their own company. Chiefs, reviewers, employers and the investment reviewer
 * get a separate necessary-profile projection from the backend only when they
 * are assigned to a case; they never gain direct CMS dossier access.
 */
const canReadCompany: Access = ({ req }) => {
  const user = req.user
  if (isBackendService(user) || isCompanyAdministrator(user) || isInternalAdmin(user)) return true
  if (!user || !isActiveAccount(user) || !hasOperationalRole(user, 'representative')) return false
  return { representative: { equals: user.id } }
}

/**
 * Owner edits any company and a representative edits its own. Secretariat is a
 * reviewer, not a company editor. Backend service updates stay scoped by the
 * calling route and its projection.
 */
const canEditCompany: Access = ({ req }) => {
  const user = req.user
  if (isInternalAdmin(user) || isBackendService(user)) return true
  if (!user || !isActiveAccount(user) || !hasOperationalRole(user, 'representative')) return false
  return { representative: { equals: user.id } }
}

// The natural key and representative link cannot be reassigned from a company
// session. Signup sets both through its server-selected transactional write.
const adminOnlyIdentity: FieldAccess = ({ req }) => isInternalAdmin(req.user)

export const Companies: CollectionConfig = {
  slug: 'companies',
  labels: {
    singular: 'Company',
    plural: 'Companies',
  },
  access: {
    read: canReadCompany,
    // An internal admin enrolls a company by hand. Public self-registration
    // creates one through the `/self-signup` endpoint, which sets the
    // `allowCompanySignup` context flag on the transaction it owns.
    create: canCreateCompany,
    delete: adminOnly,
    // An internal admin may edit any company; a company user may edit only the
    // company they represent.
    update: canEditCompany,
  },
  endpoints: [companyDirectory],
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
      access: { update: adminOnlyIdentity },
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
      // A dossier never needs to hydrate the representative's auth record.
      maxDepth: 0,
      label: 'نماینده',
      required: true,
      index: true,
      access: { update: adminOnlyIdentity },
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
    // Stage 2 — company completion and resume. Legal entity type and
    // knowledge-based status are deliberately separate attributes.
    { name: 'legalEntityType', type: 'text', label: 'شخصیت حقوقی' },
    { name: 'knowledgeBasedStatus', type: 'text', label: 'وضعیت دانش‌بنیان' },
    { name: 'classification', type: 'text', label: 'طبقه‌بندی شرکت' },
    { name: 'foundingYear', type: 'text', label: 'سال تأسیس' },
    { name: 'activityDomain', type: 'text', label: 'حوزه فعالیت' },
    { name: 'website', type: 'text', label: 'وب‌سایت' },
    { name: 'centerEstablishment', type: 'text', label: 'استقرار در مرکز تحقیقات یا فناوری' },
    {
      name: 'insuredEmployeeCount',
      type: 'number',
      label: 'تعداد کارکنان بیمه‌شده',
      min: 0,
    },
    {
      name: 'productsServices',
      type: 'array',
      label: 'محصولات و خدمات',
      fields: [{ name: 'title', type: 'text', required: true, label: 'عنوان' }],
    },
    {
      name: 'keyMembers',
      type: 'array',
      label: 'اعضای کلیدی',
      fields: [
        { name: 'name', type: 'text', required: true, label: 'نام' },
        { name: 'role', type: 'text', required: true, label: 'سمت' },
      ],
    },
    {
      name: 'pastProjectsCustomers',
      type: 'array',
      label: 'پروژه‌ها و مشتریان گذشته',
      fields: [
        { name: 'project', type: 'text', required: true, label: 'پروژه' },
        { name: 'customer', type: 'text', label: 'مشتری' },
        { name: 'summary', type: 'textarea', label: 'خلاصه' },
      ],
    },
    {
      name: 'requestedServices',
      type: 'array',
      label: 'خدمات درخواستی',
      fields: [{ name: 'service', type: 'text', required: true, label: 'خدمت' }],
    },
    {
      name: 'certificatesLicenses',
      type: 'array',
      label: 'گواهی‌ها و مجوزها',
      fields: [
        { name: 'title', type: 'text', required: true, label: 'عنوان' },
        { name: 'issuer', type: 'text', label: 'صادرکننده' },
        { name: 'reference', type: 'text', label: 'شماره یا مرجع' },
      ],
    },
    {
      name: 'notAvailable',
      type: 'json',
      label: 'موارد اعلام‌شده به‌عنوان نداشتن یا در دسترس نبودن',
    },
  ],
  timestamps: true,
}
