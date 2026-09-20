import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { PostsArchive } from '@/components/landing/posts/posts-archive'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const dynamic = 'force-dynamic'

type Args = { params: Promise<{ pageNumber: string }> }

export default async function PostsPageNumber({ params }: Args) {
  const { pageNumber } = await params
  const page = Number(pageNumber)
  if (!Number.isInteger(page) || page < 1) notFound()
  if (page === 1) redirect('/posts')

  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page,
    overrideAccess: false,
    where: { _status: { equals: 'published' } },
    sort: '-publishedAt',
  })
  if (page > posts.totalPages) notFound()

  return <PostsArchive posts={posts.docs} page={page} totalPages={posts.totalPages} />
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { pageNumber } = await params
  return createPageMetadata({
    title: `مقالات - صفحه ${Number(pageNumber).toLocaleString('fa-IR')}`,
    description: `مقالات و محتوای تخصصی کارخانه نوآوری صنایع انرژی بوشهر، صفحه ${Number(pageNumber).toLocaleString('fa-IR')}.`,
    path: `/posts/page/${pageNumber}`,
  })
}
