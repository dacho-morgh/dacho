'use client'

import { useEffect, useRef, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Extra classes for the wrapper element. */
  className?: string
  /** Delay in seconds before the reveal starts. */
  delay?: number
  /** Vertical travel distance in pixels. */
  distance?: number
}

/**
 * Fades content up once it scrolls into the viewport.
 *
 * Client-side animation shell: keep data-fetching sections as Server
 * Components and pass them in as `children` — they stay out of the
 * client bundle and render on the server.
 */
const Reveal = ({ children, className, delay = 0.3, distance = 48 }: RevealProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
      if (typeof window === 'undefined' || window.matchMedia('(max-width: 767px)').matches) return
      const wrapper = wrapperRef.current
      if (!wrapper) return
      let cancelled = false
      let cleanup = () => {}
      void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ default: gsap }, { ScrollTrigger }]) => {
        if (cancelled) return
        gsap.registerPlugin(ScrollTrigger)
        const media = gsap.matchMedia()
        media.add(
        {
          desktop: '(min-width: 768px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { desktop, reduceMotion } = context.conditions as {
            desktop: boolean
            reduceMotion: boolean
          }

          if (!desktop || reduceMotion) {
            gsap.set(wrapper, { clearProps: 'opacity,transform,visibility' })
            return
          }

          gsap.fromTo(
            wrapper,
            { autoAlpha: 0, y: distance },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.9,
              delay,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: wrapper,
                start: 'top bottom',
                once: true,
              },
            },
          )
        },
        )
        cleanup = () => media.revert()
      })
      return () => { cancelled = true; cleanup() }
  }, [delay, distance])

  return (
    <div ref={wrapperRef} className={className}>
      {children}
    </div>
  )
}

export default Reveal
