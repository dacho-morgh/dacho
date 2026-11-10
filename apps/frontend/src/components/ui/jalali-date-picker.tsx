'use client'

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { RequiredMark } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Typography, typographyVariants } from '@/components/ui/typography'
import { toPersianDigits } from '@/utilities/digits'
import {
  compareJalali,
  formatJalali,
  formatJalaliDisplay,
  JALALI_MONTHS,
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
  /** Keep `aria-required` but draw no `*` (a form where every field is required). */
  hideRequiredMark?: boolean
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

/** The calendar works with `Date`s; noon keeps the day stable in every time zone. */
function toDate({ year, month, day }: JalaliDate): Date {
  const gregorian = toGregorian(year, month, day)
  return new Date(gregorian.year, gregorian.month - 1, gregorian.day, 12)
}

function fromDate(date: Date): JalaliDate {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

type PanelView = 'days' | 'months' | 'years'

type CalendarPanelProps = {
  selected: JalaliDate | null
  today: JalaliDate
  latest: JalaliDate
  minYear: number
  onChoose: (date: JalaliDate) => void
  onClear: () => void
}

/**
 * What the popover shows. The header holds a previous/next month button on each
 * side (right = earlier, left = later, as the page reads right to left) and two
 * buttons that swap the day grid for a month grid or a year grid (newest year
 * first). It is mounted when the popover opens, so it always starts on the
 * chosen month, or the latest one when nothing is chosen.
 */
function CalendarPanel({
  selected,
  today,
  latest,
  minYear,
  onChoose,
  onClear,
}: CalendarPanelProps) {
  const start = selected ?? latest
  const [view, setView] = React.useState<PanelView>('days')
  const [year, setYear] = React.useState(start.year)
  const [month, setMonth] = React.useState(start.month)
  const yearGridRef = React.useRef<HTMLDivElement>(null)

  const lastMonthOfYear = (y: number) => (y === latest.year ? latest.month : 12)
  const years = React.useMemo(
    () => Array.from({ length: latest.year - minYear + 1 }, (_, index) => latest.year - index),
    [latest.year, minYear],
  )
  const atEarliest = year === minYear && month === 1
  const atLatest = year === latest.year && month === latest.month

  const showMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta
    setYear(Math.floor(index / 12))
    setMonth((index % 12) + 1)
  }

  React.useEffect(() => {
    if (view === 'years') {
      yearGridRef.current
        ?.querySelector('[aria-pressed="true"]')
        ?.scrollIntoView?.({ block: 'center' })
    }
  }, [view])

  const toggle = (next: PanelView) => setView((current) => (current === next ? 'days' : next))
  const latestDate = toDate(latest)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          aria-label="ماه قبل"
          disabled={view !== 'days' || atEarliest}
          onClick={() => showMonth(-1)}
          size="icon-36"
          type="button"
          variant="outline-gray"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <Button
            aria-expanded={view === 'months'}
            aria-label="انتخاب ماه"
            className="flex-1"
            onClick={() => toggle('months')}
            size="36"
            type="button"
            variant="outline-gray"
          >
            <Typography as="span" variant="14/semibold">
              {JALALI_MONTHS[month - 1]}
            </Typography>
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-expanded={view === 'years'}
            aria-label="انتخاب سال"
            className="flex-1"
            onClick={() => toggle('years')}
            size="36"
            type="button"
            variant="outline-gray"
          >
            <Typography as="span" variant="14/semibold">
              {toPersianDigits(year)}
            </Typography>
            <ChevronDown aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <Button
          aria-label="ماه بعد"
          disabled={view !== 'days' || atLatest}
          onClick={() => showMonth(1)}
          size="icon-36"
          type="button"
          variant="outline-gray"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
      </div>

      {/* A fixed height, so the popover does not jump when the view changes. */}
      <div className="h-62">
        {view === 'days' && (
          <Calendar
            autoFocus
            disabled={{ after: latestDate }}
            endMonth={latestDate}
            mode="single"
            month={toDate({ year, month, day: 1 })}
            onMonthChange={(date) => {
              const next = fromDate(date)
              setYear(next.year)
              setMonth(next.month)
            }}
            onSelect={(date) => {
              if (date) onChoose(fromDate(date))
            }}
            selected={selected ? toDate(selected) : undefined}
            startMonth={toDate({ year: minYear, month: 1, day: 1 })}
          />
        )}

        {view === 'months' && (
          <div className="grid grid-cols-3 content-start gap-2" role="group" aria-label="ماه‌ها">
            {JALALI_MONTHS.map((name, index) => (
              <Button
                aria-pressed={index + 1 === month}
                disabled={index + 1 > lastMonthOfYear(year)}
                key={name}
                onClick={() => {
                  setMonth(index + 1)
                  setView('days')
                }}
                size="36"
                type="button"
                variant="chip"
              >
                <Typography as="span" variant="14/regular">
                  {name}
                </Typography>
              </Button>
            ))}
          </div>
        )}

        {view === 'years' && (
          <div
            aria-label="سال‌ها"
            className="grid h-full grid-cols-4 content-start gap-2 overflow-y-auto pe-1"
            ref={yearGridRef}
            role="group"
          >
            {years.map((value) => (
              <Button
                aria-pressed={value === year}
                key={value}
                onClick={() => {
                  setYear(value)
                  setMonth((current) => Math.min(current, lastMonthOfYear(value)))
                  setView('days')
                }}
                size="36"
                type="button"
                variant="chip"
              >
                <Typography as="span" variant="14/regular">
                  {toPersianDigits(value)}
                </Typography>
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
        <Button
          disabled={compareJalali(today, latest) > 0}
          onClick={() => onChoose(today)}
          size="32"
          type="button"
          variant="outline-primary"
        >
          امروز
        </Button>
        {selected && (
          <Button onClick={onClear} size="32" type="button" variant="outline-gray">
            پاک کردن
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * A Jalali (Shamsi) date field in the shadcn/ui date-picker pattern: a
 * form-styled button that opens the Persian `Calendar` in a popover. Month and
 * year are picked from dropdowns (founding dates are decades back) and days
 * after `maxDate` cannot be chosen. The value is the same `YYYY/MM/DD` string
 * the profile stores, so no Gregorian date is ever kept in the form.
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
  hideRequiredMark,
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

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) onBlur?.()
  }

  const choose = (date: JalaliDate) => {
    onChange(formatJalali(date))
    handleOpenChange(false)
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
        {required && !hideRequiredMark ? <RequiredMark className="ms-0.5" /> : null}
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
                'flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-background px-3 py-2 text-start outline-none transition-colors hover:border-brand-500 focus-visible:border-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 data-[invalid=true]:border-error-100 data-[invalid=true]:focus-visible:border-error-500 data-[empty=true]:font-light data-[empty=true]:text-neutral-400',
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
            className="w-[min(19rem,calc(100vw-2rem))] p-3"
            onOpenAutoFocus={(event) => {
              // The day grid focuses the chosen (or latest) day itself.
              event.preventDefault()
            }}
          >
            <CalendarPanel
              latest={latest}
              minYear={minYear}
              onChoose={choose}
              onClear={() => {
                onChange('')
                handleOpenChange(false)
              }}
              selected={selected}
              today={today}
            />
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
