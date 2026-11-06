'use client'

import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Typography } from '@/components/ui/typography'

export type BulkActionButton = {
  id: string
  label: string
  icon: ReactNode
  destructive?: boolean
  disabled?: boolean
}

const ENTER_SECONDS = 0.25
const EXIT_SECONDS = 0.2

/**
 * The icon-only actions of the selected rows, beside the list's filter button. They slide in
 * when rows are selected (the search field gives up the room) and slide out when none are;
 * the name of an action shows on hover only.
 */
export function BulkActionButtons({
  actions,
  active,
  onChoose,
}: {
  actions: BulkActionButton[]
  active: boolean
  onChoose: (id: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  const frame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active) setMounted(true)
  }, [active])

  useGSAP(
    () => {
      const element = frame.current
      if (!element) return
      // Without motion (reduced-motion, or no media support) the state simply settles.
      const motion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: no-preference)').matches
      if (!motion) {
        if (!active) setMounted(false)
        return
      }
      const tween = active
        ? gsap.fromTo(
            element,
            { width: 0, opacity: 0 },
            { width: 'auto', opacity: 1, duration: ENTER_SECONDS, ease: 'power2.out', clearProps: 'width,opacity' },
          )
        : gsap.to(element, {
            width: 0,
            opacity: 0,
            duration: EXIT_SECONDS,
            ease: 'power2.in',
            onComplete: () => setMounted(false),
          })
      return () => {
        tween.kill()
      }
    },
    { dependencies: [active, mounted], scope: frame },
  )

  if (!mounted) return null
  return (
    <TooltipProvider>
      <div
        ref={frame}
        role="group"
        aria-label="عملیات گروهی"
        className="flex shrink-0 flex-row-reverse gap-2 overflow-hidden"
      >
        {actions.map((action) => (
          <Tooltip key={action.id}>
            {/* The wrapper keeps the tooltip working while the button is disabled. */}
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="filter"
                  size="icon-48"
                  aria-label={action.label}
                  disabled={action.disabled}
                  className={
                    action.destructive
                      ? 'bg-error-50 text-error-500 hover:bg-error-100 hover:text-error-600 dark:border-error-200 dark:bg-error-50 dark:text-error-500 dark:hover:bg-error-100 dark:hover:text-error-600'
                      : 'text-brand-500 hover:text-brand-600 dark:text-fill-brand-foreground dark:hover:text-fill-brand-foreground'
                  }
                  onClick={() => onChoose(action.id)}
                >
                  {action.icon}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <Typography as="span" variant="12/regular" className="text-inherit">
                {action.label}
              </Typography>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
