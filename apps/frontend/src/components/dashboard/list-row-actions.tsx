'use client'

import Link from 'next/link'
import React, { useState } from 'react'

import { DashboardMoreVerticalIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Typography } from '@/components/ui/typography'

/** One action of a list row: a link when it has `href`, otherwise it runs `onSelect`. */
export interface RowAction {
  id: string
  label: string
  icon?: React.ReactNode
  href?: string
  destructive?: boolean
  onSelect?: () => void
}

/**
 * A row's actions (design QA #276). Two or more go into the «more» menu; a row with exactly
 * one action shows it directly, because a menu with one item only hides it. Clicks stay inside:
 * the row's own click (open the detail page) never fires for an action.
 */
export function RowActions({
  actions,
  menuLabel = 'عملیات',
  className,
}: {
  actions: RowAction[]
  /** The accessible name of the «more» button. */
  menuLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (actions.length === 0) return null

  if (actions.length === 1) {
    const [action] = actions as [RowAction]
    const variant = action.destructive ? 'text-destructive' : 'text'
    const label = (
      <Typography as="span" variant="14/semibold" className="whitespace-nowrap text-inherit">
        {action.label}
      </Typography>
    )
    return (
      <span data-row-ignore="" className={className} onClick={(event) => event.stopPropagation()}>
        {action.href ? (
          <Button asChild variant={variant} size="32">
            <Link href={action.href}>{label}</Link>
          </Button>
        ) : (
          <Button type="button" variant={variant} size="32" onClick={action.onSelect}>
            {label}
          </Button>
        )}
      </span>
    )
  }

  return (
    <span data-row-ignore="" className={className} onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="text-gray" size="icon-32" aria-label={menuLabel} title={menuLabel}>
            <DashboardMoreVerticalIcon aria-hidden="true" className="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          dir="rtl"
          align="start"
          className="flex w-48 flex-col gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {actions.map((action) => {
            const variant = action.destructive ? 'text-destructive' : 'text-gray'
            const content = (
              <>
                {action.icon}
                <Typography as="span" variant="14/regular" className="text-inherit">
                  {action.label}
                </Typography>
              </>
            )
            return action.href ? (
              <Button key={action.id} asChild variant={variant} size="40" className="w-full justify-start px-3">
                <Link href={action.href} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              </Button>
            ) : (
              <Button
                key={action.id}
                type="button"
                variant={variant}
                size="40"
                className="w-full justify-start px-3"
                onClick={() => {
                  setOpen(false)
                  action.onSelect?.()
                }}
              >
                {content}
              </Button>
            )
          })}
        </PopoverContent>
      </Popover>
    </span>
  )
}
