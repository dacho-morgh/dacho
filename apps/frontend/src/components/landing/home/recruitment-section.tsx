'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Link from 'next/link'
import ShapeIcon from 'public/figma/recruitment/shape-icon'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const RecruitmentSection = () => {
  const sectionRef = useRef<HTMLElement>(null)
  const shapeRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const section = sectionRef.current
      const shape = shapeRef.current

      if (!section || !shape) return

      const paths = gsap.utils.toArray<SVGPathElement>('path', shape)
      if (paths.length === 0) return

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches

      if (reducedMotion) {
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

      return () => {
        section.removeEventListener('pointerenter', handlePointerEnter)
        activeTimeline?.kill()
        entranceTrigger.kill()
      }
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      dir="rtl"
      aria-labelledby="recruitment-title"
      className="relative z-10 mx-auto mt-20 flex min-h-64 w-[calc(100%-2rem)] max-w-280 items-center overflow-hidden rounded-[40px] bg-[linear-gradient(104.071deg,var(--brand-600)_21.93%,var(--brand-900)_98.384%)] px-6 py-10 sm:px-10 md:px-12 xl:px-20 xl:py-0"
    >
      <div
        ref={shapeRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 h-full w-235.25 -translate-x-1/2 select-none md:left-0 md:translate-x-0"
      >
        <ShapeIcon className="size-full max-w-none" />
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

        <div className="order-1 flex min-w-0 flex-col items-center gap-4 text-center md:order-2 md:items-end md:text-right">
          <Typography
            as="h2"
            id="recruitment-title"
            variant="24/bold"
            sm="32/bold"
            color="white"
            className="sm:leading-12.5 lg:font-semibold"
          >
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
