'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  describeMutationFailure,
  formatDate,
  getFinancialInvitation,
  getFinancialPackage,
  submitFinancialPackage,
  type FinancialInvitationDto,
  type FinancialPackageDto,
} from '@/utilities/dashboard-api'
import { documentCategoryLabel, type DocumentCategory } from '@/utilities/document-categories'
import type { PrivateDocumentDto } from '@/utilities/document-api'

import {
  FinancialBanner,
  FinancialCard,
  FinancialFacts,
  FinancialSteps,
  faNumber,
  faYear,
  type StepState,
} from './financial-parts'

type Load =
  | { kind: 'loading' }
  | { kind: 'closed' }
  | { kind: 'error' }
  | { kind: 'ready'; invitation: FinancialInvitationDto; statementYears: number[] | null; pkg: FinancialPackageDto | null }

type Gaps = { categories: DocumentCategory[]; years: number[] }

/** One upload slot: a checklist category, and for statements one slot per required year. */
interface Slot {
  key: string
  category: DocumentCategory
  title: string
  year?: number
}

const SUBMIT_ERRORS: Record<string, string> = {
  financial_stage_not_open: 'مرحله مالی این پرونده باز نیست یا تغییر کرده است. صفحه را تازه کنید.',
  establishment_date_unavailable:
    'سال تأسیس شرکت در پروفایل خوانا نیست، پس سال‌های صورت مالی مشخص نمی‌شود. تاریخ تأسیس را در پروفایل شرکت اصلاح کنید و دوباره ارسال کنید.',
  not_found: 'این پرونده دیگر در دسترس شما نیست.',
}

function slotsFor(invitation: FinancialInvitationDto, statementYears: number[] | null): Slot[] {
  return invitation.checklist.flatMap((item): Slot[] => {
    if (item.category === 'financialStatements' && statementYears?.length) {
      return statementYears.map((year) => ({
        key: `${item.category}-${year}`,
        category: item.category,
        title: `${item.title} سال ${faYear(year)}`,
        year,
      }))
    }
    return [{ key: item.category, category: item.category, title: item.title }]
  })
}

/**
 * FE19 (Figma 19 and 25): the company's financial package. Before submission it is the
 * checklist with one upload per category and statement year; the server alone decides
 * completeness, and its gaps are shown as it reported them. After submission it is the
 * read-only status of the frozen package. Nothing renders before the chief advances.
 */
