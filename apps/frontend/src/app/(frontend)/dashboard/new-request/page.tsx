import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { NewRequestForm } from '@/components/dashboard/new-request-form'
import { Typography } from '@/components/ui/typography'
import type { ParticipationTarget } from '@/utilities/participation-eligibility'
import { serviceFormFields } from '@/utilities/service-form-fields'

export const dynamic = 'force-dynamic'
export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ service?: string; eventId?: string; eventTitle?: string; subtopicId?: string; boothId?: string }> }) {
  const query = await searchParams
  const key = query.service
  if (!key) notFound()
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({ collection: 'services', where: { key: { equals: key } }, depth: 2, limit: 1 })
  const service = result.docs[0]
  if (!service) notFound()
  const fields = serviceFormFields(service)
  const initialAnswers = Object.fromEntries(fields.flatMap((field) => {
    if (!query.eventTitle || !field.name.toLocaleLowerCase().includes('event')) return []
    return [[field.name, field.name.toLocaleLowerCase().includes('id') ? String(query.eventId ?? '') : query.eventTitle]]
  }))
  const participation = participationTargetFor(key, query)
  const returnTo = participation ? newRequestPath(query) : undefined
  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6 p-4 sm:p-10" dir="rtl">
      {participation ? (
        <nav aria-label="مسیر راهنما" className="flex min-w-0 flex-wrap items-center gap-2">
          <Link href="/dashboard/events">
            <Typography as="span" variant="14/regular" color="neutral-500">رویدادها و نمایشگاه‌ها</Typography>
          </Link>
          <Typography as="span" variant="14/regular" color="neutral-400">/</Typography>
          <Typography as="span" variant="14/semibold" color="neutral-700">
            {participation.kind === 'event' ? 'ثبت نام در رویداد' : 'ثبت نام در نمایشگاه'}
          </Typography>
        </nav>
      ) : null}
      <Typography as="h1" variant="24/bold" className="break-words text-neutral-900">
        ثبت درخواست {service.title}
      </Typography>
      {query.eventTitle ? (
        <Typography variant="16/semibold" color="neutral-600" className="break-words">{query.eventTitle}</Typography>
      ) : null}
      <section className="min-w-0 rounded-2xl border border-neutral-200 bg-background p-4 sm:p-6">
        <NewRequestForm
          serviceId={String(service.id)}
          serviceKey={service.key ?? undefined}
          title={service.title}
          fields={fields}
          initialAnswers={initialAnswers}
          participation={participation}
          returnTo={returnTo}
        />
      </section>
    </main>
  )
}

type NewRequestQuery = { service?: string; eventId?: string; eventTitle?: string; subtopicId?: string; boothId?: string }

/** Event and exhibition entries are gated by company verification; other services are not. */
function participationTargetFor(service: string, query: NewRequestQuery): ParticipationTarget | undefined {
  const eventId = query.eventId?.replace(/^(events|exhibitions)-/, '')
  if (!eventId) return undefined
  if (service === 'events') {
    const subtopicIds = (query.subtopicId ?? '').split(',').map((id) => id.trim()).filter(Boolean).slice(0, 50)
    return { kind: 'event', eventId, subtopicIds }
  }
  if (service === 'exhibitions') {
    return { kind: 'exhibition', exhibitionId: eventId, exhibitionTitle: query.eventTitle, boothId: query.boothId }
  }
  return undefined
}

function newRequestPath(query: NewRequestQuery): string {
  const params = new URLSearchParams()
  for (const name of ['service', 'eventId', 'eventTitle', 'subtopicId', 'boothId'] as const) {
    const value = query[name]
    if (value) params.set(name, value)
  }
  return `/dashboard/new-request?${params.toString()}`
}
