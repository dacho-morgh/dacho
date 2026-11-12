'use client'

import * as React from 'react'
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker'
import { ComboboxField } from '@/components/ui/combobox-field'
import { Typography } from '@/components/ui/typography'
import { toPersianDigits } from '@/utilities/digits'
import { formatJalali, parseJalali, todayJalali } from '@/utilities/jalali'
import { tehranToUtcInput, utcInputToTehran } from '@/utilities/jalali-datetime'

export type JalaliDateTimeFieldProps = {
  /** The id of the date button; the surrounding label points at it. */
  id: string
  /** The stored value: a UTC instant `YYYY-MM-DDTHH:mm:ss.SSS` (no `Z`), or ''. */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  /** Names the date, hour and minute controls for assistive technology. */
  label: string
}

const two = (value: number) => String(value).padStart(2, '0')
/** The hour and minute dropdowns store the number and show it with Persian digits. */
const timeOptions = (count: number) =>
  Array.from({ length: count }, (_, value) => ({ value: String(value), label: toPersianDigits(two(value)) }))
const HOUR_OPTIONS = timeOptions(24)
const MINUTE_OPTIONS = timeOptions(60)

/**
 * A date and time entered in the Jalali calendar and read as Tehran time. It keeps the
 * UTC instant the API stores, so nothing Gregorian is typed or shown, and the seconds of
 * an existing time survive a change of the date or the hour.
 */
function JalaliDateTimeField({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  disabled,
  label,
}: JalaliDateTimeFieldProps) {
  const current = utcInputToTehran(value)
  const thisYear = React.useMemo(() => todayJalali().year, [])
  // Events are planned ahead and shown back to a few years ago.
  const maxDate = React.useMemo(() => ({ year: thisYear + 10, month: 12, day: 29 }), [thisYear])
  const minYear = Math.min(thisYear - 10, current?.date.year ?? thisYear)

  const emit = (date: ReturnType<typeof parseJalali>, hour: number, minute: number) => {
    if (!date) return onChange('')
    onChange(tehranToUtcInput({ date, hour, minute }, value))
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
      <div className="min-w-0 flex-1 basis-full sm:basis-0">
        <JalaliDatePicker
          ariaLabel={label}
          containerClassName="h-10"
          describedBy={describedBy}
          disabled={disabled}
          id={id}
          invalid={invalid}
          maxDate={maxDate}
          minYear={minYear}
          onBlur={onBlur}
          onChange={(next) => emit(parseJalali(next), current?.hour ?? 0, current?.minute ?? 0)}
          value={current ? formatJalali(current.date) : ''}
        />
      </div>
      <div className="flex items-center gap-1.5" dir="ltr">
        <ComboboxField
          hideLabel
          label={`ساعت ${label}`}
          aria-label={`ساعت ${label}`}
          placeholder="--"
          wrapperClassName="w-20 gap-0"
          containerClassName="h-10 px-2"
          disabled={disabled || !current}
          onBlur={onBlur}
          onChange={(next) => current && next && emit(current.date, Number(next), current.minute)}
          options={HOUR_OPTIONS}
          value={current ? String(current.hour) : ''}
        />
        <Typography as="span" variant="16/semibold" color="neutral-600" aria-hidden="true">
          :
        </Typography>
        <ComboboxField
          hideLabel
          label={`دقیقه ${label}`}
          aria-label={`دقیقه ${label}`}
          placeholder="--"
          wrapperClassName="w-20 gap-0"
          containerClassName="h-10 px-2"
          disabled={disabled || !current}
          onBlur={onBlur}
          onChange={(next) => current && next && emit(current.date, current.hour, Number(next))}
          options={MINUTE_OPTIONS}
          value={current ? String(current.minute) : ''}
        />
      </div>
    </div>
  )
}

export { JalaliDateTimeField }
