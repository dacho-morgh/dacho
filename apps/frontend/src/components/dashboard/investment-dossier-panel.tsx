'use client'

import { useCallback, useEffect, useState } from 'react'

import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { DashboardApiError, formatDate, getInvestmentCase, type InvestmentCaseDto } from '@/utilities/dashboard-api'
import { documentCategoryLabel } from '@/utilities/document-categories'
import { formatHundredths } from '@/utilities/review-evaluation'

import { FinancialBanner, FinancialCard, FinancialFacts, faNumber, faYear } from './financial-parts'
import { InvestmentMemoPanel } from './investment-memo-panel'

type Load = { kind: 'loading' } | { kind: 'absent' } | { kind: 'error' } | { kind: 'ready'; dossier: InvestmentCaseDto }

/** Four final evaluations make a complete round; the server already drops drafts and departed slots. */
const REQUIRED_EVALUATIONS = 4

/**
 * FE20 (Figma 14 and 15): the case as the investment person holding it reads it: the
 * frozen financial package, the round's final evaluations without their authors, the
 * supplementary files the Secretariat delivered, and the memo. It has no decision
 * controls. Before the handoff the server answers 404 and the section does not exist.
 */
export function InvestmentDossierPanel({ id }: { id: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const read = useCallback(async () => {
    try {
      setLoad({ kind: 'ready', dossier: await getInvestmentCase(id) })
    } catch (cause) {
      const absent = cause instanceof DashboardApiError && (cause.status === 403 || cause.status === 404)
      setLoad({ kind: absent ? 'absent' : 'error' })
    }
  }, [id])

  useEffect(() => {
    void read()
  }, [read])

  if (load.kind === 'absent') return null
  if (load.kind === 'loading') {
    return (
      <FinancialCard title="پرونده مالی و نتایج داوری">
        <Typography role="status" variant="14/regular" color="neutral-500">در حال دریافت پرونده…</Typography>
      </FinancialCard>
    )
  }
  if (load.kind === 'error') {
    return (
      <FinancialCard title="پرونده مالی و نتایج داوری">
        <div className="flex flex-wrap items-center gap-3">
          <Typography role="alert" variant="14/regular" color="error">دریافت پرونده مالی انجام نشد.</Typography>
          <Button type="button" variant="outline-gray" size="32" onClick={() => { setLoad({ kind: 'loading' }); void read() }}>
            <Typography variant="12/semibold" className="text-inherit">تلاش دوباره</Typography>
          </Button>
        </div>
      </FinancialCard>
    )
  }

  const { case: summary, package: pkg, evaluations, supplementaryFiles } = load.dossier
  const complete = evaluations.length >= REQUIRED_EVALUATIONS
  const ordered = [...evaluations].sort((a, b) => (a.variant === b.variant ? 0 : a.variant === 'employer' ? -1 : 1))
  const firstReviewer = ordered.findIndex((item) => item.variant !== 'employer')

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="investment-dossier">
      <FinancialBanner
        tone={complete ? 'success' : 'warning'}
        title={complete ? 'پرونده کامل · آماده یادداشت سرمایه‌گذاری' : 'ارزیابی‌های این پرونده کامل نیست'}
      >
        {complete
          ? 'بسته مالی و هر چهار ارزیابی نهایی دریافت شده‌اند.'
          : `${faNumber(evaluations.length)} از ${faNumber(REQUIRED_EVALUATIONS)} ارزیابی نهایی در پرونده است.`}
      </FinancialBanner>

      <FinancialCard title="خلاصه بسته مالی">
        <FinancialFacts
          items={[
            { label: 'شرکت', value: summary.companyName ?? 'نامشخص' },
            { label: 'رویداد', value: summary.event?.title ?? '—' },
            { label: 'تاریخ ارسال بسته', value: formatDate(pkg.submittedAt) },
            { label: 'نسخه بسته', value: faNumber(pkg.packageVersion) },
            {
              label: 'سال‌های صورت مالی',
              value: pkg.statementYears.length ? pkg.statementYears.map(faYear).join('، ') : '—',
            },
            { label: 'فایل‌های مالی', value: `${faNumber(pkg.documents.length)} فایل` },
          ]}
        />
      </FinancialCard>

      <FinancialCard title="نمره‌ها و فایل‌های پرونده" headingId="investment-dossier-parts">
        <div className="flex flex-col gap-3">
          <Typography as="h3" variant="16/semibold" color="neutral-900">ارزیابی‌های نهایی</Typography>
          {ordered.length ? (
            <ul className="flex flex-col divide-y divide-neutral-100" data-testid="investment-evaluations">
              {ordered.map((item, index) => {
                const label = item.variant === 'employer' ? 'ارزیابی کارفرما' : `ارزیابی داور ${faNumber(index - firstReviewer + 1)}`
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <Typography variant="14/regular" color="neutral-800">{label}</Typography>
                    <Typography variant="14/semibold" color="neutral-900">
                      امتیاز وزنی {item.weightedHundredths === undefined ? '—' : formatHundredths(item.weightedHundredths)}
                    </Typography>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Typography variant="14/regular" color="neutral-400">ارزیابی نهایی‌ای در پرونده نیست.</Typography>
          )}
        </div>

        <div className="h-px bg-neutral-200" />
        <FileList
          title="بسته مالی ارسال‌شده"
          empty="فایلی در بسته نیست."
          testId="investment-package-files"
          files={pkg.documents.map((document) => ({
            id: document.id,
            filename: document.filename,
            meta: `${documentCategoryLabel(document.category)}${document.statementYear ? ` · سال ${faYear(document.statementYear)}` : ''}`,
          }))}
        />

        <div className="h-px bg-neutral-200" />
        <FileList
          title="مدارک تکمیلی ارجاع‌شده از دبیرخانه"
          empty="دبیرخانه هنوز مدرک تکمیلی‌ای ارجاع نداده است."
          testId="investment-supplementary-files"
          files={supplementaryFiles.map((file) => ({
            id: file.id,
            filename: file.filename,
            meta: file.deliveredAt ? `ارجاع ${formatDate(file.deliveredAt)}` : '',
          }))}
        />
      </FinancialCard>

      <InvestmentMemoPanel id={id} companyName={summary.companyName} trackingCode={summary.trackingCode} />
    </div>
  )
}

function FileList({
  title,
  empty,
  files,
  testId,
}: {
  title: string
  empty: string
  files: { id: string; filename: string; meta: string }[]
  testId: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <Typography as="h3" variant="16/semibold" color="neutral-900">{title}</Typography>
      {files.length ? (
        <ul className="flex flex-col gap-2" data-testid={testId}>
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2">
              <div className="flex min-w-0 flex-col">
                <Typography variant="14/regular" color="neutral-800" className="break-all"><bdi dir="auto">{file.filename}</bdi></Typography>
                {file.meta ? <Typography variant="12/regular" color="neutral-500">{file.meta}</Typography> : null}
              </div>
              <PrivateDocumentDownload documentId={file.id} filename={file.filename} />
            </li>
          ))}
        </ul>
      ) : (
        <Typography variant="14/regular" color="neutral-400">{empty}</Typography>
      )}
    </div>
  )
}
