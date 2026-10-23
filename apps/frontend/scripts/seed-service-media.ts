import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

// Backfill only missing illustrations. Existing service text and selected media
// belong to CMS editors and must survive repeated runs.
const serviceKeys = new Set([
  'financing',
  'events',
  'exhibitions',
  'knowledge',
  'commercialization',
])

async function main(): Promise<void> {
  const payload = await getPayload({ config })

  try {
    const { docs: services } = await payload.find({
      collection: 'services',
      depth: 0,
      limit: 0,
      pagination: false,
    })

    for (const service of services) {
      if (service.featuredImage || !service.key || !serviceKeys.has(service.key)) continue

      const filename = `service-${service.key}.svg`
      const { docs: existingMedia } = await payload.find({
        collection: 'media',
        where: { filename: { equals: filename } },
        limit: 1,
        depth: 0,
      })
      const image =
        existingMedia[0] ||
        (await payload.create({
          collection: 'media',
          data: { alt: service.title },
          filePath: fileURLToPath(new URL(`./assets/services/${filename}`, import.meta.url)),
        }))

      await payload.update({
        collection: 'services',
        id: service.id,
        data: { featuredImage: image.id },
        context: { disableRevalidate: true },
      })
      console.log(`Service illustration added: ${service.key}`)
    }
  } finally {
    await payload.destroy()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
