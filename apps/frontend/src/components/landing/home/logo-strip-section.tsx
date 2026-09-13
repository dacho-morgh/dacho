'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  PartnerFaraboorsLogo,
  PartnerNeybadLogo,
  PartnerNoavariLogo,
  PartnerOloomLogo,
  PartnerParkLogo,
  PartnerPguLogo,
  PartnerRiasatLogo,
  PartnerSanayeLogo,
} from '@/components/icons'
import { useRef, type ComponentType, type SVGProps } from 'react'

gsap.registerPlugin(useGSAP)

const PIXELS_PER_SECOND = 60

type LogoAsset = {
  id: string
  name: string
  href?: string
  width: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

const logos: LogoAsset[] = [
  {
    id: 'faraboors',
    name: 'فرابورس ایران',
    href: 'https://www.ifb.ir/',
    width: 'w-[365px]',
    Icon: PartnerFaraboorsLogo,
  },
  {
    id: 'noavari',
    name: 'صندوق نوآوری و شکوفایی',
    href: 'https://www.inif.ir/',
    width: 'w-[147px]',
    Icon: PartnerNoavariLogo,
  },
  {
    id: 'oloom',
    name: 'دانشگاه علوم پزشکی بوشهر',
    href: 'https://bpums.ac.ir/',
    width: 'w-[138px]',
    Icon: PartnerOloomLogo,
  },
  {
    id: 'park',
    name: 'پارک علم و فناوری خلیج فارس',
    href: 'https://pgstp.ir/',
    width: 'w-[186px]',
    Icon: PartnerParkLogo,
  },
  {
    id: 'neybad',
    name: 'سکوی تامین مالی جمعی نی‌باد',
    href: 'https://neybadcrowd.ir/',
    width: 'w-[144px]',
    Icon: PartnerNeybadLogo,
  },
  {
    id: 'pgu',
    name: 'دانشگاه خلیج فارس',
    href: 'https://www.pgu.ac.ir',
    width: 'w-[102px]',
    Icon: PartnerPguLogo,
  },
  {
    id: 'riasat',
    name: 'معاونت علمی و فناوری ریاست جمهوری',
    href: 'https://isti.ir/',
    width: 'w-[122px]',
    Icon: PartnerRiasatLogo,
  },
  {
    id: 'sanaye',
    name: 'صندوق حمایت از صنایع پیشرفته',
    href: 'http://www.imf.ir/',
    width: 'w-[214px]',
    Icon: PartnerSanayeLogo,
  },
]

const LogoBox = ({ logo, isClone }: { logo: LogoAsset; isClone?: boolean }) => {
  const content = (
    <logo.Icon
      aria-hidden="true"
      className="pointer-events-none h-full w-full object-contain text-neutral-500"
    />
  )

  if (logo.href) {
    return (
      <a
        href={logo.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={logo.name}
        tabIndex={isClone ? -1 : undefined}
        className={`logo-strip-item relative flex h-32 shrink-0 items-center justify-center transition-opacity hover:opacity-80 ${logo.width}`}
      >
        {content}
      </a>
    )
  }

  return (
    <div
      className={`logo-strip-item relative flex h-32 shrink-0 items-center justify-center ${logo.width}`}
      aria-label={logo.name}
    >
      {content}
    </div>
  )
}

const LogoStripSection = () => {
  const trackRef = useRef<HTMLDivElement>(null)
  const firstSetRef = useRef<HTMLDivElement>(null)
  const tweenRef = useRef<gsap.core.Tween>(null)

  useGSAP(() => {
    const track = trackRef.current
    const firstSet = firstSetRef.current
    if (!track || !firstSet) return

    const media = gsap.matchMedia()

    media.add('(prefers-reduced-motion: no-preference)', () => {
      let previousWidth = 0

      const createTween = () => {
        const width = firstSet.offsetWidth
        if (!width || Math.abs(width - previousWidth) < 0.5) return

        const progress = tweenRef.current?.progress() ?? 0
        const wasPaused = tweenRef.current?.paused() ?? false
        tweenRef.current?.kill()

        tweenRef.current = gsap.fromTo(
          track,
          { x: 0 },
          {
            duration: width / PIXELS_PER_SECOND,
            ease: 'none',
            repeat: -1,
            x: -width,
          },
        )
        tweenRef.current.progress(progress)
        if (wasPaused) tweenRef.current.pause()
        previousWidth = width
      }

      createTween()

      const resizeObserver = new ResizeObserver(createTween)
      resizeObserver.observe(firstSet)

      return () => {
        resizeObserver.disconnect()
        tweenRef.current?.kill()
        tweenRef.current = null
      }
    })

    return () => {
      media.revert()
      gsap.set(track, { clearProps: 'transform' })
    }
  }, [])

  return (
    <section className="relative z-10 w-full overflow-x-hidden py-8 lg:py-12">
      <div
        dir="ltr"
        className="w-full overflow-hidden"
        onMouseEnter={() => tweenRef.current?.pause()}
        onMouseLeave={() => tweenRef.current?.play()}
      >
        <div ref={trackRef} className="flex w-max will-change-transform">
          {[0, 1, 2, 3].map((setIndex) => (
            <div
              ref={setIndex === 0 ? firstSetRef : undefined}
              key={setIndex}
              aria-hidden={setIndex > 0}
              className="flex shrink-0 items-center justify-center gap-20 pe-20"
            >
              {logos.map((logo) => (
                <LogoBox
                  key={`${setIndex}-${logo.id}`}
                  logo={logo}
                  isClone={setIndex > 0}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LogoStripSection
