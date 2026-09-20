import { getPayload } from 'payload'
import { expect, test } from 'vitest'
import config from '@/payload.config'

test('editors can add and order a mixed-content Mag section', async () => {
  const payload = await getPayload({ config: await config })
  const [news, posts] = await Promise.all([
    payload.find({ collection: 'news', where: { _status: { equals: 'published' } }, limit: 1 }),
    payload.find({ collection: 'posts', where: { _status: { equals: 'published' } }, limit: 1 }),
  ])
  const newsId = news.docs[0]?.id
  const postId = posts.docs[0]?.id
  expect(newsId).toBeDefined()
  expect(postId).toBeDefined()
  if (!newsId || !postId) return

  const original = await payload.findGlobal({ slug: 'mag', depth: 0 })
  try {
    await payload.updateGlobal({
      slug: 'mag',
      context: { disableRevalidate: true },
      data: {
        sections: [
          ...(original.sections ?? []),
          {
            title: 'بخش آزمایشی',
            featured: { relationTo: 'posts', value: postId },
            stories: [
              { relationTo: 'news', value: newsId },
              { relationTo: 'posts', value: postId },
            ],
            hashtag: 'نوآوری',
            reverseLayout: true,
          },
        ],
      },
    })

    const updated = await payload.findGlobal({ slug: 'mag', depth: 0 })
    const added = updated.sections?.at(-1)
    expect(updated.sections).toHaveLength((original.sections?.length ?? 0) + 1)
    expect(added?.title).toBe('بخش آزمایشی')
    expect(added?.featured).toEqual({ relationTo: 'posts', value: postId })
    expect(added?.stories).toEqual([
      { relationTo: 'news', value: newsId },
      { relationTo: 'posts', value: postId },
    ])
    expect(added?.hashtag).toBe('نوآوری')
    expect(added?.reverseLayout).toBe(true)
  } finally {
    await payload.updateGlobal({
      slug: 'mag',
      context: { disableRevalidate: true },
      data: { sections: original.sections ?? [] },
    })
  }
})
