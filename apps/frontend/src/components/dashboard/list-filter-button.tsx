'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useId, useState } from 'react'

import { DashboardCloseCircle, DashboardFilterIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
  /**
   * `select` (default) is a labelled field that narrows the list; `radio` is the
   * single-choice list of the template's «مرتب‌سازی بر اساس» block.
   */
  kind?: 'select' | 'radio'
  /** Counts as an applied filter. Defaults to true for selects and false for radios (a sort order). */
  countsAsFilter?: boolean
}

export interface ListFilterLink {
  label: string
  href: string
}

export interface ListFilterButtonProps {
  groups: ListFilterGroup[]
  /**
   * Client lists apply the choices themselves. Without it the button writes them
   * to the URL (and drops `page`), so back, refresh and sharing keep them.
   */
  onChange?: (key: string, value: string | undefined) => void
  label?: string
  /** Extra destinations listed under the filters (e.g. oversight views). */
  links?: ListFilterLink[]
  className?: string
}

const fa = (value: number) => value.toLocaleString('fa-IR')

const optionText = (option: ListFilterOption) =>
  typeof option.count === 'number' ? `${option.label} (${fa(option.count)})` : option.label

const isFilter = (group: ListFilterGroup) => group.countsAsFilter ?? group.kind !== 'radio'

const appliedOf = (groups: ListFilterGroup[]) =>
  Object.fromEntries(groups.map((group) => [group.key, group.value ?? '']))

/**
 * The one filter control of every dashboard list: Figma's filter template (design QA #276,
 * node 32291:40799). A filter button with the number of applied filters opens a panel with the
 * title and a close icon, one labelled field per filter, an optional single-choice «مرتب‌سازی»
 * block, and «اعمال» / «لغو». Nothing changes until «اعمال»; «لغو» and the close icon drop the draft.
 */
export function ListFilterButton({ groups, onChange, label = 'فیلتر', links = [], className }: ListFilterButtonProps) {
  const router = useRouter()
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>(() => appliedOf(groups))
  const activeCount = groups.filter((group) => isFilter(group) && group.value).length

  const openChange = (next: boolean) => {
    // Every opening starts from what is applied, so a dropped draft never lingers.
    if (next) setDraft(appliedOf(groups))
    setOpen(next)
  }

  // Read at apply time, so the button works inside any page without its own URL props.
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

  const apply = () => {
    const applied = appliedOf(groups)
    const changes: Record<string, string | undefined> = {}
    for (const group of groups) {
      if ((draft[group.key] ?? '') !== applied[group.key]) changes[group.key] = draft[group.key] || undefined
    }
    setOpen(false)
    if (Object.keys(changes).length === 0) return
    if (onChange) for (const [key, value] of Object.entries(changes)) onChange(key, value)
    else writeUrl(changes)
  }

  const accessibleLabel = activeCount ? `${label} (${fa(activeCount)} فیلتر فعال)` : label
  const fields = groups.filter((group) => group.kind !== 'radio')
  const radios = groups.filter((group) => group.kind === 'radio')

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
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
              className="absolute -top-1 -start-1 flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-white dark:bg-background dark:text-neutral-800 dark:shadow-xs dark:ring-1 dark:ring-neutral-200"
            >
              <Typography as="span" variant="12/regular" className="text-inherit">
                {fa(activeCount)}
              </Typography>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        align="start"
        aria-label={label}
        className="flex max-h-[80svh] w-80 max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-2xl border-neutral-100 p-4 shadow-filter-panel"
      >
        <div className="flex items-center justify-between">
          <Typography as="h2" variant="16/bold" color="neutral-700">
            فیلتر
          </Typography>
          <Button type="button" variant="text-gray" size="icon-32" aria-label="بستن فیلتر" onClick={() => setOpen(false)}>
            <DashboardCloseCircle aria-hidden="true" />
          </Button>
        </div>

        {fields.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <label htmlFor={`${fieldId}-${group.key}`}>
              <Typography as="span" variant="16/semibold" color="neutral-700">
                {group.label}
              </Typography>
            </label>
            <DashboardSelect
              id={`${fieldId}-${group.key}`}
              label={group.label}
              placeholder={`${group.label} را جستجو یا انتخاب کنید`}
              options={group.options.map((option) => ({ value: option.value, label: optionText(option) }))}
              value={draft[group.key] ?? ''}
              onChange={(value) => setDraft((current) => ({ ...current, [group.key]: value }))}
            />
          </div>
        ))}

        {radios.map((group) => (
          <React.Fragment key={group.key}>
            <hr className="border-neutral-100" />
            <div role="group" aria-labelledby={`${fieldId}-${group.key}-label`} className="flex flex-col gap-4">
              <Typography as="span" id={`${fieldId}-${group.key}-label`} variant="16/semibold" color="neutral-700">
                {group.label}
              </Typography>
              <RadioGroup
                value={draft[group.key] ?? ''}
                onValueChange={(value) => setDraft((current) => ({ ...current, [group.key]: value }))}
                aria-labelledby={`${fieldId}-${group.key}-label`}
                className="gap-4"
              >
                {group.options.map((option, index) => {
                  const id = `${fieldId}-${group.key}-${index}`
                  return (
                    <div key={`${index}:${option.value}`} className="flex items-center gap-2">
                      <RadioGroupItem id={id} value={option.value} />
                      <label htmlFor={id} className="flex-1 cursor-pointer">
                        <Typography as="span" variant="16/regular" color="neutral-700">
                          {optionText(option)}
                        </Typography>
                      </label>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>
          </React.Fragment>
        ))}

        {links.length > 0 && (
          <nav aria-label="نماهای دیگر" className="flex flex-col gap-1 border-t border-neutral-100 pt-3">
            {links.map((link) => (
              <Button key={link.href} asChild variant="text-gray" size="36" className="justify-start">
                <Link href={link.href}>
                  <Typography as="span" variant="14/regular" className="text-inherit">
                    {link.label}
                  </Typography>
                </Link>
              </Button>
            ))}
          </nav>
        )}

        {/* The page is RTL: the primary action comes first and sits on the right. */}
        <div className="flex items-center gap-2">
          <Button type="button" variant="primary" size="40" className="flex-1" onClick={apply}>
            اعمال
          </Button>
          <Button type="button" variant="outline" size="40" className="flex-1" onClick={() => setOpen(false)}>
            لغو
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
