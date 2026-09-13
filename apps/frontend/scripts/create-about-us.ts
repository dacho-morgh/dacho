import 'dotenv/config'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

const heading = 'پیوند هوشمندانه صنعت و فناوری در قلب انرژی کشور'
const description =
  'کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر، با هدف راه‌اندازی نخستین هاب تخصصی نوآوری در حوزه انرژی‌های فسیلی و تجدیدپذیر در منطقه راهبردی عسلویه شکل گرفته است.'
const statement = 'رسالت ما، تبدیل چالش‌های واقعی صنعت به راهکارهای فناورانه و اقتصادی است'

async function main(): Promise<void> {
  console.log('Loading Payload…')
  const payload = await getPayload({ config })
  console.log('Checking About hero media…')
  const filename = 'about-hero.png'
  const existingMedia = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
  })

  let media = existingMedia.docs[0]

  if (!media) {
    console.log('Uploading About hero image…')
    const imagePath = path.resolve(process.cwd(), 'public/figma/about/about-hero.png')
    const [data, fileStats] = await Promise.all([readFile(imagePath), stat(imagePath)])

    media = await payload.create({
      collection: 'media',
      data: {
        alt: 'نمونه‌ای از هویت بصری و فعالیت‌های کارخانه نوآوری',
      },
      file: {
        data,
        mimetype: 'image/png',
        name: filename,
        size: fileStats.size,
      },
    })
  }

  console.log('Saving About Us global…')
  const aboutUs = await payload.updateGlobal({
    slug: 'about-us',
    context: { disableRevalidate: true },
    data: {
      introduction: {
        heading,
        description,
        statement,
        media: media.id,
      },
    },
  })

  console.log(
    JSON.stringify(
      {
        global: 'about-us',
        mediaId: media.id,
        updatedAt: aboutUs.updatedAt,
      },
      null,
      2,
    ),
  )
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
