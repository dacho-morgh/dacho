'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/utilities/ui'

/**
 * The frame of every list table (design QA #276, Figma 30852:17813): it fills the height the page
 * leaves, so a short list still ends at the bottom of the page instead of hugging its rows, and
 * only the rows scroll inside it. The page around it must be a column with `min-h-0 flex-1`.
 */
export function ListTableFrame({
  className,
  scrollClassName,
  children,
  ...props
}: React.ComponentProps<'section'> & { scrollClassName?: string }) {
  return (
    <section
      data-slot="list-table-frame"
      className={cn(
        'relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-background',
        className,
      )}
      {...props}
    >
      <ScrollArea className={cn('min-h-0 min-w-0 flex-1', scrollClassName)}>{children}</ScrollArea>
    </section>
  )
}

/** What inside a row keeps its own click: links, buttons, fields and anything marked `data-row-ignore`. */
const OWN_CLICK =
  'a,button,input,select,textarea,label,summary,[role="button"],[role="menuitem"],[role="checkbox"],[data-row-ignore]'

/**
 * Props that make a whole row (or card) run `open` (design QA #276): a click, or Enter on the
 * focused row. A click on a link, button or field inside the row does its own thing, and a click
 * that bubbles from a dialog or menu portaled out of the row is not the row's. `newTab` is true
 * for a ctrl/cmd click.
 */
export function rowActivationProps(open?: (newTab: boolean) => void) {
  if (!open) return {}
  return {
    tabIndex: 0,
    'data-row-link': '',
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as Element
      if (event.defaultPrevented || !event.currentTarget.contains(target)) return
      const own = target.closest(OWN_CLICK)
      if (own && own !== event.currentTarget && event.currentTarget.contains(own)) return
      // A text selection made by dragging is not a click on the row.
      if (window.getSelection()?.toString()) return
      open(event.metaKey || event.ctrlKey)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault()
      open(false)
    },
  }
}

/** A whole row that opens the page at `href`. */
export function useRowLink(href?: string) {
  const router = useRouter()
  return rowActivationProps(
    href
      ? (newTab) => {
          if (newTab) window.open(href, '_blank', 'noopener,noreferrer')
          else router.push(href)
        }
      : undefined,
  )
}

const ROW_CLASS =
  'h-[72px] border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 data-[state=selected]:bg-brand-50/50'

/** A table row with the shared hover; with `href` the whole row opens that page. */
export function ListRow({ href, className, ...props }: React.ComponentProps<'tr'> & { href?: string }) {
  const link = useRowLink(href)
  return <tr className={cn(ROW_CLASS, href && 'cursor-pointer', className)} {...link} {...props} />
}
