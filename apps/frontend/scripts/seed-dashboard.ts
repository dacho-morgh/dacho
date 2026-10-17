import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'

// Idempotent seed for the applicant dashboard's OPERATIONAL data: the five
// `services` (with `key`/`icon`/`gradient`) that the dashboard quick-access grid
// and the backend service catalog depend on.
//
// `seed-landing.ts` only creates marketing `services` (title/excerpt/tags, no
// `key`), so this is a separate, complementary step. Re-running is safe:
// services are upserted by their unique `key`.

interface ServiceSeed {
  key: 'financing' | 'events' | 'exhibitions' | 'knowledge' | 'commercialization'
  title: string
  icon: 'coins' | 'calendar' | 'store' | 'graduation-cap' | 'trending-up' | 'sparkles'
  tag: string
  gradient: 'blue-cyan' | 'indigo-purple' | 'fuchsia-rose' | 'emerald-teal' | 'amber-orange'
  excerpt: string
  tags: string[]
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
  },
  {
    key: 'events',
    title: 'رویدادها و رقابت‌ها',
    icon: 'calendar',
    tag: 'رویداد / داوری',
    gradient: 'indigo-purple',
    excerpt: 'ثبت‌نام در رویدادهای تخصصی نفت و گاز، ارائه به داوران و جذب حامی',
    tags: ['رویداد', 'داوری'],
  },
  {
    key: 'exhibitions',
    title: 'خدمات نمایشگاهی',
    icon: 'store',
    tag: 'غرفه و سازه',
    gradient: 'fuchsia-rose',
    excerpt: 'رزرو غرفه، طراحی و ساخت سازه، تبلیغات و خدمات پذیرایی در نمایشگاه‌ها',
    tags: ['نمایشگاه', 'غرفه'],
  },
  {
    key: 'knowledge',
    title: 'خدمات دانش‌بنیانی',
    icon: 'graduation-cap',
    tag: 'مشاوره و ارزیابی',
    gradient: 'emerald-teal',
    excerpt: 'ارزیابی پرونده، مشاوره حقوقی، اخذ گرید دانش‌بنیانی و معافیت‌ها',
    tags: ['دانش‌بنیان', 'مشاوره'],
  },
  {
    key: 'commercialization',
    title: 'تجاری‌سازی و ورود به بازار',
    icon: 'trending-up',
    tag: 'بازار هدف',
    gradient: 'amber-orange',
    excerpt: 'هم‌رسانی فناوری با صنایع پتروشیمی عسلویه و انعقاد قراردادهای پایلوت',
    tags: ['تجاری‌سازی', 'بازار'],
  },
]

async function main(): Promise<void> {
  const payload = await getPayload({ config })

  // Upsert the services.
  for (const svc of SERVICES) {
    const data = {
      title: svc.title,
      key: svc.key,
      icon: svc.icon,
      tag: svc.tag,
      gradient: svc.gradient,
      excerpt: svc.excerpt,
      tags: svc.tags.map((tag) => ({ tag })),
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

  console.log('\nDashboard seed complete: 5 services (key/icon wired).')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
