"use client"

import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { typographyVariants } from "@/components/ui/typography"
import { cn } from "@/utilities/ui"

/**
 * Sandoq form field layout (Figma Style page 2:26, input node 263:3294).
 * Label 14/regular neutral-600, hint 12/light neutral-500, error 12/light error.
 * The error stays next to its field and is announced with role="alert".
 */
/**
 * The shared required-field marker: a red asterisk after the label. It is
 * decorative (aria-hidden); the control itself carries aria-required.
 */
function RequiredMark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="required-marker"
      aria-hidden="true"
      className={cn("text-error-500", className)}
      {...props}
    >
      *
    </span>
  )
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex min-w-0 flex-col gap-4 has-[>[data-slot=radio-group]]:gap-3", className)}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"legend"> & { required?: boolean }) {
  return (
    <legend
      data-slot="field-legend"
      className={cn(typographyVariants({ variant: "14/semibold", color: "neutral-700" }), "mb-1.5", className)}
      {...props}
    >
      {children}
      {required ? <RequiredMark className="ms-0.5" /> : null}
    </legend>
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("flex w-full flex-col gap-5", className)} {...props} />
}

const fieldVariants = cva("group/field flex w-full min-w-0 gap-2 text-right", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row items-center [&>[data-slot=field-label]]:flex-auto",
    },
  },
  defaultVariants: { orientation: "vertical" },
})

function Field({
  className,
  orientation = "vertical",
  invalid,
  disabled,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & { invalid?: boolean; disabled?: boolean }) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-content" className={cn("flex flex-1 flex-col gap-1", className)} {...props} />
}

function FieldLabel({
  className,
  required,
  children,
  ...props
}: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        typographyVariants({ variant: "14/regular", color: "neutral-600" }),
        "flex w-fit cursor-pointer items-center gap-2 select-none group-data-[disabled=true]/field:cursor-not-allowed group-data-[disabled=true]/field:text-neutral-400",
        className,
      )}
      {...props}
    >
      {children}
      {required ? <RequiredMark className="-ms-1.5" /> : null}
    </label>
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(typographyVariants({ variant: "12/light", color: "neutral-500" }), className)}
      {...props}
    />
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"p"> & { errors?: Array<{ message?: string } | undefined> }) {
  const content = useMemo(() => {
    if (children) return children
    const messages = [...new Set((errors ?? []).map((error) => error?.message).filter(Boolean))]
    return messages.length ? messages.join(" ") : null
  }, [children, errors])

  if (!content) return null

  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn(typographyVariants({ variant: "12/light", color: "error" }), className)}
      {...props}
    >
      {content}
    </p>
  )
}

export { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet, RequiredMark }
