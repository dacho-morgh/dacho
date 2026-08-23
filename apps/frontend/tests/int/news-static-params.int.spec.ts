import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
}))

vi.mock('payload', () => ({
  getPayload: mocks.getPayload,
}))

vi.mock('@payload-config', () => ({
  default: Promise.resolve({}),
}))

vi.mock('next/image', () => ({ default: vi.fn() }))
vi.mock('next/navigation', () => ({ notFound: vi.fn() }))
vi.mock('@/components/landing/home/recruitment-section', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/news/news-page-header', () => ({ NewsBreadcrumb: vi.fn() }))
vi.mock('@/components/Media', () => ({ Media: vi.fn() }))
vi.mock('@/components/RichText', () => ({ default: vi.fn() }))
vi.mock('@/components/ui/typography', () => ({ Typography: vi.fn() }))

import { generateStaticParams } from '@/app/(frontend)/news/[slug]/page'

describe('news article static params', () => {
  beforeEach(() => {
    mocks.getPayload.mockReset()
  })

  it('defers paths to runtime when Payload cannot connect during the build', async () => {
    const connectionError = Object.assign(new Error('cannot connect to Postgres'), {
      payloadInitError: true,
    })
    mocks.getPayload.mockRejectedValue(connectionError)

    await expect(generateStaticParams()).resolves.toEqual([])
  })
})
