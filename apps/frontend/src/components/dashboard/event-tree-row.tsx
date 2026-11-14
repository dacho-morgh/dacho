'use client'

import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { TreeArrowDownIcon, TreeArrowLeftIcon } from '@/components/icons'
import { Typography } from '@/components/ui/typography'

/**
 * One row of the titles tree (Figma Tree 31981:77616): 48px tall, a chevron at the start that points left when
 * the row is closed and down when it is open. Titles with children are SemiBold neutral-700, leaves Regular.
 */
export function TreeRow({
  title,
  expanded,
  onToggle,
  strong = false,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  strong?: boolean
}) {
  return (
    <div className="flex min-h-[48px] items-center gap-2 rounded-[8px] p-2">
      <Button
        type="button"
        variant="row"
        size="clear"
        onClick={onToggle}
        aria-expanded={expanded}
        className="min-h-[32px] flex-1 justify-start gap-2"
      >
        {expanded ? (
          <TreeArrowDownIcon className="size-4 shrink-0 text-neutral-800" />
        ) : (
          <TreeArrowLeftIcon className="size-4 shrink-0 text-neutral-800" />
        )}
        <Typography
          as="span"
          variant={strong ? '16/semibold' : '16/regular'}
          color={strong ? 'neutral-700' : 'neutral-600'}
          className="min-w-0 text-start"
        >
          {title}
        </Typography>
      </Button>
    </div>
  )
}
