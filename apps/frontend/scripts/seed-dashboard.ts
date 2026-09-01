import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'

// Idempotent seed for the applicant dashboard's OPERATIONAL data: the workflow
// `roles` and the five `services` (with `key`/`icon`/`gradient`/`workflow`) that
// the dashboard quick-access grid and the backend service catalog depend on.
//
// `seed-landing.ts` only creates marketing `services` (title/excerpt/tags, no
// `key`, no `workflow`), so this is a separate, complementary step. Re-running
// is safe: roles are upserted by unique `name`, services by `key`.

interface RoleSeed {
  name: string
  description?: string
}

const ROLES: RoleSeed[] = [
  { name: 'دبیرخانه', description: 'ثبت و بررسی اولیه درخواست‌ها' },
  { name: 'کارشناس فنی', description: 'ارزیابی فنی طرح و مستندات' },
  { name: 'داور تخصصی', description: 'داوری تخصصی طرح‌ها و ایده‌ها' },
  { name: 'واحد حسابداری', description: 'صدور پیش‌فاکتور و پیگیری پرداخت' },
  { name: 'مشاور تخصصی', description: 'منتورینگ و مشاوره تخصصی' },
  { name: 'مدیر ارشد', description: 'تأیید و تصویب نهایی' },
]

interface WorkflowStepSeed {
  title: string
  role: string // role NAME — resolved to the created/found role id below
  order: number
}

interface ServiceSeed {
  key: 'financing' | 'events' | 'exhibitions' | 'knowledge' | 'commercialization'
  title: string
  icon: 'coins' | 'calendar' | 'store' | 'graduation-cap' | 'trending-up' | 'sparkles'
  tag: string
  gradient: 'blue-cyan' | 'indigo-purple' | 'fuchsia-rose' | 'emerald-teal' | 'amber-orange'
  excerpt: string
  tags: string[]
  workflow: WorkflowStepSeed[]
}

const SERVICES: ServiceSeed[] = [
  {
    key: 'financing',
    title: 'تأمین مالی و سرمایه‌گذاری',
    icon: 'coins',
    tag: 'سرمایه‌گذاری',
    gradient: 'blue-cyan',
    excerpt: 'جذب سرمایه، تسهیلات قرض‌الحسنه و صدور انواع ضمانت‌نامه‌های بانکی',
    tags: ['سرمایه‌گذاری', 'تسهیلات'],
    workflow: [
      { title: 'ثبت و بررسی اولیه درخواست', role: 'دبیرخانه', order: 1 },
      { title: 'ارزیابی فنی و مالی طرح', role: 'کارشناس فنی', order: 2 },
      { title: 'تصویب نهایی و ابلاغ', role: 'مدیر ارشد', order: 3 },
    ],
  },
  {
    key: 'events',
    title: 'رویدادها و رقابت‌ها',
    icon: 'calendar',
    tag: 'رویداد / داوری',
    gradient: 'indigo-purple',
    excerpt: 'ثبت‌نام در رویدادهای تخصصی نفت و گاز، ارائه به داوران و جذب حامی',
    tags: ['رویداد', 'داوری'],
    workflow: [
      { title: 'ثبت‌نام و تکمیل مدارک', role: 'دبیرخانه', order: 1 },
      { title: 'داوری تخصصی طرح', role: 'داور تخصصی', order: 2 },
      { title: 'تأیید نهایی دبیرخانه', role: 'مدیر ارشد', order: 3 },
    ],
  },
  {
    key: 'exhibitions',
    title: 'خدمات نمایشگاهی',
    icon: 'store',
    tag: 'غرفه و سازه',
    gradient: 'fuchsia-rose',
    excerpt: 'رزرو غرفه، طراحی و ساخت سازه، تبلیغات و خدمات پذیرایی در نمایشگاه‌ها',
    tags: ['نمایشگاه', 'غرفه'],
    workflow: [
      { title: 'ثبت درخواست غرفه', role: 'دبیرخانه', order: 1 },
      { title: 'صدور پیش‌فاکتور و پرداخت', role: 'واحد حسابداری', order: 2 },
      { title: 'تأیید و تحویل غرفه', role: 'مدیر ارشد', order: 3 },
    ],
  },
  {
    key: 'knowledge',
    title: 'خدمات دانش‌بنیانی',
    icon: 'graduation-cap',
    tag: 'مشاوره و ارزیابی',
    gradient: 'emerald-teal',
    excerpt: 'ارزیابی پرونده، مشاوره حقوقی، اخذ گرید دانش‌بنیانی و معافیت‌ها',
    tags: ['دانش‌بنیان', 'مشاوره'],
    workflow: [
      { title: 'ثبت درخواست ارزیابی', role: 'دبیرخانه', order: 1 },
      { title: 'جلسه منتورینگ و تنظیم اظهارنامه', role: 'مشاور تخصصی', order: 2 },
      { title: 'تأیید نهایی پرونده', role: 'مدیر ارشد', order: 3 },
    ],
  },
  {
    key: 'commercialization',
    title: 'تجاری‌سازی و ورود به بازار',
    icon: 'trending-up',
    tag: 'بازار هدف',
    gradient: 'amber-orange',
    excerpt: 'هم‌رسانی فناوری با صنایع پتروشیمی عسلویه و انعقاد قراردادهای پایلوت',
    tags: ['تجاری‌سازی', 'بازار'],
    workflow: [
      { title: 'ثبت درخواست تجاری‌سازی', role: 'دبیرخانه', order: 1 },
      { title: 'ارزیابی فنی فناوری', role: 'کارشناس فنی', order: 2 },
      { title: 'تصویب قرارداد پایلوت', role: 'مدیر ارشد', order: 3 },
    ],
  },
]

async function main(): Promise<void> {
  const payload = await getPayload({ config })

  // 1. Upsert roles, collecting their numeric ids by name.
  const roleIdByName = new Map<string, number>()
  for (const role of ROLES) {
    const existing = await payload.find({
      collection: 'roles',
      where: { name: { equals: role.name } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      const doc = existing.docs[0]
      roleIdByName.set(role.name, doc.id as number)
      console.log(`• role exists: ${role.name}`)
    } else {
      const created = await payload.create({
        collection: 'roles',
        data: {
          name: role.name,
          ...(role.description ? { description: role.description } : {}),
        },
      })
      roleIdByName.set(role.name, created.id as number)
      console.log(`• role created: ${role.name}`)
    }
  }

  // 2. Upsert services, wiring each workflow step to the role id.
  for (const svc of SERVICES) {
    const data = {
      title: svc.title,
      key: svc.key,
      icon: svc.icon,
      tag: svc.tag,
      gradient: svc.gradient,
      excerpt: svc.excerpt,
      tags: svc.tags.map((tag) => ({ tag })),
      workflow: svc.workflow.map((step) => ({
        title: step.title,
        role: roleIdByName.get(step.role)!,
        order: step.order,
      })),
    }

    const existing = await payload.find({
      collection: 'services',
      where: { key: { equals: svc.key } },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'services',
        id: existing.docs[0].id,
        data,
      })
      console.log(`• service updated: ${svc.key}`)
    } else {
      await payload.create({ collection: 'services', data })
      console.log(`• service created: ${svc.key}`)
    }
  }

  console.log('\nDashboard seed complete: 6 roles, 5 services (key/icon/workflow wired).')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
