import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import { expect, test } from 'vitest'
import config from '@/payload.config'

test('editors can add and order a mixed-content Mag section', async () => {
  const payload = await getPayload({ config: await config })
  const original = await payload.findGlobal({ slug: 'mag', depth: 0 })
  const slug = `int-mag-section-${randomUUID()}`
  const content = {
    root: {
      type: 'root' as const,
      children: [
        {
          type: 'paragraph' as const,
          version: 1,
          children: [{ type: 'text' as const, version: 1, text: 'محتوای تست' }],
        },
      ],
      direction: 'rtl' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
  let newsId: number | undefined
  let postId: number | undefined
  try {
    const news = await payload.create({
      collection: 'news',
      context: { disableRevalidate: true },
      data: { title: 'خبر آزمایشی مجله', slug: `${slug}-news`, content, _status: 'published' },
    })
    newsId = news.id
    const post = await payload.create({
      collection: 'posts',
      context: { disableRevalidate: true },
      data: { title: 'مقاله آزمایشی مجله', slug: `${slug}-post`, content, _status: 'published' },
    })
    postId = post.id

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
    if (postId)
      await payload.delete({
        collection: 'posts',
        id: postId,
        context: { disableRevalidate: true },
      })
    if (newsId)
      await payload.delete({ collection: 'news', id: newsId, context: { disableRevalidate: true } })
  }
}, 20_000)
