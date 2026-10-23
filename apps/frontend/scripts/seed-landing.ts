import 'dotenv/config'

import type { User } from '@dacho/cms-core'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { readOption } from './args.js'

// ---------------------------------------------------------------------------
// Lexical richText helpers (RTL Persian). Payload's richText field stores a
// Lexical JSON tree; these build the minimal valid shape for headings/paragraphs.
// ---------------------------------------------------------------------------
type RBlock = { t: 'h1' | 'h2' | 'h3' | 'p'; x: string }

const tNode = (x: string) => ({
  type: 'text',
  text: x,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const rt = (blocks: RBlock[]): any => ({
  root: {
    type: 'root',
    children: blocks.map(({ t, x }) =>
      t === 'p'
        ? {
            type: 'paragraph',
            children: [tNode(x)],
            direction: 'rtl',
            format: '',
            indent: 0,
            textFormat: 0,
            version: 1,
          }
        : {
            type: 'heading',
            children: [tNode(x)],
            direction: 'rtl',
            format: '',
            indent: 0,
            tag: t,
            version: 1,
          },
    ),
    direction: 'rtl',
    format: '',
    indent: 0,
    version: 1,
  },
})

const customLink = (label: string, url: string, appearance?: 'default' | 'outline') => ({
  link: {
    type: 'custom',
    newTab: false,
    url,
    label,
    ...(appearance ? { appearance } : {}),
  },
})

// Persian dates: "12-15 بهمن 1405" (Jalali) ≈ 2027-02-01 .. 2027-02-04.
const EXHIBITION_START = '2027-02-01T00:00:00.000Z'
const EXHIBITION_END = '2027-02-04T00:00:00.000Z'

// Credentials may be overridden per run:
//   pnpm seed:landing --password='…'
//   ADMIN_PASSWORD='…' pnpm seed:landing
const ADMIN_EMAIL = readOption('email', 'ADMIN_EMAIL', 'sajjaddg@gmail.com')
// The default mirrors the email's local part so the printed credentials below
// are the obvious ones rather than a near-miss like `sajjadg`.
const ADMIN_PASSWORD = readOption('password', 'ADMIN_PASSWORD', 'sajjaddg')
const ADMIN_NAME = readOption('name', 'ADMIN_NAME', 'Sajjad')
const ADMIN_PHONE = readOption('phone', 'ADMIN_PHONE', '09120000000')

async function main(): Promise<void> {
  const payload = await getPayload({ config })
  payload.logger.info('Seeding Sandoq landing page…')

  // Keep the seed repeatable: create the requested admin on the first run and
  // refresh its credentials on subsequent runs without touching other users.
  payload.logger.info('— Seeding admin user…')
  const existingAdmin = await payload.find({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
    limit: 1,
  })
  const adminRoles: { roles: NonNullable<User['roles']> } = { roles: ['admin'] }
  const adminContext = { allowRoleAssignment: true }

  if (existingAdmin.docs[0]) {
    await payload.update({
      collection: 'users',
      id: existingAdmin.docs[0].id,
      data: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: ADMIN_PASSWORD,
        phone: ADMIN_PHONE,
        ...adminRoles,
        // Payload locks an account for a period after repeated failed logins.
        // Seeding is the recovery path for a locked-out operator, so clear it.
        loginAttempts: 0,
        lockUntil: null,
      },
      context: adminContext,
    })
  } else {
    await payload.create({
      collection: 'users',
      data: {
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        password: ADMIN_PASSWORD,
        phone: ADMIN_PHONE,
        ...adminRoles,
      },
      context: adminContext,
    })
  }

  // 1. Clear landing content (keep users/media untouched).
  for (const collection of [
    'categories',
    'services',
    'events',
    'exhibitions',
    'news',
    'reviews',
    'faq',
  ] as const) {
    // `disableRevalidate` keeps collection hooks from calling Next's
    // revalidatePath(): this script runs outside a request scope, where that
    // throws instead of busting a cache.
    await payload.delete({ collection, where: {}, context: { disableRevalidate: true } })
    payload.logger.info(`— Cleared ${collection}`)
  }

  // 2. Categories
  payload.logger.info('— Seeding categories…')
  const catNews = await payload.create({ collection: 'categories', data: { title: 'اخبار', slug: 'news' } })
  await payload.create({ collection: 'categories', data: { title: 'رویدادها', slug: 'events' } })

  // 3. Services
  payload.logger.info('— Seeding services…')
  const svcFinancing = await payload.create({
    collection: 'services',
    context: { disableRevalidate: true },
    data: {
      title: 'خدمات تامین مالی',
      excerpt: 'ارائه انواع تسهیلات مالی، صدور ضمانت‌نامه‌های بانکی و سرمایه‌گذاری برای شرکت‌ها و فناوران.',
      tags: [{ tag: 'تامین مالی' }, { tag: 'ضمانت‌نامه' }],
    },
  })
  const svcKnowledge = await payload.create({
    collection: 'services',
    context: { disableRevalidate: true },
    data: {
      title: 'خدمات دانش بنیان',
      excerpt: 'حمایت از شرکت‌های دانش‌بنیان و استارتاپ‌های فناور در مسیر رشد، توسعه و ورود به بازار.',
      tags: [{ tag: 'دانش بنیان' }, { tag: 'استارتاپ' }],
    },
  })
  const svcCommercial = await payload.create({
    collection: 'services',
    context: { disableRevalidate: true },
    data: {
      title: 'خدمات تجاری‌سازی و ورود به صنعت و بازار',
      excerpt: 'تسهیل مسیر تجاری‌سازی، توسعه بازار و ایجاد ارتباط با صنعت. از اعتبارسنجی ایده تا توسعه بازار و جذب شرکای صنعتی.',
      tags: [{ tag: 'تجاری‌سازی' }, { tag: 'بازار' }],
    },
  })
  const svcGuarantee = await payload.create({
    collection: 'services',
    context: { disableRevalidate: true },
    data: {
      title: 'صدور ضمانت‌نامه',
      excerpt: 'صدور انواع ضمانت‌نامه برای حضور مطمئن شرکت‌های فناور در قراردادها و مناقصه‌ها.',
      tags: [{ tag: 'ضمانت‌نامه' }, { tag: 'اعتبار' }],
    },
  })
  const svcInvestment = await payload.create({
    collection: 'services',
    context: { disableRevalidate: true },
    data: {
      title: 'سرمایه‌گذاری خطرپذیر',
      excerpt: 'مشارکت در طرح‌های نوآورانه و همراهی با تیم‌ها از مرحله نمونه اولیه تا توسعه بازار.',
      tags: [{ tag: 'سرمایه‌گذاری' }, { tag: 'نوآوری' }],
    },
  })
  await payload.create({
    collection: 'services',
    context: { disableRevalidate: true },
    data: {
      title: 'مشاوره توسعه کسب‌وکار',
      excerpt: 'ارائه مشاوره تخصصی در زمینه مدل کسب‌وکار، فروش، بازاریابی و جذب سرمایه.',
      tags: [{ tag: 'مشاوره' }, { tag: 'رشد' }],
    },
  })

  // 4. Events
  payload.logger.info('— Seeding events…')
  const eventInnovation = await payload.create({
    collection: 'events',
    data: {
      title: 'رویداد نوآوری در صنعت انرژی',
      description: rt([{ t: 'p', x: 'گردهمایی شرکت‌های فناور، سرمایه‌گذاران و مدیران صنعت انرژی برای معرفی راهکارهای نوآورانه.' }]),
      location: 'بوشهر، کارخانه نوآوری صنایع انرژی',
      startDate: '2026-10-14T05:30:00.000Z',
      endDate: '2026-10-15T13:30:00.000Z',
      status: 'upcoming',
    },
  })
  const eventPitch = await payload.create({
    collection: 'events',
    data: {
      title: 'نشست ارائه استارتاپ‌های حوزه نفت و گاز',
      description: rt([{ t: 'p', x: 'فرصتی برای ارائه استارتاپ‌ها، دریافت بازخورد تخصصی و ارتباط مستقیم با سرمایه‌گذاران.' }]),
      location: 'عسلویه، مرکز همایش‌های پارس',
      startDate: '2026-11-18T06:30:00.000Z',
      endDate: '2026-11-18T14:30:00.000Z',
      status: 'upcoming',
    },
  })
  const eventWorkshop = await payload.create({
    collection: 'events',
    data: {
      title: 'کارگاه تامین مالی شرکت‌های دانش‌بنیان',
      description: rt([{ t: 'p', x: 'آشنایی عملی با تسهیلات، ضمانت‌نامه‌ها و مسیر آماده‌سازی مدارک برای دریافت حمایت مالی.' }]),
      location: 'بوشهر، سالن آموزش صندوق پژوهش و فناوری',
      startDate: '2026-12-09T05:30:00.000Z',
      endDate: '2026-12-09T11:30:00.000Z',
      status: 'upcoming',
    },
  })

  // 5. Exhibitions
  payload.logger.info('— Seeding exhibitions…')
  const exhibition = await payload.create({
    collection: 'exhibitions',
    data: {
      title: 'نمایشگاه بین‌المللی نفت، گاز، پالایش و پتروشیمی پارس جنوبی (عسلویه)',
      description: rt([
        {
          t: 'p',
          x: 'به‌عنوان بزرگ‌ترین رویداد صنعتی و تجاری منطقه در حوزه انرژی، هر ساله با حضور بیش از ۲۰۰ شرکت توانمند داخلی و خارجی برگزار می‌شود. این نمایشگاه، بستری مؤثر برای معرفی توانمندی‌ها، نوآوری‌ها و آخرین دستاوردهای صنعت نفت، گاز، پالایش و پتروشیمی فراهم می‌کند.',
        },
      ]),
      location: 'عسلویه، بلوار سیراف، محل دائمی برگزاری همایش‌ها و نمایش‌های بین‌المللی',
      startDate: EXHIBITION_START,
      endDate: EXHIBITION_END,
      status: 'upcoming',
    },
  })
  const exhibitionTechnology = await payload.create({
    collection: 'exhibitions',
    data: {
      title: 'نمایشگاه دستاوردهای پژوهش، فناوری و فن‌بازار بوشهر',
      description: rt([{ t: 'p', x: 'نمایش تازه‌ترین محصولات و توانمندی‌های شرکت‌های دانش‌بنیان، فناوران و مراکز پژوهشی استان بوشهر.' }]),
      location: 'بوشهر، محل دائمی نمایشگاه‌های بین‌المللی',
      startDate: '2027-03-02T05:30:00.000Z',
      endDate: '2027-03-05T14:30:00.000Z',
      status: 'upcoming',
    },
  })

  // 5. News
  payload.logger.info('— Seeding news…')
  await payload.create({
    collection: 'news',
    context: { disableRevalidate: true },
    data: {
      title: 'انتقال واحد اعتبارات صندوق پژوهش و فناوری استان بوشهر به محل جدید',
      slug: 'انتقال-واحد-اعتبارات-صندوق-پژوهش-و-فناوری-استان-بوشهر-به-محل-جدید',
      _status: 'published',
      pinned: true,
      publishedAt: new Date().toISOString(),
      categories: [catNews.id],
      excerpt: 'انتقال واحد اعتبارات صندوق با هدف بهبود فرآیندهای مالی و اعتباری و ارتقای کیفیت خدمات‌رسانی انجام شد.',
      content: rt([
        {
          t: 'p',
          x: 'واحد اعتبارات صندوق پژوهش و فناوری استان بوشهر با هدف بهبود فرآیندهای مالی و اعتباری و ارتقای کیفیت خدمات‌رسانی به جامعه پژوهش و فناوری، به محل جدید خود منتقل شد.',
        },
        {
          t: 'p',
          x: 'این جابه‌جایی در راستای افزایش بهره‌وری، تسهیل دسترسی پژوهشگران، فناوران و شرکت‌های دانش‌بنیان به خدمات مالی و اعتباری و ایجاد فضای مناسب‌تر برای ارائه خدمات تخصصی انجام شده و گامی در مسیر نوسازی ساختار سازمانی صندوق به شمار می‌رود.',
        },
        {
          t: 'p',
          x: 'با استقرار واحد اعتبارات در محل جدید، زمینه ارائه خدمات سریع‌تر، دقیق‌تر و شفاف‌تر در حوزه بررسی درخواست‌ها، صدور انواع ضمانت‌نامه و تخصیص اعتبارات فراهم شده است. همچنین بهره‌گیری از زیرساخت‌های مناسب‌تر و سامانه‌های هوشمند، نقش مؤثری در تسریع و بهبود فرآیندهای کاری این واحد ایفا می‌کند.',
        },
        {
          t: 'p',
          x: 'صندوق پژوهش و فناوری استان بوشهر از پژوهشگران، فناوران و شرکت‌های دانش‌بنیان دعوت می‌کند با مراجعه به محل جدید واحد اعتبارات، از خدمات مالی و اعتباری این صندوق با سهولت و کیفیت بالاتر بهره‌مند شوند.',
        },
      ]),
      tags: [{ tag: 'صندوق' }, { tag: 'اعتبارات' }],
    },
  })

  await payload.create({
    collection: 'news',
    context: { disableRevalidate: true },
    data: {
      title: 'حمایت از شرکت‌های دانش‌بنیان در مسیر تجاری‌سازی',
      slug: 'حمایت-از-شرکتهای-دانشبنیان-در-مسیر-تجاریسازی',
      _status: 'published',
      pinned: false,
      publishedAt: new Date().toISOString(),
      categories: [catNews.id],
      excerpt: 'از اعتبارسنجی ایده تا توسعه بازار و جذب شرکای صنعتی.',
      content: rt([
        {
          t: 'p',
          x: 'صندوق پژوهش و فناوری استان بوشهر با ارائه خدمات تخصصی، مسیر تجاری‌سازی ایده‌های فناورانه را تسهیل می‌کند و ارتباط شرکت‌های دانش‌بنیان را با شرکای صنعتی و بازار برقرار می‌سازد.',
        },
      ]),
      tags: [{ tag: 'دانش بنیان' }],
    },
  })

  await payload.create({
    collection: 'news',
    context: { disableRevalidate: true },
    data: {
      title: 'آغاز ثبت‌نام رویداد نوآوری در صنعت انرژی',
      slug: 'آغاز-ثبتنام-رویداد-نوآوری-در-صنعت-انرژی',
      _status: 'published',
      pinned: false,
      publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
      categories: [catNews.id],
      excerpt: 'ثبت‌نام شرکت‌های فناور، استارتاپ‌ها و صاحبان ایده برای حضور در رویداد نوآوری صنعت انرژی آغاز شد.',
      content: rt([
        {
          t: 'p',
          x: 'رویداد نوآوری در صنعت انرژی با هدف شناسایی راهکارهای فناورانه و ایجاد ارتباط میان شرکت‌های نوپا، سرمایه‌گذاران و صنایع بزرگ برگزار می‌شود.',
        },
        {
          t: 'p',
          x: 'متقاضیان می‌توانند طرح‌ها و محصولات خود را برای ارزیابی اولیه ارسال کنند و تیم‌های منتخب فرصت ارائه مستقیم به مدیران صنعت را خواهند داشت.',
        },
      ]),
      tags: [{ tag: 'رویداد' }, { tag: 'انرژی' }],
    },
  })

  await payload.create({
    collection: 'news',
    context: { disableRevalidate: true },
    data: {
      title: 'فراخوان پذیرش طرح‌های سرمایه‌گذاری فناورانه',
      slug: 'فراخوان-پذیرش-طرحهای-سرمایهگذاری-فناورانه',
      _status: 'published',
      pinned: false,
      publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      categories: [catNews.id],
      excerpt: 'صندوق پژوهش و فناوری استان بوشهر از شرکت‌ها و تیم‌های فناور برای ارائه طرح‌های سرمایه‌گذاری دعوت کرد.',
      content: rt([
        {
          t: 'p',
          x: 'این فراخوان با تمرکز بر فناوری‌های صنعت انرژی، اقتصاد دریا، هوشمندسازی و توسعه پایدار منتشر شده است.',
        },
        {
          t: 'p',
          x: 'طرح‌های منتخب پس از ارزیابی فنی و اقتصادی، از خدمات سرمایه‌گذاری، مشاوره کسب‌وکار و شبکه‌سازی صنعتی بهره‌مند خواهند شد.',
        },
      ]),
      tags: [{ tag: 'سرمایه‌گذاری' }, { tag: 'فراخوان' }],
    },
  })

  await payload.create({
    collection: 'news',
    context: { disableRevalidate: true },
    data: {
      title: 'امضای تفاهم‌نامه حمایت از زیست‌بوم فناوری بوشهر',
      slug: 'امضای-تفاهمنامه-حمایت-از-زیستبوم-فناوری-بوشهر',
      _status: 'published',
      pinned: false,
      publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      categories: [catNews.id],
      excerpt: 'تفاهم‌نامه‌ای برای توسعه همکاری‌های مالی و صنعتی و حمایت از شرکت‌های فناور استان بوشهر امضا شد.',
      content: rt([
        {
          t: 'p',
          x: 'این تفاهم‌نامه زمینه استفاده مشترک از ظرفیت‌های مالی، آموزشی و شبکه ارتباطی طرفین را برای حمایت مؤثرتر از کسب‌وکارهای فناور فراهم می‌کند.',
        },
        {
          t: 'p',
          x: 'تسهیل ورود محصولات دانش‌بنیان به بازار و تعریف پروژه‌های مشترک با صنایع استان از مهم‌ترین محورهای این همکاری است.',
        },
      ]),
      tags: [{ tag: 'تفاهم‌نامه' }, { tag: 'فناوری' }],
    },
  })

  await payload.create({
    collection: 'news',
    context: { disableRevalidate: true },
    data: {
      title: 'برگزاری کارگاه تخصصی صدور ضمانت‌نامه برای شرکت‌ها',
      slug: 'برگزاری-کارگاه-تخصصی-صدور-ضمانتنامه-برای-شرکتها',
      _status: 'published',
      pinned: false,
      publishedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
      categories: [catNews.id],
      excerpt: 'مدیران شرکت‌های فناور در کارگاهی تخصصی با انواع ضمانت‌نامه و مراحل دریافت آن آشنا شدند.',
      content: rt([
        {
          t: 'p',
          x: 'در این کارگاه، شرایط دریافت ضمانت‌نامه‌های شرکت در مناقصه، حسن انجام تعهدات و پیش‌پرداخت به‌صورت کاربردی تشریح شد.',
        },
        {
          t: 'p',
          x: 'کارشناسان صندوق همچنین به پرسش‌های شرکت‌کنندگان درباره مدارک مورد نیاز، فرآیند اعتبارسنجی و زمان‌بندی صدور پاسخ دادند.',
        },
      ]),
      tags: [{ tag: 'ضمانت‌نامه' }, { tag: 'آموزش' }],
    },
  })

  // 7. Reviews
  payload.logger.info('— Seeding reviews…')
  const review = await payload.create({
    collection: 'reviews',
    data: {
      companyName: 'شرکت فناور پارس جنوبی',
      review: rt([
        { t: 'p', x: 'صندوق پژوهش و فناوری انواع خدمات مرتبط با صدور ضمانت‌نامه‌های بانکی را ارائه می‌دهد.' },
      ]),
      priority: 0,
    },
  })
  const review2 = await payload.create({
    collection: 'reviews',
    data: {
      userName: 'علی رضایی',
      review: rt([{ t: 'p', x: 'فرآیند بررسی درخواست ما شفاف بود و تیم صندوق در تمام مراحل پاسخ‌گویی دقیقی داشت.' }]),
      priority: 1,
    },
  })
  const review3 = await payload.create({
    collection: 'reviews',
    data: {
      companyName: 'شرکت دانش‌بنیان خلیج فارس',
      review: rt([{ t: 'p', x: 'با حمایت صندوق توانستیم نمونه صنعتی محصول را تکمیل کنیم و وارد مذاکره با مشتریان بزرگ شویم.' }]),
      priority: 2,
    },
  })
  const review4 = await payload.create({
    collection: 'reviews',
    data: {
      userName: 'مریم احمدی',
      review: rt([{ t: 'p', x: 'کارگاه‌های آموزشی صندوق کاربردی و متناسب با چالش‌های واقعی شرکت‌های نوپا برگزار می‌شوند.' }]),
      priority: 3,
    },
  })
  const review5 = await payload.create({
    collection: 'reviews',
    data: {
      companyName: 'پژوهشگران انرژی ساحل',
      review: rt([{ t: 'p', x: 'صدور ضمانت‌نامه باعث شد با اطمینان بیشتری در مناقصه صنعتی شرکت کنیم.' }]),
      priority: 4,
    },
  })

  // 7. FAQ
  payload.logger.info('— Seeding FAQ…')
  const faq1 = await payload.create({
    collection: 'faq',
    data: {
      title: 'صندوق پژوهش و فناوری چه خدماتی ارائه می‌دهد؟',
      description: rt([{ t: 'p', x: 'صندوق خدمات تامین مالی، صدور ضمانت‌نامه‌های بانکی، حمایت از شرکت‌های دانش‌بنیان و تسهیل تجاری‌سازی و ورود به صنعت و بازار را ارائه می‌دهد.' }]),
      priority: 0,
    },
  })
  const faq2 = await payload.create({
    collection: 'faq',
    data: {
      title: 'چگونه می‌توانم در رویدادها و نمایشگاه‌ها شرکت کنم؟',
      description: rt([{ t: 'p', x: 'با ثبت‌نام از طریق بخش رویدادها و نمایشگاه‌های سایت، می‌توانید در رویدادهای تخصصی صندوق حضور یابید.' }]),
      priority: 1,
    },
  })
  const faq3 = await payload.create({
    collection: 'faq',
    data: {
      title: 'فرآیند دریافت تسهیلات مالی چگونه است؟',
      description: rt([{ t: 'p', x: 'پس از ارسال درخواست و بررسی مدارک، واحد اعتبارات صندوق درخواست شما را ارزیابی و در صورت تایید، تسهیلات را تخصیص می‌دهد.' }]),
      priority: 2,
    },
  })
  const faq4 = await payload.create({
    collection: 'faq',
    data: {
      title: 'شرایط همکاری با صندوق برای شرکت‌های دانش‌بنیان چیست؟',
      description: rt([{ t: 'p', x: 'شرکت‌های دانش‌بنیان دارای مجوز معتبر می‌توانند از خدمات مالی، اعتباری و تجاری‌سازی صندوق بهره‌مند شوند.' }]),
      priority: 3,
    },
  })

  // 8. Home page (upsert by slug)
  payload.logger.info('— Seeding home page…')
  const homeLayout: any[] = [
    {
      blockType: 'stats',
      heading: 'صندوق در یک نگاه',
      stats: [
        { number: 200, label: 'شرکت توانمند همکار' },
        { number: 10, label: 'سال تجربه' },
        { number: 600, label: 'میلیون ریال تسهیلات' },
      ],
    },
    {
      blockType: 'services',
      heading: 'ارائه خدمات',
      services: [svcFinancing.id, svcKnowledge.id, svcCommercial.id, svcGuarantee.id, svcInvestment.id],
    },
    {
      blockType: 'events',
      heading: 'نمایشگاه و رویدادها',
      events: [eventInnovation.id, eventPitch.id, eventWorkshop.id],
      exhibitions: [exhibition.id, exhibitionTechnology.id],
    },
    {
      blockType: 'cta',
      richText: rt([
        { t: 'h2', x: 'مشتاق همکاری با شما هستیم' },
        { t: 'p', x: 'در صورت تمایل به همکاری با کارخانه نوآوری صنایع انرژی بوشهر، رزومه خود را برای ما بفرستید.' },
      ]),
      links: [customLink('ارسال رزومه', '/contact', 'default')],
    },
    {
      blockType: 'content',
      columns: [
        {
          size: 'full',
          richText: rt([
            { t: 'h2', x: 'درباره شرکت کارآفرینی صندوق' },
            { t: 'p', x: 'صندوق پژوهش و فناوری انواع خدمات مرتبط با صدور ضمانت‌نامه‌های بانکی را ارائه می‌دهد.' },
          ]),
        },
      ],
    },
    {
      blockType: 'news',
      heading: 'اخبار',
      limit: 3,
    },
    {
      blockType: 'reviews',
      heading: 'نظرات',
      reviews: [review.id, review2.id, review3.id, review4.id, review5.id],
    },
    {
      blockType: 'faq',
      heading: 'سوالات پرتکرار',
      faqs: [faq1.id, faq2.id, faq3.id, faq4.id],
    },
  ]

  const homeData: any = {
    title: 'خانه',
    slug: 'home',
    _status: 'published',
    hero: {
      type: 'lowImpact',
      richText: rt([
        { t: 'h1', x: 'مسیر رشد کسب‌وکارها، از فرصت تا موفقیت' },
        { t: 'p', x: 'فرصت‌های سرمایه‌گذاری، همکاری و حضور در رویدادهای تخصصی را کشف کنید و مسیر رشد کسب‌وکارتان را هموارتر کنید.' },
      ]),
      links: [customLink('مشاهده فرصت‌ها', '/#events', 'default'), customLink('ثبت‌نام شرکت', '/contact', 'outline')],
    },
    layout: homeLayout,
  }

  const existingHome = await payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, limit: 1 })
  const ctx = { disableRevalidate: true }
  if (existingHome.docs.length > 0) {
    await payload.update({ collection: 'pages', id: existingHome.docs[0]!.id, data: homeData, context: ctx })
    payload.logger.info('— Updated existing home page')
  } else {
    await payload.create({ collection: 'pages', data: homeData, context: ctx })
    payload.logger.info('— Created home page')
  }

  // 9. Globals
  payload.logger.info('— Seeding globals…')
  await payload.updateGlobal({ slug: 'site-settings', data: { siteName: 'کارخانه نوآوری صنایع انرژی بوشهر' } })

  const navItems: any[] = [
    customLink('خانه', '/'),
    customLink('رویدادها', '/#events'),
    customLink('مجله', '/mag'),
    customLink('درباره ما', '/#about'),
    customLink('تماس با ما', '/#contact'),
  ]
  await payload.updateGlobal({ slug: 'header', data: { navItems }, context: { disableRevalidate: true } })
  await payload.updateGlobal({
    slug: 'footer',
    data: {
      description:
        'مکان محصول فلسفه توانبخشی ستون نامفهوم محیط هدف داده مجله توسعه برنامه‌نویسی یکپارچگی طبیعت روانشناسی',
      address: 'بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو...',
      phone: '077 - 1234 56 78  , 077 - 1234 78 98',
      copyright: '© تمامی حقوق این سایت مربوط به کارخانه نوآوری صنایع انرژی بوشهر می‌باشد.',
      columns: [
        {
          title: 'صفحات',
          navItems,
        },
        {
          title: 'خدمات',
          navItems: [
            customLink('خدمات تامین مالی', '/'),
            customLink('خدمات دانش بنیان', '/'),
            customLink('خدمات تجاری سازی و ورود به صنعت و بازار', '/'),
          ],
        },
      ],
      socialLinks: [
        { platform: 'شبکه اجتماعی ۱', url: '/' },
        { platform: 'شبکه اجتماعی ۲', url: '/' },
        { platform: 'شبکه اجتماعی ۳', url: '/' },
      ],
      navItems: [...navItems, customLink('خدمات', '/#services')],
    },
    context: { disableRevalidate: true },
  })
  await payload.updateGlobal({
    slug: 'contact-us',
    data: {
      heading: 'تماس با ما',
      subtext: 'در صورت تمایل به همکاری با کارخانه نوآوری صنایع انرژی بوشهر با ما در ارتباط باشید.',
      phone: '077 - 1234 56 78',
      email: 'info@sandoq.ir',
      address: rt([{ t: 'p', x: 'بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو' }]),
    },
  })

  payload.logger.info('Seeded Sandoq landing page successfully!')
  console.log(`\nDone. Created: admin, 2 categories, 6 services, 3 events, 2 exhibitions, 6 news, 5 reviews, 4 FAQs + home page & globals.`)
  console.log(`Admin: http://localhost:3000/admin`)
  console.log(`Email: ${ADMIN_EMAIL}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
