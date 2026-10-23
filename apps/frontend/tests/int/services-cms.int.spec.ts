import { randomUUID } from 'node:crypto'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import ServiceCard from '@/components/landing/home/service-card'
import ServicesSection from '@/components/landing/home/services-section'
import config from '@/payload.config'

const marker = `service-cms-${randomUUID()}`
const context = { disableRevalidate: true }
let payload: Payload
const mediaIds: number[] = []
const serviceIds: number[] = []

describe('CMS homepage services', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
  })

  afterAll(async () => {
    for (const id of serviceIds) {
      await payload.delete({ collection: 'services', id, context })
    }
    for (const id of mediaIds) {
      await payload.delete({ collection: 'media', id })
    }
  })

  it.each(['svg', 'webp'] as const)(
    'persists and renders a CMS %s illustration and text',
    async (format) => {
      const data =
        format === 'svg'
          ? Buffer.from(
              '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="blue"/></svg>',
            )
          : await sharp({ create: { width: 20, height: 20, channels: 3, background: 'blue' } })
              .webp()
              .toBuffer()
      const media = await payload.create({
        collection: 'media',
        data: { alt: `${marker}-${format}` },
        file: {
          data,
          size: data.length,
          name: `${marker}.${format}`,
          mimetype: format === 'svg' ? 'image/svg+xml' : 'image/webp',
        },
      })
      mediaIds.push(media.id)
      const service = await payload.create({
        collection: 'services',
        data: {
          title: `${marker}-${format}`,
          excerpt: `CMS description ${format}`,
          featuredImage: media.id,
        },
        context,
      })
      serviceIds.push(service.id)
      const saved = await payload.findByID({
        collection: 'services',
        id: service.id,
        depth: 1,
        overrideAccess: false,
      })
      const markup = renderToStaticMarkup(createElement(ServiceCard, { service: saved }))
      expect(markup).toContain(service.title)
      expect(markup).toContain(`CMS description ${format}`)
      expect(markup).toContain(media.filename)
      expect(markup).toContain(`alt="${media.alt}"`)
      if (format === 'svg') expect(markup).not.toContain('/_next/image')
      else expect(markup).toContain('/_next/image')
    },
  )

  it('rejects a PNG selection on the server', async () => {
    const data = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'blue' } })
      .png()
      .toBuffer()
    const media = await payload.create({
      collection: 'media',
      data: { alt: marker },
      file: { data, size: data.length, name: `${marker}.png`, mimetype: 'image/png' },
    })
    mediaIds.push(media.id)
    await expect(
      payload.update({
        collection: 'services',
        id: serviceIds[0],
        data: { featuredImage: media.id },
        context,
      }),
    ).rejects.toThrow()
  })

  it('shows services beyond the fifth card and allows cards without images', async () => {
    for (let index = 0; index < 6; index++) {
      const service = await payload.create({
        collection: 'services',
        data: { title: `${marker}-extra-${index}` },
        context,
      })
      serviceIds.push(service.id)
    }
    const markup = renderToStaticMarkup(await ServicesSection())
    for (let index = 0; index < 6; index++) expect(markup).toContain(`${marker}-extra-${index}`)
    const noImage = renderToStaticMarkup(
      createElement(ServiceCard, { service: { title: 'Text only', featuredImage: 123 } }),
    )
    expect(noImage).toContain('Text only')
    expect(noImage).not.toContain('<img')
  })

  it('appends new services and follows CMS drag ordering in the homepage grid', async () => {
    const services = []
    for (let index = 0; index < 3; index++) {
      const service = await payload.create({
        collection: 'services',
        data: { title: `${marker}-ordered-${index}` },
        context,
      })
      serviceIds.push(service.id)
      services.push(service)
    }
    const [first, second, third] = services
    expect(first._order! < second._order!).toBe(true)
    expect(second._order! < third._order!).toBe(true)

    const reorder = payload.config.endpoints?.find(
      (endpoint) => endpoint.path === '/reorder' && endpoint.method === 'post',
    )
    expect(reorder).toBeDefined()
    const requestFor = async (roles: string[]) => {
      const req = await createLocalReq(
        {
          context,
          user: { id: 1, roles, collection: 'users' } as NonNullable<PayloadRequest['user']>,
        },
        payload,
      )
      req.json = async () => ({
        collectionSlug: 'services',
        docsToMove: [third.id],
        orderableFieldName: '_order',
        newKeyWillBe: 'less',
        target: { id: first.id, key: first._order },
      })
      return req
    }
    await expect(reorder!.handler(await requestFor(['representative']))).rejects.toThrow()
    const response = await reorder!.handler(await requestFor(['admin']))
    expect(response.status).toBe(200)

    const markup = renderToStaticMarkup(await ServicesSection())
    expect(markup.indexOf(third.title)).toBeLessThan(markup.indexOf(first.title))
    expect(markup.indexOf(first.title)).toBeLessThan(markup.indexOf(second.title))
  })
})
