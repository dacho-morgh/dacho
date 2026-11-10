'use client'

import { ChevronDown } from 'lucide-react'
import * as React from 'react'
import { RequiredMark } from '@/components/ui/field'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Typography, typographyVariants } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

export type ComboboxFieldProps = {
  label: string
  placeholder: string
  options: readonly string[]
  /** The chosen option, or '' — never free text. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  id?: string
  name?: string
  required?: boolean
  /** Keep `aria-required` but draw no `*` (a form where every field is required). */
  hideRequiredMark?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  emptyText?: string
  wrapperClassName?: string
  containerClassName?: string
}

/** Folds Arabic letter forms, half-spaces and spaces so «بندر عباس» finds «بندرعباس». */
function fold(text: string): string {
  return text
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌\s]/g, '')
    .toLocaleLowerCase()
}

/**
 * A labelled searchable dropdown laid out like <Input>: the person types into
 * the field and the list narrows to the options that contain the text; picking
 * one stores it. The value is always one of `options` (or ''), so free text can
 * never reach the form. Arrow keys move through the list, Enter picks, Escape
 * closes.
 */
const ComboboxField = React.forwardRef<HTMLInputElement, ComboboxFieldProps>(
  (
    {
      label,
      placeholder,
      options,
      value,
      onChange,
      onBlur,
      id,
      name,
      required,
      hideRequiredMark,
      disabled,
      error,
      hint,
      emptyText = 'موردی پیدا نشد',
      wrapperClassName,
      containerClassName,
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const listId = `${inputId}-listbox`
    const helperId = error || hint ? `${inputId}-description` : undefined

    const [open, setOpen] = React.useState(false)
    const [text, setText] = React.useState(value)
    // The list shows every option until the person types; only typing filters.
    const [typed, setTyped] = React.useState(false)
    const [activeIndex, setActiveIndex] = React.useState(0)
    const wrapperRef = React.useRef<HTMLDivElement>(null)
    const listRef = React.useRef<HTMLUListElement>(null)
    // The latest stored value, for handlers that run from a stale render (blur, outside click).
    const valueRef = React.useRef(value)
    valueRef.current = value

    // The value can change from outside (the province resets the city).
    React.useEffect(() => {
      setText(value)
      setTyped(false)
    }, [value])

    const visible = React.useMemo(() => {
      const query = fold(text)
      if (!typed || !query) return options
      return options.filter((option) => fold(option).includes(query))
    }, [options, text, typed])

    React.useEffect(() => {
      if (!open) return
      listRef.current
        ?.querySelector<HTMLElement>('[data-active="true"]')
        // (jsdom has no scrollIntoView)
        ?.scrollIntoView?.({ block: 'nearest' })
    }, [activeIndex, open])

    const choose = (option: string) => {
      setText(option)
      setTyped(false)
      setOpen(false)
      if (option !== valueRef.current) onChange(option)
    }

    const openList = () => {
      if (disabled) return
      const index = options.indexOf(value)
      setActiveIndex(index >= 0 && !typed ? index : 0)
      setOpen(true)
    }

    const settle = () => {
      setOpen(false)
      const exact = options.find((option) => fold(option) === fold(text))
      if (exact && text.trim()) choose(exact)
      else {
        // Free text is never a value: fall back to what is stored.
        setText(value)
        setTyped(false)
      }
      onBlur?.()
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!open) return openList()
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActiveIndex((current) => (visible.length ? (current + step + visible.length) % visible.length : 0))
      } else if (event.key === 'Enter' && open) {
        const option = visible[activeIndex]
        // Enter picks the highlighted option; it must not also advance the step.
        event.preventDefault()
        if (option) choose(option)
      } else if (event.key === 'Escape' && open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        setText(value)
        setTyped(false)
      }
    }

    return (
      <div
        data-slot="combobox-field"
        dir="rtl"
        className={cn('flex w-full flex-col gap-2 text-right', wrapperClassName)}
        ref={wrapperRef}
      >
        <Typography
          as="label"
          htmlFor={inputId}
          variant="16/regular"
          color="neutral-600"
          className="cursor-pointer select-none"
        >
          {label}
          {required && !hideRequiredMark ? <RequiredMark className="ms-0.5" /> : null}
        </Typography>

        <div className="flex w-full flex-col gap-1">
          <Popover open={open && !disabled} onOpenChange={(next) => !next && settle()}>
            <PopoverAnchor asChild>
              <div
                data-slot="input-container"
                data-invalid={error ? 'true' : undefined}
                className={cn(
                  'group relative flex h-12 w-full items-center gap-2 rounded-lg border border-neutral-200 bg-background px-3 py-2 transition-colors duration-150 focus-within:border-brand-500 hover:border-brand-500 data-[invalid=true]:border-error-100 data-[invalid=true]:focus-within:border-error-500',
                  disabled && 'cursor-not-allowed border-neutral-100 bg-neutral-50 hover:border-neutral-100',
                  containerClassName,
                )}
              >
                <input
                  ref={ref}
                  id={inputId}
                  name={name}
                  type="text"
                  dir="rtl"
                  role="combobox"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-expanded={open}
                  aria-activedescendant={open && visible[activeIndex] ? `${listId}-${activeIndex}` : undefined}
                  aria-describedby={helperId}
                  aria-invalid={error ? true : undefined}
                  aria-required={required || undefined}
                  disabled={disabled}
                  placeholder={placeholder}
                  value={text}
                  onChange={(event) => {
                    const next = event.target.value
                    setText(next)
                    setTyped(true)
                    setActiveIndex(0)
                    setOpen(true)
                    // What is typed is not yet a choice: drop the stored one.
                    if (value) onChange('')
                  }}
                  onClick={() => !open && openList()}
                  onFocus={(event) => {
                    event.currentTarget.select()
                    openList()
                  }}
                  onBlur={(event) => {
                    // Focus moving into the list (it is portalled) is not leaving the field.
                    const next = event.relatedTarget as HTMLElement | null
                    if (next?.closest('[data-slot="combobox-list"]')) return
                    settle()
                  }}
                  onKeyDown={onKeyDown}
                  className={cn(
                    typographyVariants({ variant: '16/regular', color: 'neutral-800' }),
                    'min-w-0 flex-1 bg-transparent text-right outline-none placeholder:font-light placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400',
                  )}
                />
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none size-5 shrink-0 text-neutral-400 transition-transform',
                    open && 'rotate-180',
                  )}
                />
              </div>
            </PopoverAnchor>

            <PopoverContent
              dir="rtl"
              align="start"
              sideOffset={4}
              className="w-(--radix-popover-trigger-width) p-1"
              data-slot="combobox-list"
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              // Focus leaving the field is handled by the input's own blur; the list
              // must not also be dismissed by a stray focus event elsewhere.
              onFocusOutside={(event) => event.preventDefault()}
              onInteractOutside={(event) => {
                // A click on the field itself keeps the list open.
                if (wrapperRef.current?.contains(event.target as Node)) event.preventDefault()
              }}
            >
              <ul
                id={listId}
                ref={listRef}
                role="listbox"
                aria-label={label}
                className="m-0 max-h-60 list-none overflow-y-auto p-0"
              >
                {visible.length === 0 ? (
                  <li
                    role="presentation"
                    className={cn(
                      typographyVariants({ variant: '14/regular', color: 'neutral-500' }),
                      'px-3 py-2 text-center',
                    )}
                  >
                    {emptyText}
                  </li>
                ) : (
                  visible.map((option, index) => (
                    <li
                      key={option}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={option === value}
                      data-active={index === activeIndex ? 'true' : undefined}
                      // Keep focus in the input so the field is not "left" by a click.
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(option)}
                      className={cn(
                        typographyVariants({ variant: '16/regular', color: 'neutral-700' }),
                        'cursor-pointer rounded-md px-3 py-2 text-right data-[active=true]:bg-neutral-100 aria-selected:font-semibold aria-selected:text-brand-500',
                      )}
                    >
                      {option}
                    </li>
                  ))
                )}
              </ul>
            </PopoverContent>
          </Popover>

          {(error || hint) && (
            <Typography
              as="p"
              id={helperId}
              variant="12/light"
              color={error ? 'error' : 'neutral-500'}
              className="w-full transition-colors"
            >
              {error || hint}
            </Typography>
          )}
        </div>
      </div>
    )
  },
)
ComboboxField.displayName = 'ComboboxField'

export { ComboboxField }
