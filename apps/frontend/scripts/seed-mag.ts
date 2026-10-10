import 'dotenv/config'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

const newsSamples = [
  [
    'نسل جدید مدل‌های زبانی و تأثیر آن بر کسب‌وکارهای ایرانی',
    'گزارش تازه‌ای از کاربرد ابزارهای هوش مصنوعی در کسب‌وکارهای ایرانی.',
    'هوش مصنوعی',
    'latest-0',
    ['هوش مصنوعی', 'فناوری'],
  ],
  [
    'از اعتبارسنجی ایده تا توسعه بازار و جذب شرکای صنعتی',
    'مسیر یک ایده از اعتبارسنجی تا ورود به بازار در اکوسیستم نوآوری بوشهر.',
    'فناوری',
    'latest-1',
    ['فناوری', 'نوآوری'],
  ],
  [
    'موفقیت استارتاپ بوشهری در جذب سرمایه',
    'یک تیم نوآور بوشهری مرحله تازه‌ای از توسعه محصول خود را آغاز کرد.',
    'استارتاپ',
    'latest-2',
    ['استارتاپ', 'سرمایه‌گذاری'],
  ],
  [
    'تأثیر سیاست‌های جدید بر اکوسیستم نوآوری',
    'فعالان این حوزه درباره فرصت‌های پیش روی تیم‌های نوآور گفت‌وگو کردند.',
    'اقتصاد',
    'latest-3',
    ['اقتصاد دیجیتال', 'نوآوری'],
  ],
  [
    'رویداد صنعت و نوآوری بوشهر برگزار می‌شود',
    'برنامه رویداد و فرصت‌های حضور تیم‌ها و شرکت‌های صنعتی اعلام شد.',
    'رویداد',
    'events-0',
    ['نمایشگاه', 'نوآوری'],
  ],
  [
    'پژوهش‌های نوین انرژی‌های تجدیدپذیر در بوشهر',
    'پژوهشگران راهکارهای تازه‌ای برای بهره‌گیری از انرژی خورشیدی بررسی کردند.',
    'فناوری',
    'latest-5',
    ['انرژی', 'فناوری'],
  ],
  [
    'کاربرد هوش مصنوعی در صنایع کوچک و متوسط',
    'نمونه‌هایی از استفاده عملی ابزارهای هوشمند در فرآیندهای صنعتی معرفی شد.',
    'هوش مصنوعی',
    'ai-0',
    ['هوش مصنوعی', 'فناوری'],
  ],
  [
    'بلاک‌چین و فرصت‌های آن برای خدمات مالی',
    'کارشناسان درباره شفافیت تراکنش‌ها و کاربردهای این فناوری گفت‌وگو کردند.',
    'فناوری',
    'technology-1',
    ['بلاک‌چین', 'اقتصاد دیجیتال'],
  ],
  [
    'امنیت سایبری و چالش‌های پیش روی شرکت‌ها',
    'روش‌های افزایش تاب‌آوری دیجیتال در شرکت‌های نوآور بررسی شد.',
    'فناوری',
    'technology-2',
    ['فناوری', 'اقتصاد دیجیتال'],
  ],
  [
    'کاربرد هوش مصنوعی در تشخیص بیماری‌ها',
    'پژوهشگران نتایج تازه‌ای از کاربرد مدل‌های هوشمند در سلامت منتشر کردند.',
    'هوش مصنوعی',
    'ai-1',
    ['هوش مصنوعی'],
  ],
  [
    'آینده مشاغل در عصر هوش مصنوعی',
    'مهارت‌های تازه موردنیاز نیروی کار در اقتصاد دیجیتال بررسی شد.',
    'هوش مصنوعی',
    'ai-2',
    ['هوش مصنوعی', 'اقتصاد دیجیتال'],
  ],
  [
    'گزارش همایش نوآوری و کارآفرینی بوشهر',
    'در این همایش فعالان صنعت و تیم‌های نوآور تجربه‌های خود را به اشتراک گذاشتند.',
    'رویداد',
    'events-1',
    ['نمایشگاه', 'استارتاپ'],
  ],
] as const

