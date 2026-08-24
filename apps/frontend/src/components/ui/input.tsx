'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { XCircle } from 'lucide-react'
import { SearchIcon } from 'public/images/dashboard/search-icon'
import * as React from 'react'
import { Typography, typographyVariants } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/**
 * Sandoq Design System Input Variants (Figma node 263:3294)
 *
 * Direction: RTL (Persian)
 * Height: 40px (default / md)
 * Radius: 8px
 * States: Default, Hover, Focus/Active, Error, Disabled
 */
const inputContainerVariants = cva(
  'group relative flex w-full items-center gap-2 rounded-lg border bg-background p-2 transition-colors duration-150 dir-rtl',
  {
    variants: {
      variant: {
        default: 'border-neutral-100 hover:border-brand-500 focus-within:border-brand-500',
        error: 'border-error-100 hover:border-error-200 focus-within:border-error-500',
      },
      inputSize: {
        sm: 'h-9',
        default: 'h-10',
        md: 'h-10',
        lg: 'h-12',
      },
      disabled: {
        true: 'cursor-not-allowed border-neutral-100 bg-neutral-50',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  },
)

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputContainerVariants> & {
    label?: string
    hint?: string
    error?: string
    startIcon?: React.ReactNode
    endIcon?: React.ReactNode
    containerClassName?: string
    wrapperClassName?: string
  }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      wrapperClassName,
      type = 'text',
      variant,
      inputSize = 'default',
      label,
      hint,
      error,
      startIcon,
      endIcon,
      disabled,
      id,
      dir = 'rtl',
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const hasSupportingContent = Boolean(label || hint || error)
    const inputId = id || (hasSupportingContent ? generatedId : undefined)
    const helperId = inputId && (error || hint) ? `${inputId}-description` : undefined
    const isError = Boolean(error) || variant === 'error'
    const computedVariant = isError ? 'error' : variant || 'default'

    const inputElement = (
      <div
        data-slot="input-container"
        className={cn(
          inputContainerVariants({
            variant: computedVariant,
            inputSize,
            disabled,
          }),
          containerClassName,
        )}
      >
        {/* Right Icon in RTL / Leading Icon */}
        {startIcon && (
          <div className="flex size-6 shrink-0 items-center justify-center text-neutral-300 transition-colors group-focus-within:text-brand-500 [&>svg]:size-6">
            {startIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          dir={dir}
          disabled={disabled}
          data-slot="input"
          aria-describedby={ariaDescribedBy || helperId}
          aria-invalid={ariaInvalid ?? (isError || undefined)}
          className={cn(
            typographyVariants({ variant: '16/regular', color: 'neutral-600' }),
            'min-w-0 flex-1 bg-transparent text-right outline-none placeholder:font-light placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400',
            className,
          )}
          {...props}
        />

        {/* Left Icon in RTL / Trailing Icon */}
        {endIcon && (
          <div className="flex size-6 shrink-0 items-center justify-center text-neutral-300 transition-colors [&>svg]:size-6">
            {endIcon}
          </div>
        )}
      </div>
    )

    if (!hasSupportingContent) {
      return inputElement
    }

    return (
      <div
        data-slot="input-wrapper"
        dir={dir}
        className={cn('flex w-full flex-col gap-2 text-right', wrapperClassName)}
      >
        {label && (
          <Typography
            as="label"
            htmlFor={inputId}
            variant="16/regular"
            color="neutral-600"
            className="cursor-pointer select-none"
          >
            {label}
          </Typography>
        )}

        <div className="flex w-full flex-col gap-1">
          {inputElement}

          {(error || hint) && (
            <Typography
              as="p"
              id={helperId}
              variant="12/light"
              color={isError ? 'error' : 'neutral-500'}
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
Input.displayName = 'Input'

export type SearchInputProps = Omit<InputProps, 'startIcon' | 'endIcon'> & {
  onClear?: () => void
  showClearButton?: boolean
}

/**
 * Sandoq Design System RTL Search Input (Figma node 26:5317)
 * Right side: Search Icon
 * Left side: Clear (Close Circle) Icon
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onClear,
      showClearButton = true,
      placeholder = 'جستجو...',
      className,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || '')
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : internalValue

    const hasValue = Boolean(currentValue && String(currentValue).length > 0)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value)
      }
      onChange?.(e)
    }

    const handleClear = () => {
      if (!isControlled) {
        setInternalValue('')
      }
      onClear?.()
    }

    return (
      <Input
        ref={ref}
        type="text"
        dir="rtl"
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder={placeholder}
        startIcon={<SearchIcon className="size-5 text-[#D4D4D4]" />}
        endIcon={
          showClearButton && hasValue ? (
            <button
              type="button"
              onClick={handleClear}
              tabIndex={-1}
              aria-label="پاک کردن متن"
              className="flex cursor-pointer items-center justify-center text-neutral-400 transition-colors hover:text-neutral-600"
            >
              <XCircle className="size-5" />
            </button>
          ) : null
        }
        className={className}
        {...props}
      />
    )
  },
)
SearchInput.displayName = 'SearchInput'

export { Input, SearchInput, SearchIcon, inputContainerVariants }
