'use client'

import { useEffect } from 'react'

export default function ScrollProvider() {
  useEffect(() => {
    let cancelled = false
    let cleanup = () => {}

    Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/ScrollSmoother')]).then(
      ([{ default: gsap }, { ScrollTrigger }, { ScrollSmoother }]) => {
        if (cancelled) return
        gsap.registerPlugin(ScrollTrigger, ScrollSmoother)
        const media = gsap.matchMedia()
        media.add('(min-width: 769px) and (prefers-reduced-motion: no-preference)', () => {
          const smoother = ScrollSmoother.create({
            smooth: 1.2,
            effects: true,
            smoothTouch: 0.1,
          })
          return () => smoother.kill()
        })
        cleanup = () => media.revert()
      },
    )

    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  return null
}
