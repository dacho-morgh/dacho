'use client'

import type gsap from 'gsap'
import Image from 'next/image'
import { useEffect, useRef } from 'react'

const PIXELS_PER_SECOND = 60

type LogoAsset = {
  id: string
  name: string
  href?: string
  width: string
  src: string
}

const logos: LogoAsset[] = [
  {
    id: 'faraboors',
    name: 'فرابورس ایران',
    href: 'https://www.ifb.ir/',
    width: 'w-[219px] sm:w-[292px]',
    src: '/icons/partners/faraboors.svg',
  },
  {
    id: 'noavari',
    name: 'صندوق نوآوری و شکوفایی',
    href: 'https://www.inif.ir/',
    width: 'w-[88px] sm:w-[118px]',
    src: '/icons/partners/noavari.svg',
  },
  {
    id: 'oloom',
    name: 'دانشگاه علوم پزشکی بوشهر',
    href: 'https://bpums.ac.ir/',
    width: 'w-[83px] sm:w-[110px]',
    src: '/icons/partners/oloom.svg',
  },
  {
    id: 'park',
    name: 'پارک علم و فناوری خلیج فارس',
    href: 'https://pgstp.ir/',
    width: 'w-[112px] sm:w-[149px]',
    src: '/icons/partners/park.svg',
  },
  {
    id: 'neybad',
    name: 'سکوی تامین مالی جمعی نی‌باد',
    href: 'https://neybadcrowd.ir/',
    width: 'w-[86px] sm:w-[115px]',
    src: '/icons/partners/neybad.svg',
  },
  {
    id: 'pgu',
    name: 'دانشگاه خلیج فارس',
    href: 'https://www.pgu.ac.ir',
    width: 'w-[61px] sm:w-[82px]',
    src: '/icons/partners/pgu.svg',
  },
  {
    id: 'riasat',
    name: 'معاونت علمی و فناوری ریاست جمهوری',
    href: 'https://isti.ir/',
    width: 'w-[73px] sm:w-[98px]',
    src: '/icons/partners/riasat.svg',
  },
  {
    id: 'sanaye',
    name: 'صندوق حمایت از صنایع پیشرفته',
    href: 'http://www.imf.ir/',
    width: 'w-[128px] sm:w-[171px]',
    src: '/icons/partners/sanaye.svg',
  },
]

const LogoBox = ({ logo, isClone }: { logo: LogoAsset; isClone?: boolean }) => {
  const content = (
    <Image
      src={logo.src}
      alt=""
      width={292}
      height={96}
      unoptimized
      className="pointer-events-none h-full w-full object-contain"
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
        className={`logo-strip-item relative flex h-20 shrink-0 items-center justify-center transition-opacity hover:opacity-80 sm:h-24 ${logo.width}`}
      >
        {content}
      </a>
    )
  }

  return (
    <div
      className={`logo-strip-item relative flex h-20 shrink-0 items-center justify-center sm:h-24 ${logo.width}`}
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

  useEffect(() => {
    const track = trackRef.current
    const firstSet = firstSetRef.current
    if (!track || !firstSet) return

    let cancelled = false
    let cleanup = () => {}
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        void import('gsap').then(({ default: gsap }) => {
          if (cancelled) return
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
          cleanup = () => {
            media.revert()
            gsap.set(track, { clearProps: 'transform' })
          }
        })
      },
      { rootMargin: '200px' },
    )
    observer.observe(track)

    return () => {
      cancelled = true
      observer.disconnect()
      cleanup()
    }
  }, [])

  return (
    <section className="relative z-10 w-full overflow-x-hidden py-8">
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
                <LogoBox key={`${setIndex}-${logo.id}`} logo={logo} isClone={setIndex > 0} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LogoStripSection
