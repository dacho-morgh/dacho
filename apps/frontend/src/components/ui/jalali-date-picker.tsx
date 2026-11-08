'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { RequiredMark } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Typography, typographyVariants } from '@/components/ui/typography'
import { toPersianDigits } from '@/utilities/digits'
import {
  compareJalali,
  formatJalali,
  formatJalaliDisplay,
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  jalaliMonthLength,
  jalaliWeekdayIndex,
  parseJalali,
  toGregorian,
  toJalali,
  todayJalali,
  type JalaliDate,
} from '@/utilities/jalali'
import { cn } from '@/utilities/ui'

export type JalaliDatePickerProps = {
  label: string
  placeholder?: string
  /** The stored value: `YYYY/MM/DD` (Jalali, ASCII digits) or ''. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  id?: string
  name?: string
  required?: boolean
  disabled?: boolean
  error?: string
  hint?: string
  /** The latest selectable day (default: today in Tehran). */
  maxDate?: JalaliDate
  /** The earliest selectable year (default: 1300). */
  minYear?: number
  wrapperClassName?: string
  containerClassName?: string
}

function addDays(date: JalaliDate, days: number): JalaliDate {
  const gregorian = toGregorian(date.year, date.month, date.day)
  const shifted = new Date(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day + days))
  return toJalali(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

function addMonths(date: JalaliDate, months: number): JalaliDate {
  const index = date.year * 12 + (date.month - 1) + months
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  return { year, month, day: Math.min(date.day, jalaliMonthLength(year, month)) }
}

const sameDay = (left: JalaliDate | null, right: JalaliDate) =>
  left !== null && compareJalali(left, right) === 0

function dayLabel(date: JalaliDate): string {
  const weekday = JALALI_WEEKDAYS[jalaliWeekdayIndex(date.year, date.month, date.day)].full
  return `${weekday} ${toPersianDigits(date.day)} ${JALALI_MONTHS[date.month - 1]} ${toPersianDigits(date.year)}`
}

/**
 * A Jalali (Shamsi) date field: a form-styled button that opens a calendar in a
 * popover. The week starts on Saturday, digits are Persian, the month and year
 * can be jumped to from two dropdowns (founding dates are decades back), and
 * days after `maxDate` cannot be chosen. The value is the same `YYYY/MM/DD`
 * string the profile stores, so no Gregorian `Date` is ever involved.
 *
 * Keyboard: arrows move by day (the row runs right to left, so ArrowLeft is the
 * next day), Up/Down by week, PageUp/PageDown by month, Home/End to the week's
 * start/end, Enter or Space to choose, Escape to close.
 */
function JalaliDatePicker({
  label,
  placeholder = 'تاریخ را انتخاب کنید',
  value,
  onChange,
  onBlur,
  id,
  name,
  required,
  disabled,
  error,
  hint,
  maxDate,
  minYear = 1300,
  wrapperClassName,
  containerClassName,
}: JalaliDatePickerProps) {
  const generatedId = React.useId()
  const triggerId = id ?? generatedId
  const helperId = error || hint ? `${triggerId}-description` : undefined
  const today = React.useMemo(() => todayJalali(), [])
  const latest = maxDate ?? today
  const selected = parseJalali(value)

  const [open, setOpen] = React.useState(false)
  const [focused, setFocused] = React.useState<JalaliDate>(selected ?? latest)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const restoreFocus = React.useRef(false)

  const clamp = (date: JalaliDate): JalaliDate => {
    if (compareJalali(date, latest) > 0) return latest
    if (date.year < minYear) return { year: minYear, month: 1, day: 1 }
    return date
  }

  const moveFocus = (next: JalaliDate) => {
    restoreFocus.current = true
    setFocused(clamp(next))
  }

  // After a keyboard move the focused day may live in another month: focus it
  // once it has rendered.
  React.useEffect(() => {
    if (!open || !restoreFocus.current) return
    restoreFocus.current = false
    gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus()
  }, [focused, open])

  const handleOpenChange = (next: boolean) => {
    if (next) setFocused(selected ?? latest)
    setOpen(next)
    if (!next) onBlur?.()
  }

  const choose = (date: JalaliDate) => {
    onChange(formatJalali(date))
    handleOpenChange(false)
  }

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    const step: Record<string, JalaliDate | undefined> = {
      // The week row runs right to left: left is later, right is earlier.
      ArrowLeft: addDays(focused, 1),
      ArrowRight: addDays(focused, -1),
      ArrowDown: addDays(focused, 7),
      ArrowUp: addDays(focused, -7),
      PageDown: addMonths(focused, 1),
      PageUp: addMonths(focused, -1),
      Home: addDays(focused, -jalaliWeekdayIndex(focused.year, focused.month, focused.day)),
      End: addDays(focused, 6 - jalaliWeekdayIndex(focused.year, focused.month, focused.day)),
    }
    const next = step[event.key]
    if (!next) return
    event.preventDefault()
    moveFocus(next)
  }

  const viewYear = focused.year
  const viewMonth = focused.month
  const monthLength = jalaliMonthLength(viewYear, viewMonth)
  const leading = jalaliWeekdayIndex(viewYear, viewMonth, 1)
  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: monthLength }, (_, index) => index + 1),
  ]
  const years = Array.from({ length: latest.year - minYear + 1 }, (_, index) => latest.year - index)
  const lastMonthOfView = viewYear === latest.year ? latest.month : 12
  const canGoNext = compareJalali(addMonths({ ...focused, day: 1 }, 1), { ...latest, day: 1 }) <= 0
  const canGoPrevious = viewYear > minYear || viewMonth > 1

  const showMonth = (delta: number) => {
    restoreFocus.current = false
    setFocused(clamp(addMonths(focused, delta)))
  }

  return (
    <div
      data-slot="jalali-date-picker"
      dir="rtl"
      className={cn('flex w-full flex-col gap-2 text-right', wrapperClassName)}
    >
      <Typography
        as="label"
        htmlFor={triggerId}
        variant="16/regular"
        color="neutral-600"
        className="cursor-pointer select-none"
      >
        {label}
        {required ? <RequiredMark className="ms-0.5" /> : null}
      </Typography>

      <div className="flex w-full flex-col gap-1">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              id={triggerId}
              name={name}
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-describedby={helperId}
              data-invalid={error ? 'true' : undefined}
              data-empty={selected ? undefined : 'true'}
              className={cn(
                typographyVariants({ variant: '16/regular', color: 'neutral-600' }),
                'flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-background px-3 py-2 text-start outline-none transition-colors hover:border-brand-500 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 data-[invalid=true]:border-error-100 data-[invalid=true]:focus-visible:border-error-500 data-[empty=true]:font-light data-[empty=true]:text-neutral-300',
                containerClassName,
              )}
            >
              <span>{selected ? formatJalaliDisplay(selected) : placeholder}</span>
              <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-neutral-400" />
            </button>
          </PopoverTrigger>

          <PopoverContent
            dir="rtl"
            align="start"
            aria-label={`انتخاب ${label}`}
            className="w-[min(20rem,calc(100vw-2rem))] p-3"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              restoreFocus.current = true
              // Land on the chosen (or latest) day, as the grid's one tab stop.
              requestAnimationFrame(() => {
                gridRef.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus()
                restoreFocus.current = false
              })
            }}
          >
            <div className="flex items-center gap-2">
              {/* Right to left: the previous month is on the right, the next on the left. */}
              <Button
                aria-label="ماه قبل"
                disabled={!canGoPrevious}
                onClick={() => showMonth(-1)}
                size="icon-36"
                type="button"
                variant="text-gray"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
              <NativeSelect
                aria-label="ماه"
                containerClassName="flex-1"
                onChange={(event) =>
                  setFocused(
                    clamp({
                      year: viewYear,
                      month: Number(event.target.value),
                      day: Math.min(focused.day, jalaliMonthLength(viewYear, Number(event.target.value))),
                    }),
                  )
                }
                selectSize="sm"
                value={viewMonth}
              >
                {JALALI_MONTHS.map((month, index) => (
                  <option disabled={index + 1 > lastMonthOfView} key={month} value={index + 1}>
                    {month}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label="سال"
                containerClassName="w-28"
                onChange={(event) => {
                  const year = Number(event.target.value)
                  setFocused(
                    clamp({
                      year,
                      month: focused.month,
                      day: Math.min(focused.day, jalaliMonthLength(year, focused.month)),
                    }),
                  )
                }}
                selectSize="sm"
                value={viewYear}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {toPersianDigits(year)}
                  </option>
                ))}
              </NativeSelect>
              <Button
                aria-label="ماه بعد"
                disabled={!canGoNext}
                onClick={() => showMonth(1)}
                size="icon-36"
                type="button"
                variant="text-gray"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            </div>

            <div
              aria-label={`${JALALI_MONTHS[viewMonth - 1]} ${toPersianDigits(viewYear)}`}
              className="mt-3 grid grid-cols-7 gap-y-1"
              onKeyDown={onGridKeyDown}
              ref={gridRef}
              role="group"
            >
              <div aria-hidden="true" className="col-span-7 grid grid-cols-7">
                {JALALI_WEEKDAYS.map((weekday) => (
                  <Typography
                    as="span"
                    className="flex h-8 items-center justify-center"
                    color="neutral-500"
                    key={weekday.full}
                    title={weekday.full}
                    variant="12/regular"
                  >
                    {weekday.short}
                  </Typography>
                ))}
              </div>
              {cells.map((day, index) => {
                if (day === null) return <span aria-hidden="true" key={`blank-${index}`} />
                const date = { year: viewYear, month: viewMonth, day }
                const isFuture = compareJalali(date, latest) > 0
                return (
                  <Button
                    aria-label={dayLabel(date)}
                    aria-pressed={sameDay(selected, date)}
                    className="mx-auto"
                    data-today={sameDay(today, date) || undefined}
                    disabled={isFuture}
                    key={day}
                    onClick={() => choose(date)}
                    size="icon-36"
                    tabIndex={day === focused.day ? 0 : -1}
                    type="button"
                    variant="day"
                  >
                    <Typography as="span" variant="14/regular">
                      {toPersianDigits(day)}
                    </Typography>
                  </Button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <Button
                disabled={compareJalali(today, latest) > 0}
                onClick={() => choose(today)}
                size="32"
                type="button"
                variant="text-primary"
              >
                امروز
              </Button>
              {selected && (
                <Button
                  onClick={() => {
                    onChange('')
                    handleOpenChange(false)
                  }}
                  size="32"
                  type="button"
                  variant="text-gray"
                >
                  پاک کردن
                </Button>
              )}
            </div>
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
}

export { JalaliDatePicker }
