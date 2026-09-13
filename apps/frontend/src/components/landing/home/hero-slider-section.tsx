import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { buildSafe } from '@/utilities/buildSafe'
import { type HeroSliderImage, HeroSliderSectionClient } from './hero-slider-section.client'

const HEADER_SLIDER_NAME = 'header slider'

const HeroSliderSection = async () => {
  const slider = await buildSafe('home header slider', async () => {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'sliders',
      depth: 1,
      limit: 1,
      pagination: false,
      where: {
        name: {
          equals: HEADER_SLIDER_NAME,
        },
      },
    })

    return docs[0] ?? null
  })

  if (!slider) return null

  const images = slider.images.filter(
    (image): image is HeroSliderImage =>
      typeof image.landscapeImage === 'object' &&
      image.landscapeImage !== null &&
      typeof image.mobileImage === 'object' &&
      image.mobileImage !== null,
  )
  if (images.length === 0) return null

  return <HeroSliderSectionClient images={images} name={slider.name} />
}

export default HeroSliderSection
