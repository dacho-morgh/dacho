'use client'

import { getDefaultClassNames, type DayButtonProps } from '@daypicker/react'
import { DayPicker } from '@daypicker/persian'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

type CalendarProps = React.ComponentProps<typeof DayPicker>

/** One day: the shared calendar-day Button, chosen day aria-pressed, today bordered. */
function CalendarDayButton({ day: _day, modifiers, className, children, ...props }: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      aria-pressed={modifiers.selected || undefined}
      className={cn('mx-auto size-9', className)}
      data-today={modifiers.today || undefined}
      ref={ref}
      size="icon-36"
      type="button"
      variant="day"
      {...props}
    >
      <Typography as="span" variant="14/regular">
        {children}
      </Typography>
    </Button>
  )
}

/**
 * The shadcn/ui Calendar on top of the Persian (Jalali) DayPicker: the grid,
 * month names and numerals are Shamsi, the week starts on Saturday and the
 * layout is right to left. It draws the day grid only; the month/year header
 * belongs to the caller (`jalali-date-picker.tsx`), which passes `month` and
 * `hideNavigation`. `DayPicker` hands out plain `Date`s (the Gregorian instant
 * of the chosen day); the picker turns those into the `YYYY/MM/DD` strings the
 * app stores.
 */
function Calendar({ className, classNames, showOutsideDays = false, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames()

  return (
    <DayPicker
      className={cn('p-0', className)}
      classNames={{
        root: cn('w-full', defaults.root),
        months: cn('flex w-full flex-col', defaults.months),
        month: cn('flex w-full flex-col gap-1', defaults.month),
        month_caption: 'hidden',
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn(
          'flex h-8 flex-1 items-center justify-center text-xs font-normal text-neutral-500 select-none',
          defaults.weekday,
        ),
        week: cn('flex w-full', defaults.week),
        day: cn('flex flex-1 justify-center p-0 select-none', defaults.day),
        day_button: defaults.day_button,
        today: cn('[&>button]:border-brand-500', defaults.today),
        disabled: cn('[&>button]:cursor-not-allowed [&>button]:text-neutral-300', defaults.disabled),
        hidden: cn('invisible', defaults.hidden),
        ...classNames,
      }}
      components={{ DayButton: CalendarDayButton }}
      hideNavigation
      showOutsideDays={showOutsideDays}
      {...props}
    />
  )
}

export { Calendar }
export type { CalendarProps }
