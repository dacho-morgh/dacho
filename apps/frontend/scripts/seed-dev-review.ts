import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

/*
 * Local-dev only (#288): the CMS half of the request page's design-review data.
 * It makes sure the dev personnel accounts exist with their operational role
 * (three ordinary reviewers, since a review round needs three besides the
 * employer), that `representative@` has a company with a complete profile and
 * resume, and that the «events» service exists. The cases themselves are made by
 * the backend half, which drives the real API:
 *
 *   pnpm --filter @dacho/frontend seed:dev-review
 *   pnpm --filter @dacho/backend seed:dev-review
 *
 * Idempotent: accounts by email, the company by its representative. An existing
 * account keeps its name, phone and password; only a missing role or a
 * deactivation is corrected. Company fields are filled only where blank, so a
 * second run changes nothing (and does not reopen the company's verification).
 */

const DOMAIN = 'dacho.localhost.test'
const DEV_PASSWORD = process.env.DEV_SEED_PASSWORD ?? 'DevPass!2026'
const DEV_DATABASES = ['dacho-cms', 'dacho_phase0_test']
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

const PEOPLE = [
  {
    email: `central-secretariat@${DOMAIN}`,
    role: 'central-secretariat',
    name: 'دبیرخانه مرکزی',
    phone: '09122880001',
  },
  {
    email: `chief-reviewer@${DOMAIN}`,
    role: 'chief-reviewer',
    name: 'امیر احمدی',
    phone: '09122880002',
  },
  { email: `reviewer@${DOMAIN}`, role: 'reviewer', name: 'داور آزمایشی', phone: '09122880003' },
  { email: `reviewer-2@${DOMAIN}`, role: 'reviewer', name: 'نرگس رضایی', phone: '09122880004' },
  { email: `reviewer-3@${DOMAIN}`, role: 'reviewer', name: 'حمید کریمی', phone: '09122880005' },
  {
    email: `employer-reviewer@${DOMAIN}`,
    role: 'employer-reviewer',
    name: 'کارفرما آزمایشی',
    phone: '09122880006',
  },
  {
    email: `investment-reviewer@${DOMAIN}`,
    role: 'investment-reviewer',
    name: 'کمیته سرمایه‌گذاری',
    phone: '09122880007',
  },
  {
    email: `representative@${DOMAIN}`,
    role: 'representative',
    name: 'نماینده شرکت نمونه',
    phone: '09122880008',
  },
] as const

/** The profile the company needs to pass verification and to fill the resume block. */
const COMPANY_DEFAULTS = {
  name: 'شرکت فناوران انرژی خلیج فارس',
  nationalId: '10100288001',
  registrationNumber: '28801',
  type: 'دانش‌بنیان',
  province: 'بوشهر',
  city: 'عسلویه',
  establishmentDate: '1395/04/12',
  status: 'فعال',
  economicCode: '411128800188',
  activityDomain: 'فناوری نفت و گاز',
  legalEntityType: 'سهامی خاص',
  knowledgeBasedStatus: 'دانش‌بنیان نوپا',
  classification: 'شرکت فناور',
  foundingYear: '1395',
  website: 'https://example.com',
  insuredEmployeeCount: 18,
} as const

const COMPANY_LISTS = {
  productsServices: [{ title: 'سامانه پایش هوشمند خطوط لوله' }, { title: 'خدمات بازرسی فنی' }],
  keyMembers: [
    { name: 'مریم کاظمی', role: 'مدیرعامل' },
    { name: 'علی نوروزی', role: 'مدیر فنی' },
  ],
  pastProjectsCustomers: [
    {
      project: 'پایش خط لوله فاز ۱۲ پارس جنوبی',
      customer: 'شرکت نفت و گاز پارس',
      summary: 'استقرار حسگرها و داشبورد پایش',
    },
  ],
  certificatesLicenses: [{ title: 'گواهی دانش‌بنیان', issuer: 'معاونت علمی ریاست جمهوری' }],
  addresses: [
    {
      title: 'دفتر مرکزی',
      province: 'بوشهر',
      city: 'عسلویه',
      postalCode: '7511800000',
      address: 'عسلویه، شهرک صنعتی، ساختمان نوآوری',
    },
  ],
  executives: [{ position: 'مدیرعامل', name: 'مریم کاظمی' }],
} as const

