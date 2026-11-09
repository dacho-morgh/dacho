'use client'

import * as React from 'react'
import { RequiredMark } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

export type SelectFieldProps = Omit<React.ComponentProps<'select'>, 'size' | 'children' | 'dir'> & {
  label: string
  /** The empty first option, shown in the placeholder colour. */
  placeholder: string
  options: readonly string[]
  error?: string
  hint?: string
  selectSize?: 'sm' | 'default' | 'lg'
  wrapperClassName?: string
}

/**
 * A labelled dropdown laid out like <Input> (label, `*` marker, one-line error
 * linked with aria-describedby). It is a native <select> in RTL: the list opens
 * right-to-left, keeps the platform's keyboard and mobile pickers, and is
 * testable without a pointer. Pass `required` / `aria-required` for the marker.
 */
const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      label,
      placeholder,
      options,
      error,
      hint,
      selectSize = 'lg',
      wrapperClassName,
      className,
      id,
      value,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const selectId = id ?? generatedId
    const helperId = error || hint ? `${selectId}-description` : undefined
    const isRequired =
      props.required === true || props['aria-required'] === true || props['aria-required'] === 'true'
    const isEmpty = value === undefined || value === ''

    return (
      <div
        data-slot="select-field"
        dir="rtl"
        className={cn('flex w-full flex-col gap-2 text-right', wrapperClassName)}
      >
        <Typography
          as="label"
          htmlFor={selectId}
          variant="16/regular"
          color="neutral-600"
          className="cursor-pointer select-none"
        >
          {label}
          {isRequired ? <RequiredMark className="ms-0.5" /> : null}
        </Typography>

        <div className="flex w-full flex-col gap-1">
          <NativeSelect
            ref={ref}
            id={selectId}
            selectSize={selectSize}
            value={value}
            data-empty={isEmpty ? 'true' : undefined}
            aria-describedby={ariaDescribedBy || helperId}
            aria-invalid={ariaInvalid ?? (error ? true : undefined)}
            className={cn(
              'data-[empty=true]:font-light data-[empty=true]:text-neutral-400 [&>option]:font-normal [&>option]:text-neutral-700',
              error && 'border-error-100',
              className,
            )}
            {...props}
          >
            <option value="">{placeholder}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </NativeSelect>

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
SelectField.displayName = 'SelectField'

export { SelectField }
