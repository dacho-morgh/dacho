'use client'

import type { Media as MediaDocument, Slider } from '@dacho/cms-core'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { getImageProps } from 'next/image'
import * as React from 'react'
import {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { cn } from '@/utilities/ui'

gsap.registerPlugin(useGSAP)

const AUTOPLAY_DURATION_SECONDS = 10

export type HeroSliderImage = Omit<Slider['images'][number], 'landscapeImage' | 'mobileImage'> & {
  landscapeImage: MediaDocument
  mobileImage: MediaDocument
}

type HeroSliderSectionClientProps = {
  images: HeroSliderImage[]
  name: string
}

function ResponsiveSlideImage({ image, priority }: { image: HeroSliderImage; priority: boolean }) {
  const { landscapeImage, mobileImage } = image
  const alt = mobileImage.alt || landscapeImage.alt || ''

  const {
    props: { srcSet: landscapeSrcSet },
  } = getImageProps({
    alt,
    fetchPriority: priority ? 'high' : undefined,
    height: landscapeImage.height || 900,
    quality: 100,
    sizes: '(max-width: 1600px) calc(100vw - 2rem), 1520px',
    src: getMediaUrl(landscapeImage.url, landscapeImage.updatedAt),
    width: landscapeImage.width || 1600,
  })

  const {
    props: { srcSet: mobileSrcSet, ...mobileProps },
  } = getImageProps({
    alt,
    fetchPriority: priority ? 'high' : undefined,
    height: mobileImage.height || 900,
    quality: 100,
    sizes: 'calc(100vw - 2rem)',
    src: getMediaUrl(mobileImage.url, mobileImage.updatedAt),
    width: mobileImage.width || 640,
  })

  return (
    <picture className="absolute inset-0">
      <source
        media="(min-width: 640px)"
        sizes="(max-width: 1600px) calc(100vw - 2rem), 1520px"
        srcSet={landscapeSrcSet}
      />
      <source media="(max-width: 639px)" sizes="calc(100vw - 2rem)" srcSet={mobileSrcSet} />
      <img
        {...mobileProps}
        alt={alt}
        className="absolute inset-0 h-full w-full object-cover object-[center_80%] lg:object-[center_0%]"
      />
    </picture>
  )
}

export function HeroSliderSectionClient({ images, name }: HeroSliderSectionClientProps) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [timerKey, setTimerKey] = React.useState(0)
  const progressRefs = React.useRef<Array<HTMLSpanElement | null>>([])

  React.useEffect(() => {
    if (!api) return

    const updateCurrent = () => setCurrent(api.selectedScrollSnap())
    updateCurrent()
    api.on('select', updateCurrent)
    api.on('reInit', updateCurrent)

    return () => {
      api.off('select', updateCurrent)
      api.off('reInit', updateCurrent)
    }
  }, [api])

  useGSAP(
    () => {
      if (!api || images.length < 2) return

      const progressBars = progressRefs.current.filter(
        (progressBar): progressBar is HTMLSpanElement => progressBar !== null,
      )
      const activeProgress = progressRefs.current[current]
      if (!activeProgress) return

      gsap.set(progressBars, { scaleX: 0 })

      const media = gsap.matchMedia()
      media.add('(prefers-reduced-motion: no-preference)', () =>
        gsap.to(activeProgress, {
          duration: AUTOPLAY_DURATION_SECONDS,
          ease: 'none',
          onComplete: () => api.scrollNext(),
          scaleX: 1,
        }),
      )

      return () => media.revert()
    },
    { dependencies: [api, current, images.length, timerKey], revertOnUpdate: true },
  )

  const selectSlide = (index: number) => {
    api?.scrollTo(index)
    setTimerKey((key) => key + 1)
  }

  return (
    <section
      aria-label={name}
      className="relative mx-auto h-180 w-full max-w-[1600px] px-4 pt-25 pb-8 lg:h-screen lg:px-10 lg:pt-28 lg:pb-10"
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl bg-neutral-900 shadow-lg">
        <Carousel
          className="h-full w-full [&>[data-slot=carousel-content]]:h-full"
          dir="ltr"
          opts={{ direction: 'ltr', loop: true }}
          setApi={setApi}
        >
          <CarouselContent className="ml-0 h-full">
            {images.map((image, index) => (
              <CarouselItem className="relative h-full pl-0" key={image.id ?? `${name}-${index}`}>
                <ResponsiveSlideImage image={image} priority={index === 0} />
              </CarouselItem>
            ))}
          </CarouselContent>

          {images.length > 1 ? (
            <>
              <CarouselPrevious className="left-4 z-20 border-neutral-50/40 bg-neutral-900/20 text-neutral-50 backdrop-blur-sm hover:bg-neutral-900/40 md:left-8" />
              <CarouselNext className="right-4 z-20 border-neutral-50/40 bg-neutral-900/20 text-neutral-50 backdrop-blur-sm hover:bg-neutral-900/40 md:right-8" />
            </>
          ) : null}
        </Carousel>

        {/* <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-linear-to-b from-transparent to-neutral-900/60"
        /> */}

        {images.length > 1 ? (
          <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center gap-2" dir="ltr">
            {images.map(({ id }, index) => (
              <button
                aria-label={`نمایش اسلاید ${index + 1}`}
                aria-current={current === index ? 'true' : undefined}
                className={cn(
                  'relative h-2 overflow-hidden rounded-full bg-neutral-50/40 transition-[width,background-color] duration-300',
                  current === index ? 'w-12' : 'w-2 hover:bg-neutral-50/60',
                )}
                key={id ?? `slide-control-${index}`}
                onClick={() => selectSlide(index)}
                type="button"
              >
                <span
                  ref={(element) => {
                    progressRefs.current[index] = element
                  }}
                  aria-hidden="true"
                  className="absolute inset-0 origin-left scale-x-0 bg-neutral-50"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