function assertLocalDev(): void {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Refusing to seed with NODE_ENV=production.')
  const raw = process.env.DATABASE_URL ?? process.env.DATABASE_URI
  if (!raw) throw new Error('DATABASE_URL is not set.')
  const url = new URL(raw)
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!LOOPBACK.has(url.hostname) || !DEV_DATABASES.includes(database)) {
    throw new Error(
      `Refusing to seed ${url.hostname}/${database}: only a loopback database named ${DEV_DATABASES.join(' or ')} is allowed.`,
    )
  }
}

type Payload = Awaited<ReturnType<typeof getPayload>>

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

async function ensurePerson(payload: Payload, person: (typeof PEOPLE)[number]): Promise<number> {
  const context = { allowPersonnelProvisioning: true }
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: person.email } },
    limit: 1,
    depth: 0,
  })
  const existing = found.docs[0] as
    | { id: number; operationalRole?: string | null; isActive?: boolean | null }
    | undefined
  if (existing) {
    if (existing.operationalRole !== person.role || existing.isActive !== true) {
      await payload.update({
        collection: 'users',
        id: existing.id,
        data: { operationalRole: person.role, isActive: true },
        context,
      })
      console.log(`• account corrected: ${person.email}`)
    }
    return existing.id
  }
  const created = await payload.create({
    collection: 'users',
    data: {
      email: person.email,
      name: person.name,
      phone: person.phone,
      password: DEV_PASSWORD,
      operationalRole: person.role,
      isActive: true,
      contentEditor: false,
      backendService: false,
      enableAPIKey: false,
    } as never,
    context,
  })
  console.log(`• account created: ${person.email}`)
  return created.id as number
}

async function main(): Promise<void> {
  assertLocalDev()
  const payload = await getPayload({ config })

  const ids = new Map<string, number>()
  for (const person of PEOPLE) ids.set(person.email, await ensurePerson(payload, person))

  const owners = await payload.find({
    collection: 'users',
    where: { operationalRole: { equals: 'system-owner' } },
    limit: 1,
    depth: 0,
  })
  if (owners.docs.length === 0) {
    console.warn(
      '! No system-owner account: create one with `pnpm create:admin` before the backend seed.',
    )
  }

  const representativeId = ids.get(`representative@${DOMAIN}`)!
  const found = await payload.find({
    collection: 'companies',
    where: { representative: { equals: representativeId } },
    limit: 1,
    depth: 0,
  })
  const company = found.docs[0] as unknown as Record<string, unknown> | undefined
  if (!company) {
    await payload.create({
      collection: 'companies',
      data: { ...COMPANY_DEFAULTS, ...COMPANY_LISTS, representative: representativeId } as never,
      overrideAccess: true,
      context: { allowCompanySignup: true },
    })
    console.log(`• company created: ${COMPANY_DEFAULTS.name}`)
  } else {
    // Only blanks are filled; the identity fields (name, national id) are never changed.
    const patch: Record<string, unknown> = {}
    for (const [field, value] of Object.entries({ ...COMPANY_DEFAULTS, ...COMPANY_LISTS })) {
      if (field === 'name' || field === 'nationalId') continue
      if (isBlank(company[field])) patch[field] = value
    }
    if (Object.keys(patch).length > 0) {
      await payload.update({
        collection: 'companies',
        id: company.id as number,
        data: patch as never,
        overrideAccess: true,
      })
      console.log(`• company completed (${Object.keys(patch).join(', ')}): ${String(company.name)}`)
    } else {
      console.log(`• company complete: ${String(company.name)}`)
    }
  }

  const service = await payload.find({
    collection: 'services',
    where: { key: { equals: 'events' } },
    limit: 1,
    depth: 0,
  })
  if (service.docs.length === 0)
    console.warn(
      '! The «events» service is missing: run `pnpm seed:dashboard` before the backend seed.',
    )

  console.log('\nCMS half done. Next: pnpm --filter @dacho/backend seed:dev-review')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
