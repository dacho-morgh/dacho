'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

const PIXELS_PER_SECOND = 60

type LogoAsset = {
  id: string
  parts: {
    className: string
    height: number
    src: string
    width: number
  }[]
  width: string
}

const logos: LogoAsset[] = [
  {
    id: 'logo-1',
    width: 'w-[220px]',
    parts: [
      {
        src: '/figma/logos/logo-1-logotype.svg',
        width: 167,
        height: 33,
        className: 'absolute inset-[10%_0_7.5%_24.09%]',
      },
      {
        src: '/figma/logos/logo-1-logomark.svg',
        width: 46,
        height: 40,
        className: 'absolute inset-[0_78.88%_0_0]',
      },
    ],
  },
  {
    id: 'logo-2',
    width: 'w-44',
    parts: [
      {
        src: '/figma/logos/logo-2.svg',
        width: 176,
        height: 40,
        className: 'absolute inset-0',
      },
    ],
  },
  {
    id: 'logo-3',
    width: 'w-[202px]',
    parts: [
      {
        src: '/figma/logos/logo-3-logomark.svg',
        width: 40,
        height: 40,
        className: 'absolute inset-[0_80.2%_0_0]',
      },
      {
        src: '/figma/logos/logo-3-logotype.svg',
        width: 151,
        height: 30,
        className: 'absolute inset-[17.5%_0.22%_8.05%_25.32%]',
      },
    ],
  },
  {
    id: 'logo-4',
    width: 'w-[98px]',
    parts: [
      {
        src: '/figma/logos/logo-4.svg',
        width: 97,
        height: 40,
        className: 'absolute inset-[0_0.64%]',
      },
    ],
  },
  {
    id: 'logo-5',
    width: 'w-[159px]',
    parts: [
      {
        src: '/figma/logos/logo-5.svg',
        width: 152,
        height: 34,
        className: 'absolute inset-[7.25%_1.82%_7.25%_2.47%]',
      },
    ],
  },
]

const LogoBox = ({ logo }: { logo: LogoAsset }) => {
  return (
    <div className={`logo-strip-item relative h-10 shrink-0 overflow-hidden ${logo.width}`}>
      {logo.parts.map((part) => (
        <Image
          key={part.src}
          src={part.src}
          alt=""
          width={part.width}
          height={part.height}
          className={`${part.className} pointer-events-none max-w-none`}
        />
      ))}
    </div>
  )
}

const LogoStripSection = () => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(30)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const contentWidth = track.scrollWidth / 2
      setDuration(contentWidth / PIXELS_PER_SECOND)
    }

    measure()

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(track)
    window.addEventListener('resize', measure)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  return (
    <section className="relative z-10 w-full py-8">
      <div dir="ltr" className="logos-marquee-viewport w-full overflow-hidden">
        <div
          ref={trackRef}
          className="logos-marquee flex w-max"
          style={{ '--logos-duration': `${duration}s` } as CSSProperties}
        >
          {[0, 1].map((setIndex) => (
            <div
              key={setIndex}
              aria-hidden={setIndex === 1}
              className="flex shrink-0 items-center justify-center gap-20 pe-20"
            >
              {logos.map((logo) => (
                <LogoBox key={`${setIndex}-${logo.id}`} logo={logo} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LogoStripSection