const postSamples = [
  [
    'آینده هوش مصنوعی در کسب‌وکارهای ایرانی',
    'تحلیلی از فرصت‌ها و چالش‌های به‌کارگیری هوش مصنوعی در صنعت ایران.',
    'هوش مصنوعی',
    'articles-0',
    'تحلیل',
    ['هوش مصنوعی', 'اقتصاد دیجیتال'],
  ],
  [
    'اکوسیستم استارتاپی جنوب ایران؛ وضعیت و چشم‌انداز',
    'نگاهی به مسیر رشد استارتاپ‌های جنوب کشور و فرصت‌های پیش رو.',
    'استارتاپ',
    'articles-1',
    'گزارش',
    ['استارتاپ', 'سرمایه‌گذاری'],
  ],
  [
    'گفت‌وگو درباره ساخت یک استارتاپ در بوشهر',
    'تجربه‌های راه‌اندازی کسب‌وکار نوپا در استان بوشهر.',
    'استارتاپ',
    'articles-2',
    'مصاحبه',
    ['استارتاپ', 'نوآوری'],
  ],
  [
    'آینده اقتصاد دیجیتال جنوب ایران',
    'مروری بر ظرفیت‌های اقتصاد دیجیتال و مسیر توسعه آن در جنوب کشور.',
    'اقتصاد',
    'report-0',
    'گزارش ویژه',
    ['اقتصاد دیجیتال', 'فناوری'],
  ],
  [
    'نوآوری صنعتی در عصر هوش مصنوعی',
    'صنایع سنتی چگونه با فناوری‌های جدید شیوه کار خود را تغییر می‌دهند.',
    'فناوری',
    'editors-1',
    'پرونده ویژه',
    ['هوش مصنوعی', 'فناوری'],
  ],
  [
    'سرمایه‌گذاری خطرپذیر در ایران',
    'بررسی جریان سرمایه‌گذاری در شرکت‌های نوپا و فناور.',
    'اقتصاد',
    'editors-2',
    'تحلیل',
    ['سرمایه‌گذاری', 'استارتاپ'],
  ],
] as const

function richText(text: string) {
  return {
    root: {
      type: 'root' as const,
      direction: 'rtl' as const,
      format: '' as const,
      indent: 0,
      version: 1,
      children: [
        {
          type: 'paragraph' as const,
          direction: 'rtl' as const,
          format: '' as const,
          indent: 0,
          textFormat: 0,
          version: 1,
          children: [
            {
              type: 'text' as const,
              text,
              detail: 0,
              format: 0,
              mode: 'normal' as const,
              style: '',
              version: 1,
            },
          ],
        },
      ],
    },
  }
}

