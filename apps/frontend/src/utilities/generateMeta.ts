import type { News, Page, Post } from '@dacho/cms-core'
import type { Metadata } from 'next'
import { createPageMetadata } from './siteMetadata'

export const generateMeta = async (args: {
  doc: Partial<News> | Partial<Page> | Partial<Post> | null
  path?: string
  description?: string | null
}): Promise<Metadata> => {
  const { doc, path, description } = args

  if (!doc) {
    return createPageMetadata({
      title: 'صفحه پیدا نشد',
      description: 'صفحه درخواست‌شده پیدا نشد.',
      path,
      noIndex: true,
    })
  }

  const resolvedPath = path || (doc.slug ? `/${doc.slug}` : '/')

  return createPageMetadata({
    title: doc.meta?.title || doc.title,
    description: description || doc.meta?.description,
    path: resolvedPath,
  })
}
