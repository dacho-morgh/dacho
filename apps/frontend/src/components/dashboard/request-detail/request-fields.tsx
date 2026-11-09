import type { ReactNode } from 'react'

import type { RequestFormField } from '@/components/dashboard/request-form-field'
import { DocumentTextIcon } from '@/components/icons'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/** A stored answer as the person reads it: no object dumps, no raw booleans. */
export function answerText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object')) return value.join('، ')
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

type FieldTone = 'input' | 'readonly'

/**
 * One labelled value in the design's text field (Figma 73151, 77): the label above, the value in a 40px box.
 * The company page draws it as the white input the form was filled in; staff pages as the grey read-only tile.
 * Long text spans both columns and keeps its line breaks.
 */
export function LabelledField({
  label,
  value,
  tone = 'readonly',
  wide = false,
}: {
  label: string
  value: ReactNode
  tone?: FieldTone
  wide?: boolean
}) {
  const empty = value === '—' || value === '' || value === null || value === undefined
  return (
    <div data-testid="labelled-field" className={cn('flex min-w-0 flex-col gap-2', wide && 'sm:col-span-2')}>
      <Typography as="span" variant="14/semibold" sm="16/semibold" color="neutral-700">
        {label}
      </Typography>
      <div
        className={cn(
          'flex min-h-10 items-center rounded-lg border p-2',
          tone === 'input' ? 'border-neutral-200 bg-background' : 'border-neutral-100 bg-neutral-50',
        )}
      >
        <Typography
          as="span"
          variant="14/regular"
          sm="16/regular"
          color={empty ? 'neutral-400' : 'secondary'}
          className="min-w-0 whitespace-pre-wrap break-words"
        >
          {empty ? '—' : value}
        </Typography>
      </div>
    </div>
  )
}

/** A two-column grid of fields; one column on a phone. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

interface AnswerEntry {
  key: string
  label: string
  value: string
  wide: boolean
}

/**
 * The stored answers of an application with the labels the service's form gave them. Fields the form still
 * lists come first, in its order; an answer the form no longer has keeps its own key as the label so no stored
 * value is hidden. `applicationTeam` is a structured list shown elsewhere.
 */
export function answerEntries(answers: Record<string, unknown> | null | undefined, fields: readonly RequestFormField[]): AnswerEntry[] {
  const stored = Object.entries(answers ?? {}).filter(([key]) => key !== 'applicationTeam')
  const byName = new Map(stored)
  const known = fields.flatMap((field) => (byName.has(field.name) ? [field] : []))
  const knownNames = new Set(known.map((field) => field.name))
  const entries: AnswerEntry[] = []

  const add = (key: string, label: string, raw: unknown, field?: RequestFormField) => {
    const option = field?.options?.find((item) => item.value === String(raw))
    const value = option ? option.label : answerText(raw)
    const long = field ? /textarea|richText/i.test(field.blockType) : false
    entries.push({ key, label, value, wide: long || value.length > 80 || value.includes('\n') })
  }
  for (const field of known) add(field.name, field.label || field.name, byName.get(field.name), field)
  for (const [key, raw] of stored) if (!knownNames.has(key)) add(key, key, raw)
  return entries
}

/** The company's and staff's view of the application form's answers. */
export function AnswerFields({ entries, tone }: { entries: AnswerEntry[]; tone: FieldTone }) {
  return (
    <FieldGrid>
      {entries.map((entry) => (
        <LabelledField key={entry.key} label={entry.label} value={entry.value} tone={tone} wide={entry.wide} />
      ))}
    </FieldGrid>
  )
}

/**
 * The empty state of «اطلاعات و فرم رویداد» (no Figma frame yet): a request with no stored answer and no
 * team. It says why the card is empty and what happens next, for the company as a draft or as a case that
 * has none, and for staff, without a control the page does not have.
 */
export function RequestFormEmptyState({ audience }: { audience: 'company-draft' | 'company' | 'staff' }) {
  const body =
    audience === 'company-draft'
      ? 'با تکمیل و ارسال فرم درخواست، پاسخ‌های شما در همین بخش نمایش داده می‌شود.'
      : audience === 'company'
        ? 'برای این درخواست پاسخی در فرم رویداد ثبت نشده است. فایل‌های پروپوزال در بخش مدارک همین صفحه دیده می‌شوند.'
        : 'متقاضی در فرم رویداد پاسخی ثبت نکرده است. فایل‌های پروپوزال در بخش مدارک همین صفحه دیده می‌شوند.'
  return (
    <div
      data-testid="request-form-empty"
      className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <DocumentTextIcon className="size-6" aria-hidden="true" />
      </span>
      <Typography as="h3" variant="16/semibold" color="neutral-700">
        هنوز اطلاعاتی در فرم ثبت نشده است
      </Typography>
      <Typography as="p" variant="14/regular" color="neutral-500" className="max-w-md">
        {body}
      </Typography>
    </div>
  )
}
