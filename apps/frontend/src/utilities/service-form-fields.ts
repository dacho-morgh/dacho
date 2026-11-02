import type { RequestFormField, RequestFormOption } from '@/components/dashboard/request-form-field'

/** The fixed CMS form of a service (`services.form`, depth ≥ 1) as editable request fields. */
export function serviceFormFields(service: { form?: unknown } | null | undefined): RequestFormField[] {
  const form = service && typeof service.form === 'object' && service.form ? (service.form as { fields?: unknown[] }) : null
  return (form?.fields ?? [])
    .map((field) => {
      const value = field as { name?: unknown; label?: unknown; blockType?: unknown; required?: unknown; options?: unknown[] }
      const options = Array.isArray(value.options)
        ? value.options.flatMap((option): RequestFormOption[] => {
            if (typeof option === 'string') return [{ label: option, value: option }]
            if (!option || typeof option !== 'object') return []
            const item = option as { label?: unknown; value?: unknown }
            const optionValue = String(item.value ?? item.label ?? '')
            return optionValue ? [{ label: String(item.label ?? optionValue), value: optionValue }] : []
          })
        : undefined
      return {
        name: String(value.name ?? ''),
        label: typeof value.label === 'string' ? value.label : undefined,
        blockType: String(value.blockType ?? ''),
        required: value.required === true,
        options,
      }
    })
    .filter((field) => field.name)
}
