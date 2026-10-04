import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find: mocks.find })) }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))

import EventsPage from '@/app/(frontend)/events/page'

beforeEach(() => mocks.find.mockReset())

test('a single CMS event redirects to its own detail page', async () => {
  mocks.find.mockResolvedValue({ docs: [{ id: 73, title: 'Only CMS event' }] })
  await expect(EventsPage()).rejects.toMatchObject({
    message: 'NEXT_REDIRECT',
    digest: expect.stringContaining('/events/73;307;'),
  })
})

test('the listing opens each CMS event by its own ID', async () => {
  mocks.find.mockResolvedValue({
    docs: [
      {
        id: 41,
        title: 'First CMS event',
        startDate: '2027-02-01T00:00:00Z',
        location: 'First venue',
        metadata: { dateText: 'Custom event date' },
      },
      {
        id: 42,
        title: 'Second CMS event',
        startDate: '2027-03-01T00:00:00Z',
        location: 'Second venue',
      },
    ],
  })
  const html = renderToStaticMarkup(await EventsPage())
  expect(html).toContain('href="/events/41"')
  expect(html).toContain('href="/events/42"')
  for (const text of [
    'First CMS event',
    'Second CMS event',
    'First venue',
    'Second venue',
    'Custom event date',
  ]) {
    expect(html).toContain(text)
  }
  expect(mocks.find).toHaveBeenCalledWith(
    expect.objectContaining({ collection: 'events', overrideAccess: false, pagination: false }),
  )
})

test('an empty Events collection does not render sample events or a detail page', async () => {
  mocks.find.mockResolvedValue({ docs: [] })
  expect(renderToStaticMarkup(await EventsPage())).not.toContain('<article')
})
