'use client'

import { RequiredMark } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { NativeSelect } from '@/components/ui/native-select'

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
        <Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}{field.required ? <RequiredMark className="ms-0.5" /> : null}</Typography>
        <Textarea
          name={field.name}
          placeholder={`${label} را وارد کنید`}
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
        <Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}{field.required ? <RequiredMark className="ms-0.5" /> : null}</Typography>
        <NativeSelect
          name={field.name}
          required={field.required}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">انتخاب کنید</option>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </NativeSelect>
      </label>
    )
  }
  return (
    <Input
      name={field.name}
      required={field.required}
      disabled={disabled}
      label={label}
      placeholder={`${label} را وارد کنید`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