async function main() {
  const payload = await getPayload({ config })
  const categories = new Map<string, number>()
  for (const title of new Set([...newsSamples, ...postSamples].map((item) => item[2]))) {
    const slug = `mag-${title === 'هوش مصنوعی' ? 'ai' : title === 'فناوری' ? 'technology' : title === 'استارتاپ' ? 'startup' : title === 'اقتصاد' ? 'economy' : 'events'}`
    const found = await payload.find({
      collection: 'categories',
      where: { slug: { equals: slug } },
      limit: 1,
    })
    const category =
      found.docs[0] ?? (await payload.create({ collection: 'categories', data: { title, slug } }))
    categories.set(title, category.id)
  }

  const media = new Map<string, number>()
  for (const name of new Set([...newsSamples, ...postSamples].map((item) => item[3]))) {
    const filename = `mag-seed-${name}.png`
    const found = await payload.find({
      collection: 'media',
      where: { filename: { equals: filename } },
      limit: 1,
    })
    if (found.docs[0]) {
      media.set(name, found.docs[0].id)
      continue
    }
    const imagePath = path.resolve(process.cwd(), `public/figma/mag/${name}.png`)
    const [data, fileStats] = await Promise.all([readFile(imagePath), stat(imagePath)])
    const created = await payload.create({
      collection: 'media',
      data: { alt: `تصویر نمونه مجله: ${name}` },
      file: { data, mimetype: 'image/png', name: filename, size: fileStats.size },
    })
    media.set(name, created.id)
  }

  const news: number[] = []
  for (const [index, [title, excerpt, category, image, tags]] of newsSamples.entries()) {
    const slug = `mag-sample-news-${index + 1}`
    const found = await payload.find({
      collection: 'news',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    const data = {
      title,
      slug,
      excerpt,
      content: richText(
        `${excerpt} این مطلب نمونه برای بررسی عملکرد مجله و ویرایش در پنل مدیریت ثبت شده است.`,
      ),
      categories: [categories.get(category)!],
      heroImage: media.get(image)!,
      tags: tags.map((tag) => ({ tag })),
      readingMinutes: 5,
      editorialLabel: category === 'رویداد' ? 'گزارش' : undefined,
      publishedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
      _status: 'published' as const,
    }
    const item =
      found.docs[0] ??
      (await payload.create({ collection: 'news', data, context: { disableRevalidate: true } }))
    news.push(item.id)
  }

  const posts: number[] = []
  for (const [index, [title, excerpt, category, image, label, tags]] of postSamples.entries()) {
    const slug = `mag-sample-post-${index + 1}`
    const found = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    const data = {
      title,
      slug,
      excerpt,
      content: richText(
        `${excerpt} این مقاله نمونه برای بررسی عملکرد مجله و ویرایش در پنل مدیریت ثبت شده است.`,
      ),
      categories: [categories.get(category)!],
      heroImage: media.get(image)!,
      editorialLabel: label,
      tags: tags.map((tag) => ({ tag })),
      readingMinutes: 8 + index,
      publishedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
      _status: 'published' as const,
    }
    const item =
      found.docs[0] ??
      (await payload.create({ collection: 'posts', data, context: { disableRevalidate: true } }))
    posts.push(item.id)
  }
  const firstPost = await payload.findByID({ collection: 'posts', id: posts[0], depth: 0 })
  if (!firstPost.relatedPosts?.length)
    await payload.update({
      collection: 'posts',
      id: posts[0],
      data: { relatedPosts: [posts[1], posts[2]] },
      context: { disableRevalidate: true },
    })
  const firstNews = await payload.findByID({ collection: 'news', id: news[0], depth: 0 })
  if (!firstNews.relatedNews?.length)
    await payload.update({
      collection: 'news',
      id: news[0],
      data: { relatedNews: [news[6], news[9]] },
      context: { disableRevalidate: true },
    })
  const currentMag = await payload.findGlobal({ slug: 'mag', depth: 0 })
  if (!currentMag.hero)
    await payload.updateGlobal({
      slug: 'mag',
      context: { disableRevalidate: true },
      data: {
        hero: news[0],
        hotHashtags: [
          'هوش مصنوعی',
          'استارتاپ',
          'انرژی',
          'فناوری',
          'اقتصاد دیجیتال',
          'نمایشگاه',
          'سرمایه‌گذاری',
          'نوآوری',
          'بلاک‌چین',
        ].map((tag) => ({ tag })),
        sections: [
          {
            title: 'فناوری',
            featured: { relationTo: 'news', value: news[1] },
            stories: [news[5], news[7], news[8]].map((value) => ({
              relationTo: 'news' as const,
              value,
            })),
            hashtag: 'فناوری',
            reverseLayout: true,
          },
          {
            title: 'هوش مصنوعی',
            featured: { relationTo: 'news', value: news[6] },
            stories: [news[9], news[10], news[0]].map((value) => ({
              relationTo: 'news' as const,
              value,
            })),
            hashtag: 'هوش مصنوعی',
            reverseLayout: false,
          },
        ],
        featuredReport: posts[3],
        mostRead: [
          { relationTo: 'posts', value: posts[0] },
          { relationTo: 'news', value: news[0] },
          { relationTo: 'posts', value: posts[1] },
          { relationTo: 'news', value: news[7] },
        ],
        editorPicks: [
          { relationTo: 'posts', value: posts[3] },
          { relationTo: 'posts', value: posts[4] },
          { relationTo: 'posts', value: posts[5] },
          { relationTo: 'posts', value: posts[2] },
        ],
        eventNews: [news[4], news[11]],
        showRecruitment: true,
      },
    })
  console.log(
    `Mag seed complete: ${news.length} news, ${posts.length} articles, ${media.size} images. Existing records were preserved.`,
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
