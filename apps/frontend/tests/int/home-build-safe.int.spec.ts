import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
}))

vi.mock('payload', () => ({ getPayload: mocks.getPayload }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('@/components/RichText', () => ({ default: vi.fn() }))
vi.mock('@/components/icons', () => ({ ArrowLeftIcon: vi.fn() }))
vi.mock('@/components/ui/accordion', () => ({
  Accordion: vi.fn(),
  AccordionContent: vi.fn(),
  AccordionItem: vi.fn(),
  AccordionTrigger: vi.fn(),
}))
vi.mock('@/components/ui/button', () => ({ Button: vi.fn() }))
vi.mock('@/components/ui/carousel', () => ({
  Carousel: vi.fn(),
  CarouselContent: vi.fn(),
  CarouselItem: vi.fn(),
  CarouselNext: vi.fn(),
  CarouselPrevious: vi.fn(),
}))
vi.mock('@/components/ui/typography', () => ({ Typography: vi.fn() }))
vi.mock('@/components/landing/home/comment-card', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/home/comments-slideshow', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/home/event-card', () => ({}))
vi.mock('@/components/landing/home/events-carousel', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/home/news-card', () => ({ default: vi.fn() }))
vi.mock('@/components/landing/home/service-card', () => ({ default: vi.fn() }))

describe('Payload-backed home sections', () => {
  beforeEach(() => {
    mocks.getPayload.mockReset()
    mocks.getPayload.mockRejectedValue(
      Object.assign(new Error('cannot connect to Postgres'), { payloadInitError: true }),
    )
  })

  it.each([
    ['services', () => import('@/components/landing/home/services-section')],
    ['events', () => import('@/components/landing/home/events-section')],
    ['news', () => import('@/components/landing/home/news-section')],
    ['comments', () => import('@/components/landing/home/comments-section')],
    ['FAQ', () => import('@/components/landing/home/faq-section')],
  ])('omits %s when Payload cannot connect during the build', async (_, loadSection) => {
    const { default: renderSection } = await loadSection()

    await expect(renderSection()).resolves.toBeNull()
  })
})
