import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { PostsArchive } from '@/components/landing/posts/posts-archive'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createPageMetadata({
  title: 'مقالات',
  description: 'مقالات و محتوای تخصصی کارخانه نوآوری صنایع انرژی بوشهر.',
  path: '/posts',
})

export default async function PostsPage() {
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page: 1,
    overrideAccess: false,
    where: { _status: { equals: 'published' } },
    sort: '-publishedAt',
  })

  return <PostsArchive posts={posts.docs} page={posts.page ?? 1} totalPages={posts.totalPages} />
}
