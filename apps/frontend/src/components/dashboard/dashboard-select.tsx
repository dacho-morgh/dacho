'use client'

import * as React from 'react'
import { ComboboxField, type ComboboxFieldProps } from '@/components/ui/combobox-field'
import { cn } from '@/utilities/ui'

export type DashboardSelectOption = { value: string; label: string }

export type DashboardSelectProps = Omit<
  ComboboxFieldProps,
  'options' | 'hideLabel' | 'wrapperClassName' | 'containerClassName' | 'placeholder'
> & {
  options: readonly DashboardSelectOption[]
  placeholder?: string
  className?: string
}

/**
 * The dashboard's dropdown: the searchable combobox from company registration,
 * sized like the dashboard's 40px inputs. It sits inside a field row that draws its
 * own label (`<label htmlFor={id}>`), so `label` here only names the control and its
 * list for assistive technology. Options are `{ value, label }`; the value (an id)
 * is what `onChange` gets and what a native form submits under `name`.
 */
export const DashboardSelect = React.forwardRef<HTMLInputElement, DashboardSelectProps>(
  ({ className, placeholder = 'انتخاب کنید', ...props }, ref) => (
    <ComboboxField
      ref={ref}
      hideLabel
      placeholder={placeholder}
      wrapperClassName="gap-0"
      containerClassName={cn('h-10', className)}
      {...props}
    />
  ),
)
DashboardSelect.displayName = 'DashboardSelect'
