'use client'

import type gsap from 'gsap'
import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import type { LogoAsset } from './logo-strip-data'

const PIXELS_PER_SECOND = 60

const LogoBox = ({ logo, isClone }: { logo: LogoAsset; isClone?: boolean }) => {
  const content = (
    <span
      aria-hidden="true"
      className="pointer-events-none h-full w-full bg-current [mask-image:var(--logo-mask)] mask-alpha mask-contain mask-center mask-no-repeat [-webkit-mask-image:var(--logo-mask)]"
      style={{ '--logo-mask': `url(${JSON.stringify(logo.src)})` } as CSSProperties}
    />
  )

  if (logo.href) {
    return (
      <a
        href={logo.href}
        target={logo.newTab ? '_blank' : undefined}
        rel={logo.newTab ? 'noopener noreferrer' : undefined}
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

const LogoStripSectionClient = ({ logos }: { logos: LogoAsset[] }) => {
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
  }, [logos])

  return (
    <section className="relative z-10 w-full overflow-x-hidden py-8 text-neutral-500">
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

export default LogoStripSectionClient
