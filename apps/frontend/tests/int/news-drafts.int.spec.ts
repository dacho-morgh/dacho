import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

// News is a clone of Posts, which means drafts are real Payload versions gated
// by `authenticatedOrPublished` — NOT a plain `status` field that every page
// query has to remember to filter. Guard that: an anonymous read must never see
// a draft, even when the query passes no `where` clause of its own.
const DRAFT_SLUG = 'int-test-draft-news'
const PUBLISHED_SLUG = 'int-test-published-news'

const body = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [{ type: 'text', version: 1, text: 'محتوای تست' }],
      },
    ],
    direction: 'rtl' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
}

let payload: Payload

const cleanup = async () =>
  payload.delete({
    collection: 'news',
    context: { disableRevalidate: true },
    where: { slug: { in: [DRAFT_SLUG, PUBLISHED_SLUG] } },
  })

describe('news drafts', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()

    await payload.create({
      collection: 'news',
      context: { disableRevalidate: true },
      data: { title: 'خبر منتشرشده', slug: PUBLISHED_SLUG, content: body, _status: 'published' },
    })

    await payload.create({
      collection: 'news',
      context: { disableRevalidate: true },
      data: { title: 'خبر پیش‌نویس', slug: DRAFT_SLUG, content: body, _status: 'draft' },
    })
  })

  afterAll(async () => {
    await cleanup()
  })

  it('hides drafts from anonymous reads even without a status filter', async () => {
    const { docs } = await payload.find({
      collection: 'news',
      overrideAccess: false,
      pagination: false,
    })

    const slugs = docs.map((doc) => doc.slug)

    expect(slugs).toContain(PUBLISHED_SLUG)
    expect(slugs).not.toContain(DRAFT_SLUG)
  })

  it('exposes drafts when access control is overridden (admin/live preview)', async () => {
    const { docs } = await payload.find({
      collection: 'news',
      draft: true,
      overrideAccess: true,
      pagination: false,
      where: { slug: { equals: DRAFT_SLUG } },
    })

    expect(docs).toHaveLength(1)
    expect(docs[0]?._status).toBe('draft')
  })

  it('keeps a version row per news item so drafts can be rolled back', async () => {
    const { docs } = await payload.findVersions({
      collection: 'news',
      pagination: false,
      where: { 'version.slug': { equals: DRAFT_SLUG } },
    })

    expect(docs.length).toBeGreaterThan(0)
  })
})
