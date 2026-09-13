'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ShapeIcon, ShapeIconDark } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

type RecruitmentSectionProps = {
  variant?: 'blue' | 'gold'
}

const gradientClasses = {
  blue: 'bg-[linear-gradient(104.071deg,var(--brand-600)_21.93%,var(--brand-900)_98.384%)]',
  gold: 'bg-neutral-800 bg-[radial-gradient(circle_at_4%_39%,rgba(193,132,4,0.52)_0%,rgba(193,132,4,0.28)_24%,transparent_56%),radial-gradient(circle_at_29%_-6%,rgba(250,182,34,0.34)_0%,transparent_44%)]',
} as const

const RecruitmentSection = ({ variant = 'blue' }: RecruitmentSectionProps) => {
  const sectionRef = useRef<HTMLElement>(null)
  const shapeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let cleanup = () => {}
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ default: gsap }, { ScrollTrigger }]) => {
        if (cancelled) return
        const section = sectionRef.current
        const shape = shapeRef.current

        if (!section || !shape) return
        gsap.registerPlugin(ScrollTrigger)

        const paths = gsap.utils.toArray<SVGPathElement>('path', shape)
        if (paths.length === 0) return

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const isMobile = window.matchMedia('(max-width: 768px)').matches
        const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches

        if (reducedMotion || isMobile) {
          gsap.set(paths, { clearProps: 'clipPath,opacity' })
          return
        }

        let activeTimeline: gsap.core.Timeline | null = null

        const runFillCycle = () => {
          activeTimeline?.kill()

          activeTimeline = gsap
            .timeline()
            .to(paths, {
              clipPath: 'inset(0 100% 0 0)',
              opacity: 0,
              duration: 0.35,
              stagger: { each: 0.025, from: 'end' },
              ease: 'power2.out',
            })
            .to(paths, {
              clipPath: 'inset(0 0% 0 0)',
              opacity: 1,
              duration: 2,
              stagger: 0.075,
              ease: 'power2.inOut',
            })
        }

        const entranceTrigger = ScrollTrigger.create({
          trigger: section,
          start: 'top 85%',
          once: true,
          onEnter: runFillCycle,
        })

        const handlePointerEnter = () => {
          runFillCycle()
        }

        if (supportsHover) {
          section.addEventListener('pointerenter', handlePointerEnter)
        }

        cleanup = () => {
          section.removeEventListener('pointerenter', handlePointerEnter)
          activeTimeline?.kill()
          entranceTrigger.kill()
        }
      },
    )
    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      dir="rtl"
      aria-labelledby="recruitment-title"
      className={`relative z-10 mx-auto flex min-h-64 w-[calc(100%-2rem)] max-w-280 items-center overflow-hidden rounded-[40px] px-6 py-10 sm:px-10 md:px-12 xl:h-64 xl:px-20 xl:py-0 ${gradientClasses[variant]}`}
    >
      <div
        ref={shapeRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 h-full w-235.25 -translate-x-1/2 select-none md:left-0 md:translate-x-0"
      >
        {variant === 'gold' ? (
          <ShapeIconDark className="size-full max-w-none text-secondary-50" />
        ) : (
          <ShapeIcon className="size-full max-w-none text-brand-50" />
        )}
      </div>

      <div
        dir="ltr"
        className="relative z-10 grid w-full items-center gap-8 md:grid-cols-[160px_minmax(0,1fr)] md:gap-12 xl:grid-cols-[160px_minmax(0,702px)] xl:gap-24.5"
      >
        <div className="order-2 flex justify-center md:order-1 md:justify-start">
          <Button asChild variant="white" size="48" className="w-40 font-light">
            <Link href="/cooperation">ارسال رزومه</Link>
          </Button>
        </div>

        <div
          dir="rtl"
          className="order-1 flex min-w-0 flex-col items-center gap-4 text-center md:order-2 md:items-start md:text-right"
        >
          <Typography as="h2" id="recruitment-title" variant="24/bold" sm="32/bold" color="white">
            مشتاق همکاری با شما هستیم
          </Typography>
          <Typography variant="16/regular" sm="20/regular" color="white" className="max-w-175.5">
            در صورت تمایل به همکاری با کارخانه نوآوری صنایع انرژی بوشهر رزومه خود را برای ما
            بفرستید.
          </Typography>
        </div>
      </div>
    </section>
  )
}

export default RecruitmentSection
