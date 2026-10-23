'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, type ReactNode } from 'react'
import { HOME_EASE_OUT, HOME_REVEAL_DURATION, HOME_STAGGER } from './home-motion'

/** Keep CMS sections server rendered; only their motion belongs in this client shell. */
export default function HomeReveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const scope = useRef<HTMLDivElement>(null)
  const revealed = useRef(new WeakSet<Element>())

  useGSAP(
    (_context, contextSafe) => {
      const root = scope.current
      if (!root || !contextSafe) return

      const media = gsap.matchMedia()
      media.add(
        {
          desktop: '(min-width: 768px)',
          reduce: '(prefers-reduced-motion: reduce)',
          always: '(min-width: 0px)',
        },
        (context) => {
          const { desktop, reduce } = context.conditions!
          const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-home-reveal]'))
          const pending = targets.filter((target) => {
            // Never hide content the visitor is already reading after hydration or a resize.
            if (
              revealed.current.has(target) ||
              target.getBoundingClientRect().top < window.innerHeight
            ) {
              revealed.current.add(target)
              return false
            }
            return true
          })

          gsap.set(pending, {
            opacity: reduce ? 0.65 : 0,
            ...(desktop && !reduce ? { transform: 'translate3d(0, 8px, 0)' } : {}),
          })

          const observer = new IntersectionObserver(
            contextSafe((entries: IntersectionObserverEntry[]) => {
              const entering = entries
                .filter((entry) => entry.isIntersecting)
                .map((entry) => entry.target)
              if (!entering.length) return
              entering.forEach((target) => {
                observer.unobserve(target)
                revealed.current.add(target)
              })
              gsap.to(entering, {
                opacity: 1,
                ...(desktop && !reduce ? { transform: 'translate3d(0, 0, 0)' } : {}),
                duration: reduce ? 0.2 : HOME_REVEAL_DURATION,
                stagger: reduce ? 0 : HOME_STAGGER,
                ease: HOME_EASE_OUT,
                clearProps: 'opacity,transform',
                overwrite: 'auto',
              })
            }),
            { threshold: 0, rootMargin: '0px 0px -32px 0px' },
          )
          pending.forEach((target) => observer.observe(target))

          // Tabbing into a section must never focus an invisible link or button.
          const showFocusedContent = contextSafe((event: FocusEvent) => {
            if (!(event.target instanceof Element)) return
            targets
              .filter((target) => target.contains(event.target as Node))
              .forEach((target) => {
                observer.unobserve(target)
                revealed.current.add(target)
                gsap.killTweensOf(target)
                gsap.set(target, { clearProps: 'opacity,transform' })
              })
          })
          root.addEventListener('focusin', showFocusedContent)

          return () => {
            observer.disconnect()
            root.removeEventListener('focusin', showFocusedContent)
            gsap.killTweensOf(targets)
            gsap.set(targets, { clearProps: 'opacity,transform' })
          }
        },
      )

      return () => media.revert()
    },
    { scope },
  )

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  )
}
