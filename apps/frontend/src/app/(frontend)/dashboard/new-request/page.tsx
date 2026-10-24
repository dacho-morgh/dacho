import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import { NewRequestForm, type RequestFormField, type RequestFormOption } from '@/components/dashboard/new-request-form'
import { Typography } from '@/components/ui/typography'

export const dynamic = 'force-dynamic'
export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ service?: string; eventId?: string; eventTitle?: string }> }) {
  const query = await searchParams
  const key = query.service
  if (!key) notFound()
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({ collection: 'services', where: { key: { equals: key } }, depth: 2, limit: 1 })
  const service = result.docs[0]
  if (!service) notFound()
  const form = typeof service.form === 'object' && service.form ? service.form as { fields?: unknown[] } : null
  const fields: RequestFormField[] = (form?.fields ?? []).map((field) => {
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
    return { name: String(value.name ?? ''), label: typeof value.label === 'string' ? value.label : undefined, blockType: String(value.blockType ?? ''), required: value.required === true, options }
  }).filter((field) => field.name)
  const initialAnswers = Object.fromEntries(fields.flatMap((field) => {
    if (!query.eventTitle || !field.name.toLocaleLowerCase().includes('event')) return []
    return [[field.name, field.name.toLocaleLowerCase().includes('id') ? String(query.eventId ?? '') : query.eventTitle]]
  }))
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-10" dir="rtl"><Typography as="h1" variant="24/bold" className="text-neutral-900">ثبت درخواست {service.title}</Typography><section className="rounded-2xl border border-neutral-200 bg-white p-6"><NewRequestForm serviceId={String(service.id)} serviceKey={service.key ?? undefined} title={service.title} fields={fields} initialAnswers={initialAnswers} /></section></main>
}
