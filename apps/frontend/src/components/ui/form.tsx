"use client"

import * as React from "react"
import {
  Controller,
  FormProvider,
  type ControllerFieldState,
  type ControllerProps,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

/**
 * react-hook-form bindings for the shared Field layout. Use them for forms with
 * validation: `<Form {...form}>`, then one `<FormField>` per control. The error
 * renders under its field and the control gets aria-invalid / aria-describedby.
 */
const Form = FormProvider

export type FormFieldControlProps<TValues extends FieldValues, TName extends FieldPath<TValues>> = {
  field: ControllerRenderProps<TValues, TName>
  fieldState: ControllerFieldState
  /** Spread onto the control: id, aria-invalid and aria-describedby. */
  controlProps: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }
}

function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({
  label,
  description,
  className,
  render,
  ...props
}: Omit<ControllerProps<TValues, TName>, "render"> & {
  label?: React.ReactNode
  description?: React.ReactNode
  className?: string
  render: (props: FormFieldControlProps<TValues, TName>) => React.ReactElement
}) {
  const id = React.useId()
  return (
    <Controller
      {...props}
      render={({ field, fieldState }) => {
        const descriptionId = description ? `${id}-description` : undefined
        const errorId = fieldState.error ? `${id}-error` : undefined
        const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined
        return (
          <Field invalid={Boolean(fieldState.error)} disabled={field.disabled} className={className}>
            {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
            {render({
              field,
              fieldState,
              controlProps: {
                id,
                "aria-invalid": fieldState.error ? true : undefined,
                "aria-describedby": describedBy,
              },
            })}
            {description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
            <FieldError id={errorId} errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}

export { Form, FormField }
