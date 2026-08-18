"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { XCircle } from "lucide-react"

import { cn } from "@/utilities/ui"
import { SearchIcon } from "public/images/dashboard/search-icon"


/**
 * Sandoq Design System Input Variants (Figma node 26:5317)
 *
 * Direction: RTL (Persian)
 * Heights: 40px (default / md), 36px (sm), 48px (lg)
 * Radius: 8px
 * States: Default, Hover, Focus/Active (Blue #3B82F6), Error (#EF4444 / #FF4E64), Disabled
 */
const inputContainerVariants = cva(
  "group relative flex w-full items-center gap-2 rounded-[8px] border bg-white px-3 py-2 text-foreground transition-all duration-150 dir-rtl",
  {
    variants: {
      variant: {
        default:
          "border-neutral-200 hover:border-neutral-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20",
        error:
          "border-error-500 hover:border-error-500 focus-within:border-error-500 focus-within:ring-2 focus-within:ring-error-500/20",
      },
      inputSize: {
        sm: "h-9 text-sm leading-6",
        default: "h-10 text-base leading-7",
        md: "h-10 text-base leading-7",
        lg: "h-12 text-lg leading-8",
      },
      disabled: {
        true: "cursor-not-allowed bg-neutral-100 border-neutral-200 opacity-70",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
)

export type InputProps = Omit<React.ComponentProps<"input">, "size"> &
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
      type = "text",
      variant,
      inputSize = "default",
      label,
      hint,
      error,
      startIcon,
      endIcon,
      disabled,
      id,
      dir = "rtl",
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = id || (label ? generatedId : undefined)
    const isError = Boolean(error)
    const computedVariant = isError ? "error" : variant || "default"

    const inputElement = (
      <div
        data-slot="input-container"
        className={cn(
          inputContainerVariants({
            variant: computedVariant,
            inputSize,
            disabled,
          }),
          containerClassName
        )}
      >
        {/* Right Icon in RTL / Leading Icon */}
        {startIcon && (
          <div className="flex shrink-0 items-center justify-center text-neutral-400 group-focus-within:text-brand-500 transition-colors [&>svg]:size-5">
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
          className={cn(
            "w-full flex-1 bg-transparent font-sans text-neutral-800 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400",
            className
          )}
          {...props}
        />

        {/* Left Icon in RTL / Trailing Icon */}
        {endIcon && (
          <div className="flex shrink-0 items-center justify-center text-neutral-400 transition-colors [&>svg]:size-5">
            {endIcon}
          </div>
        )}
      </div>
    )

    // If no label, hint, or error, return the container directly
    if (!label && !hint && !error) {
      return inputElement
    }

    return (
      <div
        data-slot="input-wrapper"
        dir={dir}
        className={cn("flex w-full flex-col gap-2 font-sans text-right", wrapperClassName)}
      >
        {label && (
          <label
            htmlFor={inputId}
            className="text-base font-semibold leading-7 text-neutral-600 select-none cursor-pointer"
          >
            {label}
          </label>
        )}

        {inputElement}

        {(error || hint) && (
          <p
            className={cn(
              "px-1 text-xs leading-4 font-normal transition-colors",
              isError ? "text-error-500 font-medium" : "text-neutral-500"
            )}
          >
            {error || hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export type SearchInputProps = Omit<InputProps, "startIcon" | "endIcon"> & {
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
      placeholder = "جستجو...",
      className,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue || "")
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
        setInternalValue("")
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
              className="flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
            >
              <XCircle className="size-5" />
            </button>
          ) : null
        }
        className={className}
        {...props}
      />
    )
  }
)
SearchInput.displayName = "SearchInput"

export { Input, SearchInput, SearchIcon, inputContainerVariants }
