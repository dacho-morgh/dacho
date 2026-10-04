import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { expect, test } from 'vitest'
import EventPage from '@/components/landing/event-detail/event-figma-page'
import config from '@/payload.config'

test('saved event content, media and controls render without sample-content fallbacks', async () => {
  const payload = await getPayload({ config })
  const marker = randomUUID()
  let eventId: number | undefined
  let mediaId: number | undefined
  try {
    const data = await sharp({
      create: { width: 20, height: 20, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer()
    const media = await payload.create({
      collection: 'media',
      data: { alt: `poster-${marker}` },
      file: { data, name: `event-${marker}.png`, size: data.length, mimetype: 'image/png' },
    })
    mediaId = media.id
    const event = await payload.create({
      collection: 'events',
      data: {
        title: `event-${marker}`,
        status: 'upcoming',
        location: 'Test venue',
        startDate: '2027-02-01T21:00:00.000Z',
        endDate: '2027-02-01T22:00:00.000Z',
      },
    })
    eventId = event.id
    await payload.update({
      collection: 'events',
      id: eventId,
      data: {
        featuredImage: mediaId,
        registration: { label: 'Custom registration', href: '/custom-registration' },
        countdown: { daysLabel: 'Custom days', targetDate: '2027-01-01T00:00:00.000Z' },
        metadata: { eventType: 'Custom type' },
        about: {
          title: 'Custom about',
          paragraphs: [{ text: 'Custom paragraph' }],
          image: mediaId,
        },
        opportunities: { title: 'Custom opportunities', items: [{ title: 'Custom opportunity' }] },
        audience: { title: 'Custom audience', items: [{ title: 'Custom attendee' }] },
        steps: {
          title: 'Custom steps',
          items: [{ title: 'Custom step', description: 'Custom step details' }],
        },
        guests: {
          title: 'Custom guests',
          items: [{ name: 'Custom guest', role: 'Custom role', image: mediaId }],
        },
        sponsors: {
          title: 'Custom sponsors',
          items: [{ name: 'Custom sponsor', logo: mediaId, href: '/custom-sponsor' }],
        },
        gallery: { title: 'Custom gallery', items: [{ image: mediaId }] },
        schedule: {
          title: 'Custom schedule',
          buttons: [{ label: 'Custom session link', href: '/custom-session', primary: true }],
          items: [
            { time: 'Custom time', title: 'Custom session', description: 'Custom session details' },
          ],
        },
        venue: {
          title: 'Custom venue',
          address: 'Custom address',
          mapImage: mediaId,
          mapHref: '/custom-map',
        },
        callToAction: {
          title: 'Custom CTA',
          description: 'Custom CTA details',
          buttonLabel: 'Custom CTA button',
          buttonHref: '/custom-cta',
          backgroundImage: mediaId,
        },
        faq: {
          title: 'Custom FAQ',
          items: [{ question: 'Custom question', answer: 'Custom answer' }],
        },
      },
    })
    const saved = await payload.findByID({
      collection: 'events',
      id: eventId,
      depth: 1,
      overrideAccess: false,
    })
    expect(saved.countdown?.targetDate).toBe('2027-01-01T00:00:00.000Z')
    const html = renderToStaticMarkup(createElement(EventPage, { document: saved }))
    for (const text of [
      'Custom registration',
      'Custom days',
      'Custom type',
      'Custom about',
      'Custom paragraph',
      'Custom opportunities',
      'Custom attendee',
      'Custom step details',
      'Custom guest',
      'Custom role',
      'Custom sponsor',
      'Custom gallery',
      'Custom time',
      'Custom session details',
      'Custom address',
      'Custom CTA details',
      'Custom CTA button',
      'Custom question',
      'Custom answer',
    ]) {
      expect(html).toContain(text)
    }
    for (const href of [
      '/custom-registration',
      '/custom-session',
      '/custom-sponsor',
      '/custom-map',
      '/custom-cta',
    ]) {
      expect(html).toContain(`href="${href}"`)
    }
    expect(html).toContain(`alt="poster-${marker}"`)
    expect(html).toContain(`event-${marker}.png`)
    // Tehran is on the next calendar day for these evening UTC timestamps.
    expect(html).toContain(
      new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Tehran',
      }).format(new Date(saved.startDate)),
    )
    expect(html).toContain(
      new Intl.DateTimeFormat('fa-IR', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Tehran',
      }).format(new Date(saved.startDate)),
    )

    await payload.update({
      collection: 'events',
      id: eventId,
      data: {
        registration: { enabled: false },
        countdown: { enabled: false },
        about: { paragraphs: [] },
        opportunities: { items: [] },
        audience: { items: [] },
        steps: { items: [] },
        guests: { enabled: false },
        sponsors: { enabled: false },
        gallery: { items: [] },
        schedule: { buttons: [], items: [] },
        venue: { enabled: false },
        callToAction: { enabled: false },
        faq: { items: [] },
      },
    })
    const cleared = await payload.findByID({ collection: 'events', id: eventId, depth: 1 })
    const clearedHtml = renderToStaticMarkup(createElement(EventPage, { document: cleared }))
    for (const text of [
      'Custom registration',
      'Custom days',
      'Custom paragraph',
      'Custom opportunity',
      'Custom attendee',
      'Custom step details',
      'Custom guests',
      'Custom sponsors',
      'Custom time',
      'Custom session link',
      'Custom address',
      'Custom CTA',
      'Custom question',
    ]) {
      expect(clearedHtml).not.toContain(text)
    }
    expect(cleared.about?.paragraphs).toEqual([])
    expect(cleared.gallery?.items).toEqual([])
  } finally {
    if (eventId) await payload.delete({ collection: 'events', id: eventId })
    if (mediaId) await payload.delete({ collection: 'media', id: mediaId })
  }
}, 30_000)
