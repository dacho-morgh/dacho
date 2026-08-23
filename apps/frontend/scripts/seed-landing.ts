import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'

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

async function main(): Promise<void> {
  const payload = await getPayload({ config })
  payload.logger.info('Seeding Sandoq landing page…')

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
    await payload.delete({ collection, where: {} })
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
    data: {
      title: 'خدمات تامین مالی',
      excerpt: 'ارائه انواع تسهیلات مالی، صدور ضمانت‌نامه‌های بانکی و سرمایه‌گذاری برای شرکت‌ها و فناوران.',
      tags: [{ tag: 'تامین مالی' }, { tag: 'ضمانت‌نامه' }],
    },
  })
  const svcKnowledge = await payload.create({
    collection: 'services',
    data: {
      title: 'خدمات دانش بنیان',
      excerpt: 'حمایت از شرکت‌های دانش‌بنیان و استارتاپ‌های فناور در مسیر رشد، توسعه و ورود به بازار.',
      tags: [{ tag: 'دانش بنیان' }, { tag: 'استارتاپ' }],
    },
  })
  const svcCommercial = await payload.create({
    collection: 'services',
    data: {
      title: 'خدمات تجاری‌سازی و ورود به صنعت و بازار',
      excerpt: 'تسهیل مسیر تجاری‌سازی، توسعه بازار و ایجاد ارتباط با صنعت. از اعتبارسنجی ایده تا توسعه بازار و جذب شرکای صنعتی.',
      tags: [{ tag: 'تجاری‌سازی' }, { tag: 'بازار' }],
    },
  })

  // 4. Exhibitions
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

  // 5. News
  payload.logger.info('— Seeding news…')
  await payload.create({
    collection: 'news',
    data: {
      title: 'انتقال واحد اعتبارات صندوق پژوهش و فناوری استان بوشهر به محل جدید',
      status: 'published',
      pinned: true,
      publishDate: new Date().toISOString(),
      category: catNews.id,
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
    data: {
      title: 'حمایت از شرکت‌های دانش‌بنیان در مسیر تجاری‌سازی',
      status: 'published',
      pinned: false,
      publishDate: new Date().toISOString(),
      category: catNews.id,
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

  // 6. Reviews
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
      services: [svcFinancing.id, svcKnowledge.id, svcCommercial.id],
    },
    {
      blockType: 'events',
      heading: 'نمایشگاه و رویدادها',
      events: [],
      exhibitions: [exhibition.id],
    },
    {
      blockType: 'cta',
      richText: rt([
        { t: 'h2', x: 'مشتاق همکاری با شما هستیم' },
        { t: 'p', x: 'در صورت تمایل به همکاری با صندوق کارآفرینی بوشهر، رزومه خود را برای ما بفرستید.' },
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
      reviews: [review.id],
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
  await payload.updateGlobal({ slug: 'site-settings', data: { siteName: 'صندوق پژوهش و فناوری استان بوشهر' } })

  const navItems: any[] = [
    customLink('خانه', '/'),
    customLink('رویدادها', '/#events'),
    customLink('اخبار', '/#news'),
    customLink('درباره ما', '/#about'),
    customLink('تماس با ما', '/#contact'),
  ]
  await payload.updateGlobal({ slug: 'header', data: { navItems }, context: { disableRevalidate: true } })
  await payload.updateGlobal({
    slug: 'footer',
    data: {
      navItems: [...navItems, customLink('خدمات', '/#services')],
    },
    context: { disableRevalidate: true },
  })
  await payload.updateGlobal({
    slug: 'contact-us',
    data: {
      heading: 'تماس با ما',
      subtext: 'در صورت تمایل به همکاری با صندوق کارآفرینی بوشهر با ما در ارتباط باشید.',
      phone: '077 - 1234 56 78',
      email: 'info@sandoq.ir',
      address: rt([{ t: 'p', x: 'بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو' }]),
    },
  })

  payload.logger.info('Seeded Sandoq landing page successfully!')
  console.log(`\nDone. Created: 2 categories, 3 services, 1 exhibition, 2 news, 1 review, 4 FAQs + home page & globals.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
