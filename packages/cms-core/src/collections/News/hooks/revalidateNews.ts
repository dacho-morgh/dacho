import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

import type { News } from '@cms-core/payload-types'

export const revalidateNews: CollectionAfterChangeHook<News> = ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    revalidatePath('/mag')
    if (doc._status === 'published') {
      const path = `/news/${doc.slug}`

      payload.logger.info(`Revalidating news at path: ${path}`)

      revalidatePath(path)
      revalidateTag('news-sitemap', 'max')
    }

    // If the news item was previously published, we need to revalidate the old path
    if (previousDoc._status === 'published' && doc._status !== 'published') {
      const oldPath = `/news/${previousDoc.slug}`

      payload.logger.info(`Revalidating old news at path: ${oldPath}`)

      revalidatePath(oldPath)
      revalidateTag('news-sitemap', 'max')
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<News> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    revalidatePath('/mag')
    const path = `/news/${doc?.slug}`

    revalidatePath(path)
    revalidateTag('news-sitemap', 'max')
  }

  return doc
}
