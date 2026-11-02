'use client'

import { useRouter } from 'next/navigation'
import React from 'react'

import { DashboardFilterIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Typography } from '@/components/ui/typography'

export interface ListFilterOption {
  /** '' is the "all" choice of a group. */
  value: string
  label: string
  count?: number
}

export interface ListFilterGroup {
  /** URL parameter name in URL mode. */
  key: string
  label: string
  options: ListFilterOption[]
  /** The applied value; undefined or '' means no filter from this group. */
  value?: string
}

export interface ListFilterButtonProps {
  groups: ListFilterGroup[]
  /**
   * Client lists apply the choice themselves. Without it the button writes the
   * choice to the URL (and drops `page`), so back, refresh and sharing keep it.
   */
  onChange?: (key: string, value: string | undefined) => void
  onClear?: () => void
  label?: string
  className?: string
}

const fa = (value: number) => value.toLocaleString('fa-IR')

/**
 * The one filter control of every dashboard list (FE35): a filter Button with
 * the number of applied filters, opening one radio group per filter (with its
 * counts) and a single "clear all".
 */
export function ListFilterButton({ groups, onChange, onClear, label = 'فیلتر', className }: ListFilterButtonProps) {
  const router = useRouter()
  const activeCount = groups.filter((group) => group.value).length

  // Read at choice time, so the button works inside any page without its own URL props.
  const writeUrl = (changes: Record<string, string | undefined>) => {
    const { pathname, search } = window.location
    const next = new URLSearchParams(search)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('page')
    const query = next.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  const choose = (key: string, value: string) => {
    const applied = value || undefined
    if (onChange) onChange(key, applied)
    else writeUrl({ [key]: applied })
  }

  const clear = () => {
    if (onClear) onClear()
    else if (onChange) for (const group of groups) onChange(group.key, undefined)
    else writeUrl(Object.fromEntries(groups.map((group) => [group.key, undefined])))
  }

  const accessibleLabel = activeCount ? `${label} (${fa(activeCount)} فیلتر فعال)` : label

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="filter"
          size="icon-48"
          data-active={activeCount > 0}
          aria-label={accessibleLabel}
          title={accessibleLabel}
          className={className ? `relative ${className}` : 'relative'}
        >
          <DashboardFilterIcon aria-hidden="true" />
          {activeCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -left-1 flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-white"
            >
              <Typography as="span" variant="12/regular" className="text-inherit">
                {fa(activeCount)}
              </Typography>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70svh] w-64 overflow-y-auto">
        {groups.map((group, index) => (
          <React.Fragment key={group.key}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>
              <Typography as="span" variant="12/regular" color="neutral-500">
                {group.label}
              </Typography>
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={group.value ?? ''} onValueChange={(value) => choose(group.key, value)}>
              {group.options.map((option) => (
                <DropdownMenuRadioItem key={option.value || 'all'} value={option.value}>
                  <Typography as="span" variant="14/regular" className="flex-1 text-inherit">
                    {option.label}
                  </Typography>
                  {typeof option.count === 'number' && (
                    <Typography as="span" variant="12/regular" color="neutral-500">
                      {fa(option.count)}
                    </Typography>
                  )}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </React.Fragment>
        ))}
        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={clear}>
              <Typography as="span" variant="14/regular" color="error">
                حذف همه فیلترها
              </Typography>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