export function FinancialPackagePanel({
  requestId,
  trackingCode,
  canSubmit,
  resultPublished,
}: {
  requestId: string
  trackingCode: string | null
  /** The server lists `submitFinancialPackage` for this company. */
  canSubmit: boolean
  /** A result is published: the investment review is over for the company. */
  resultPublished: boolean
}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [gaps, setGaps] = useState<Gaps | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [filled, setFilled] = useState<Record<string, boolean>>({})

  const read = useCallback(async () => {
    try {
      const [invitation, pkg] = await Promise.all([
        getFinancialInvitation(requestId),
        getFinancialPackage(requestId).then(
          (found) => found.package,
          (cause: unknown) => {
            if (cause instanceof DashboardApiError && cause.status === 404) return null
            throw cause
          },
        ),
      ])
      setLoad({ kind: 'ready', invitation: invitation.invitation, statementYears: invitation.statementYears, pkg })
    } catch (cause) {
      // Before advancement, or for a role outside the financial audience, the section does not exist.
      const closed = cause instanceof DashboardApiError && [403, 404, 409].includes(cause.status)
      setLoad({ kind: closed ? 'closed' : 'error' })
    }
  }, [requestId])

  useEffect(() => {
    void read()
  }, [read])

  const slots = useMemo(
    () => (load.kind === 'ready' ? slotsFor(load.invitation, load.statementYears) : []),
    [load],
  )
  const onPending = useCallback((key: string, value: boolean) => setPending((current) => ({ ...current, [key]: value })), [])
  const onDocuments = useCallback(
    (key: string, documents: PrivateDocumentDto[]) => setFilled((current) => ({ ...current, [key]: documents.length > 0 })),
    [],
  )

  if (load.kind === 'closed') return null
  if (load.kind === 'loading') {
    return (
      <FinancialCard title="بسته مالی">
        <Typography role="status" variant="14/regular" color="neutral-500">در حال دریافت بسته مالی…</Typography>
      </FinancialCard>
    )
  }
  if (load.kind === 'error') {
    return (
      <FinancialCard title="بسته مالی">
        <div className="flex flex-wrap items-center gap-3">
          <Typography role="alert" variant="14/regular" color="error">دریافت بسته مالی انجام نشد.</Typography>
          <Button type="button" variant="outline-gray" size="32" onClick={() => { setLoad({ kind: 'loading' }); void read() }}>
            <Typography variant="12/semibold" className="text-inherit">تلاش دوباره</Typography>
          </Button>
        </div>
      </FinancialCard>
    )
  }

  if (load.pkg) {
    return <SubmittedPackage pkg={load.pkg} trackingCode={trackingCode} resultPublished={resultPublished} />
  }

  const { invitation, statementYears } = load
  const uploading = Object.values(pending).some(Boolean)
  const readyCount = slots.filter((slot) => filled[slot.key]).length

  const submit = async () => {
    setBusy(true)
    setFailure(null)
    try {
      const result = await submitFinancialPackage(requestId)
      if (result.kind === 'incomplete') {
        setGaps({ categories: result.missingCategories, years: result.missingStatementYears })
        return
      }
      setGaps(null)
      setLoad({ ...load, pkg: result.package })
    } catch (cause) {
      const code = cause instanceof DashboardApiError ? cause.code : ''
      setFailure(SUBMIT_ERRORS[code] ?? describeMutationFailure(cause, 'ارسال بسته مالی انجام نشد. دوباره تلاش کنید.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="financial-package-form">
      <FinancialBanner tone="info" title="درخواست تکمیل بسته مالی دریافت شد">
        مدارک مالی هر مورد را بارگذاری کنید و بسته را برای بررسی سرمایه‌گذاری ارسال کنید. تاریخ دعوت: {formatDate(invitation.invitedAt)}
      </FinancialBanner>
      <FinancialCard title="مدارک بسته مالی" headingId="financial-package-heading">
        <Typography variant="14/regular" color="neutral-500">
          هر فایل به‌محض بارگذاری ذخیره می‌شود و می‌توانید بعداً ادامه دهید. پس از ارسال، فایل‌های مالی این پرونده قفل می‌شوند.
        </Typography>
        {statementYears === null ? (
          <FinancialBanner tone="warning" title="سال‌های صورت مالی مشخص نیست">
            سال تأسیس شرکت در پروفایل خوانا نیست. برای ارسال بسته، تاریخ تأسیس را در{' '}
            <Link href="/dashboard/profile" className="underline">پروفایل شرکت</Link> اصلاح کنید.
          </FinancialBanner>
        ) : statementYears.length ? (
          <Typography variant="12/regular" color="neutral-500">
            صورت مالی هر یک از این سال‌ها لازم است: {statementYears.map(faYear).join('، ')}
          </Typography>
        ) : null}
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2" aria-labelledby="financial-package-heading">
          {slots.map((slot) => (
            <li key={slot.key} className="min-w-0" data-testid="financial-package-slot">
              <PrivateDocumentField
                category={slot.category}
                label={slot.title}
                statementYear={slot.year}
                requestId={requestId}
                required
                canUpload={canSubmit}
                canDelete={canSubmit}
                readOnly={!canSubmit}
                onPendingChange={(value) => onPending(slot.key, value)}
                onDocumentsChange={(documents) => onDocuments(slot.key, documents)}
              />
            </li>
          ))}
        </ul>

        {gaps ? <GapsNotice gaps={gaps} invitation={invitation} /> : null}
        {failure ? (
          <FinancialBanner tone="error" title="بسته مالی ارسال نشد" role="alert">{failure}</FinancialBanner>
        ) : null}

        {canSubmit ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Typography variant="12/regular" color="neutral-500" data-testid="financial-package-progress">
              {faNumber(readyCount)} از {faNumber(slots.length)} مورد بارگذاری شده
            </Typography>
            <Button type="button" size="40" disabled={busy || uploading} onClick={() => void submit()}>
              <Typography variant="14/semibold" className="text-inherit">
                {busy ? 'در حال ارسال…' : 'ثبت و ارسال بسته مالی'}
              </Typography>
            </Button>
          </div>
        ) : (
          <Typography variant="14/regular" color="neutral-500">ارسال بسته مالی برای این پرونده فعال نیست.</Typography>
        )}
      </FinancialCard>
    </div>
  )
}

function GapsNotice({ gaps, invitation }: { gaps: Gaps; invitation: FinancialInvitationDto }) {
  const titleOf = (category: DocumentCategory) =>
    invitation.checklist.find((item) => item.category === category)?.title ?? documentCategoryLabel(category)
  return (
    <FinancialBanner tone="error" title="بسته کامل نیست و ارسال نشد" role="alert" testId="financial-package-gaps">
      <ul className="mt-1 list-inside list-disc">
        {gaps.categories.map((category) => (
          <li key={category}>{titleOf(category)}</li>
        ))}
        {gaps.years.map((year) => (
          <li key={year}>صورت مالی سال {faYear(year)}</li>
        ))}
      </ul>
    </FinancialBanner>
  )
}

/** Figma 25: the submitted package's status, and the frozen files the company sent. */
function SubmittedPackage({
  pkg,
  trackingCode,
  resultPublished,
}: {
  pkg: FinancialPackageDto
  trackingCode: string | null
  resultPublished: boolean
}) {
  const review: StepState = resultPublished ? 'done' : 'current'
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="financial-package-submitted">
      {resultPublished ? null : (
        <FinancialBanner tone="success" title="بسته مالی با موفقیت ثبت شد">
          پرونده برای بررسی به مسئول سرمایه‌گذاری ارسال شده است. نتیجه پس از انتشار دبیرخانه در همین صفحه نمایش داده می‌شود.
        </FinancialBanner>
      )}
      <FinancialCard title="وضعیت پرونده مالی">
        <FinancialFacts
          items={[
            { label: 'کد رهگیری', value: trackingCode ? <bdi dir="ltr">{trackingCode}</bdi> : '—' },
            { label: 'تاریخ ارسال', value: formatDate(pkg.submittedAt) },
            { label: 'فایل‌های مالی', value: `${faNumber(pkg.documents.length)} فایل دریافت شده`, testId: 'financial-package-count' },
            { label: 'مرحله فعلی', value: resultPublished ? 'نتیجه منتشر شده' : 'بررسی سرمایه‌گذاری' },
          ]}
        />
        <FinancialSteps
          steps={[
            { label: 'ثبت درخواست و بررسی اولیه', state: 'done' },
            { label: 'ارزیابی چهار داور', state: 'done' },
            { label: 'تکمیل و ارسال بسته مالی', state: 'done' },
            { label: 'بررسی سرمایه‌گذاری', state: review },
            { label: 'اعلام نتیجه نهایی', state: resultPublished ? 'done' : 'pending' },
          ]}
        />
        <details className="group rounded-xl border border-neutral-200">
          <summary className="cursor-pointer list-none p-4">
            <Typography as="span" variant="14/semibold" color="brand-600">فایل‌های ارسال‌شده ({faNumber(pkg.documents.length)})</Typography>
          </summary>
          <ul className="flex flex-col gap-2 px-4 pb-4">
            {pkg.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <Typography variant="14/regular" color="neutral-800" className="break-all"><bdi dir="auto">{document.filename}</bdi></Typography>
                  <Typography variant="12/regular" color="neutral-500">
                    {documentCategoryLabel(document.category)}
                    {document.statementYear ? ` · سال ${faYear(document.statementYear)}` : ''}
                  </Typography>
                </div>
                <PrivateDocumentDownload documentId={document.id} filename={document.filename} />
              </li>
            ))}
          </ul>
        </details>
        <Button asChild size="40" className="w-fit">
          <Link href="/dashboard/inbox">
            <Typography as="span" variant="14/semibold" className="text-inherit">مشاهده کارتابل</Typography>
          </Link>
        </Button>
      </FinancialCard>
    </div>
  )
}
