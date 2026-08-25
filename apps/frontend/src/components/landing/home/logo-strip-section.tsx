'use client'

import {
  Partner1Logomark,
  Partner1Logotype,
  Partner2Logo,
  Partner3Logomark,
  Partner3Logotype,
  Partner4Logo,
  Partner5Logo,
} from '@/components/icons'
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type SVGProps,
} from 'react'

const PIXELS_PER_SECOND = 60

type LogoAsset = {
  id: string
  parts: {
    className: string
    Icon: ComponentType<SVGProps<SVGSVGElement>>
    id: string
  }[]
  width: string
}

const logos: LogoAsset[] = [
  {
    id: 'logo-1',
    width: 'w-[220px]',
    parts: [
      {
        id: 'partner-1-logotype',
        Icon: Partner1Logotype,
        className: 'absolute inset-[10%_0_7.5%_24.09%]',
      },
      {
        id: 'partner-1-logomark',
        Icon: Partner1Logomark,
        className: 'absolute inset-[0_78.88%_0_0]',
      },
    ],
  },
  {
    id: 'logo-2',
    width: 'w-44',
    parts: [
      {
        id: 'partner-2-logo',
        Icon: Partner2Logo,
        className: 'absolute inset-0',
      },
    ],
  },
  {
    id: 'logo-3',
    width: 'w-[202px]',
    parts: [
      {
        id: 'partner-3-logomark',
        Icon: Partner3Logomark,
        className: 'absolute inset-[0_80.2%_0_0]',
      },
      {
        id: 'partner-3-logotype',
        Icon: Partner3Logotype,
        className: 'absolute inset-[17.5%_0.22%_8.05%_25.32%]',
      },
    ],
  },
  {
    id: 'logo-4',
    width: 'w-[98px]',
    parts: [
      {
        id: 'partner-4-logo',
        Icon: Partner4Logo,
        className: 'absolute inset-[0_0.64%]',
      },
    ],
  },
  {
    id: 'logo-5',
    width: 'w-[159px]',
    parts: [
      {
        id: 'partner-5-logo',
        Icon: Partner5Logo,
        className: 'absolute inset-[7.25%_1.82%_7.25%_2.47%]',
      },
    ],
  },
]

const LogoBox = ({ logo }: { logo: LogoAsset }) => {
  return (
    <div className={`logo-strip-item relative h-10 shrink-0 overflow-hidden ${logo.width}`}>
      {logo.parts.map(({ Icon, ...part }) => (
        <Icon
          key={part.id}
          aria-hidden="true"
          className={`${part.className} pointer-events-none max-w-none text-neutral-500`}
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
    <section className="relative z-10 w-full py-0 lg:py-8">
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
