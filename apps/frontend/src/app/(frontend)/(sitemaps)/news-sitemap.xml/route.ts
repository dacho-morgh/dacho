import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

// Computed per request (cached via unstable_cache + invalidated by the
// collection revalidate hooks) so `next build` doesn't need a live database.
export const dynamic = 'force-dynamic'

const getNewsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://example.com'

    const results = await payload.find({
      collection: 'news',
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        _status: {
          equals: 'published',
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((news) => Boolean(news?.slug))
          .map((news) => ({
            loc: `${SITE_URL}/news/${news?.slug}`,
            lastmod: news.updatedAt || dateFallback,
          }))
      : []

    return sitemap
  },
  ['news-sitemap'],
  {
    tags: ['news-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getNewsSitemap()

  return getServerSideSitemap(sitemap)
}
