'use client'

import type { HTMLInputTypeAttribute } from 'react'
import { RequiredMark } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'

interface InlineProfileFieldProps {
  label: string
  value: string
  editing: boolean
  dir?: 'rtl' | 'ltr' | 'auto'
  type?: HTMLInputTypeAttribute
  /** Marks the label with the shared `*`. Only shown while editing. */
  required?: boolean
  placeholder?: string
  onChange: (value: string) => void
}

export function InlineProfileField({
  label,
  value,
  editing,
  dir = 'rtl',
  type = 'text',
  required = false,
  placeholder,
  onChange,
}: InlineProfileFieldProps) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-neutral-100 p-2 text-start">
      <Typography as="label" variant="14/semibold" color="neutral-400" className="w-full">
        {label}
        {required && editing ? <RequiredMark className="ms-0.5" /> : null}
        <Input
          type={type}
          dir={dir}
          value={value}
          readOnly={!editing}
          aria-required={required && editing ? true : undefined}
          placeholder={editing ? placeholder : undefined}
          aria-readonly={!editing}
          onChange={(event) => onChange(event.target.value)}
          containerClassName={
            editing
              ? 'mt-2 bg-background'
              : 'mt-2 border-transparent bg-transparent p-0 hover:border-transparent'
          }
          className="text-start font-[450] read-only:cursor-default"
        />
      </Typography>
    </div>
  )
}
