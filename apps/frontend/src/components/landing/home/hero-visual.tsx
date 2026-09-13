'use client'

import { useEffect, useRef } from 'react'
import HeroProofCard from '@/components/landing/home/hero-proof-card'

const HeroVisual = ({ children }: { children?: React.ReactNode }) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const proofFieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const supportsCursorMotion = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (reducedMotion.matches || !supportsCursorMotion.matches) return
    let cancelled = false
    let cleanup = () => {}
    void import('gsap').then(({ default: gsap }) => {
      if (cancelled) return
      const panel = panelRef.current
      const proofField = proofFieldRef.current

      if (!panel || !proofField) return

      const proofCards = gsap.utils.toArray<HTMLElement>('[data-hero-proof]', proofField)
      const gravityCards = gsap.utils.toArray<HTMLElement>('[data-gravity-card]', proofField)
      if (proofCards.length === 0) return

      gsap.set(panel, { perspective: 1000 })

      gsap.fromTo(
        proofCards,
        { autoAlpha: 0, y: 16, scale: 0.97 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.55,
          stagger: 0.1,
          delay: 0.2,
          ease: 'power3.out',
        },
      )

      if (!supportsCursorMotion) return

      const logo = panel.querySelector<HTMLElement>('img')
      const moveLogoX = logo
        ? gsap.quickTo(logo, 'x', { duration: 0.7, ease: 'power3.out' })
        : () => {}
      const moveLogoY = logo
        ? gsap.quickTo(logo, 'y', { duration: 0.7, ease: 'power3.out' })
        : () => {}
      const rotateLogoX = logo
        ? gsap.quickTo(logo, 'rotationX', { duration: 0.7, ease: 'power3.out' })
        : () => {}
      const rotateLogoY = logo
        ? gsap.quickTo(logo, 'rotationY', { duration: 0.7, ease: 'power3.out' })
        : () => {}
      const gravityControllers = gravityCards.map((card) => ({
        card,
        moveX: gsap.quickTo(card, 'x', { duration: 0.7, ease: 'power3.out' }),
        moveY: gsap.quickTo(card, 'y', { duration: 0.7, ease: 'power3.out' }),
      }))

      const resetPosition = () => {
        moveLogoX(0)
        moveLogoY(0)
        rotateLogoX(0)
        rotateLogoY(0)
        gravityControllers.forEach(({ moveX, moveY }) => {
          moveX(0)
          moveY(0)
        })
      }

      const handlePointerMove = (event: PointerEvent) => {
        const bounds = panel.getBoundingClientRect()
        const pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
        const pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

        moveLogoX(pointerX * 12)
        moveLogoY(pointerY * 10)
        rotateLogoX(pointerY * -4)
        rotateLogoY(pointerX * 4)
        gravityControllers.forEach(({ card, moveX, moveY }, index) => {
          const cardBounds = card.getBoundingClientRect()
          const cardCenterX = cardBounds.left + cardBounds.width / 2
          const cardCenterY = cardBounds.top + cardBounds.height / 2
          const distanceX = event.clientX - cardCenterX
          const distanceY = event.clientY - cardCenterY
          const distance = Math.hypot(distanceX, distanceY)
          const proximity = 1 - Math.min(distance / 420, 1)
          const strength = 0.07 + index * 0.015

          moveX(distanceX * proximity * strength)
          moveY(distanceY * proximity * strength)
        })
      }

      panel.addEventListener('pointermove', handlePointerMove)
      panel.addEventListener('pointerleave', resetPosition)

      cleanup = () => {
        panel.removeEventListener('pointermove', handlePointerMove)
        panel.removeEventListener('pointerleave', resetPosition)
        gsap.killTweensOf([...proofCards, ...gravityCards])
      }
    })
    return () => { cancelled = true; cleanup() }
  }, [])

  return (
    <div
      ref={panelRef}
      className="relative mx-auto flex h-[clamp(420px,47vw,600px)] w-full max-w-160 flex-1 items-center justify-center overflow-hidden rounded-[48px] lg:order-2 lg:rounded-[80px]"
    >
      <div ref={proofFieldRef} className="pointer-events-none absolute inset-0 z-10">
        <div
          data-gravity-card
          className="absolute top-0 right-3 h-15 w-63 max-w-[calc(100%-32px)] will-change-transform sm:h-17 sm:w-75 lg:top-10 lg:h-19.5 lg:w-87.75"
        >
          <HeroProofCard metric="۱۰+" message="از همکاری با ما راضی بودند" />
        </div>
        <div
          data-gravity-card
          className="absolute bottom-1 left-7 h-15 w-62 max-w-[calc(100%-32px)] will-change-transform lg:bottom-10 lg:left-10 lg:h-19.5 lg:w-87.75"
        >
          <HeroProofCard metric="۵۰+" message="فرصت تازه برای پیشرفت" />
        </div>
      </div>

      {children}
    </div>
  )
}

export default HeroVisual
