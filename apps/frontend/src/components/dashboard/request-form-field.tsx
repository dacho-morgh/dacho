'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'

export interface RequestFormOption { label: string; value: string }
export interface RequestFormField { name: string; label?: string; blockType: string; required?: boolean; options?: RequestFormOption[] }

/** One field of a service's fixed CMS form, rendered with the shared input components. */
export function RequestFormFieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: RequestFormField
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const label = field.label || field.name
  if (field.blockType.includes('textarea') || field.blockType.includes('richText')) {
    return (
      <label className="block md:col-span-2">
        <Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}</Typography>
        <Textarea
          name={field.name}
          required={field.required}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    )
  }
  if (field.blockType.includes('select') && field.options?.length) {
    return (
      <label className="block">
        <Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}</Typography>
        <select
          name={field.name}
          required={field.required}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-lg border border-neutral-200 bg-white px-3"
        >
          <option value="">انتخاب کنید</option>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    )
  }
  return (
    <Input
      name={field.name}
      required={field.required}
      disabled={disabled}
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
