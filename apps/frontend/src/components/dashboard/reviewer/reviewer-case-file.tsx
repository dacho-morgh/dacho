'use client'

import Link from 'next/link'
import { useCallback, useRef, useState } from 'react'

import { DetailCard, InfoField, ReadonlyField } from '@/components/dashboard/company-detail/company-detail-parts'
import { RequestCompanyCard } from '@/components/dashboard/request-detail/request-company-card'
import { RequestDetailShell } from '@/components/dashboard/request-detail/request-detail-shell'
import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { getLoginUrl } from '@/utilities/auth-return-url'
import { formatDate } from '@/utilities/dashboard-api'
import {
  answerText,
  caseFileChanged,
  formatFileSize,
  ownEvaluationLabel,
  REVIEW_WORK_STATE_LABELS,
  reviewerRoleLabel,
  reviewWorkState,
  type ReviewCaseFileDto,
} from '@/utilities/reviewer-case'

import { useRevalidateOnFocus } from './use-revalidate'

/** The server's answer to `GET /review/cases/:id`, as the page first read it. */
export type ReviewerCaseInitial =
  | { kind: 'ok'; data: ReviewCaseFileDto }
  | { kind: 'not-assigned' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'error' }

export type ReviewerCaseState =
  | { kind: 'ready'; data: ReviewCaseFileDto; notice: 'changed' | 'unverified' | null }
  /** The assignment ended while the page was open: the case data is gone from the page. */
  | { kind: 'revoked' }
  | { kind: 'not-assigned' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  | { kind: 'error' }

const fromInitial = (initial: ReviewerCaseInitial): ReviewerCaseState =>
  initial.kind === 'ok' ? { kind: 'ready', data: initial.data, notice: null } : initial

const PROFILE_FIELDS: [section: 'company' | 'dossier', key: string, label: string][] = [
  ['company', 'name', 'نام شرکت'],
  ['company', 'nationalId', 'شناسه ملی'],
  ['company', 'type', 'نوع شرکت'],
  ['company', 'province', 'استان'],
  ['company', 'city', 'شهر'],
  ['dossier', 'legalEntityType', 'نوع شخصیت حقوقی'],
  ['dossier', 'classification', 'طبقه‌بندی شرکت'],
  ['dossier', 'activityDomain', 'حوزه فعالیت اصلی'],
  ['dossier', 'productsServices', 'محصولات و خدمات'],
]

export interface ReviewerCaseFileProps {
  requestId: string
  initial: ReviewerCaseInitial
}

/**
 * An assigned reviewer's or employer's case file: the reviewed proposal
 * revision with its pinned files, the pinned RFP, the necessary company profile
 * and this person's own evaluation state. Nothing here is chosen by the
 * browser: the server answers 404 for anyone without an active assignment, and
 * the response never carries other reviewers, scores or financial files.
 *
 * The page asks again on focus and on an interval. A 404/403/401 removes the
 * case from the page; a changed round or revision replaces it and says so.
 */
export function ReviewerCaseFile({ requestId, initial }: ReviewerCaseFileProps) {
  const [state, setState] = useState<ReviewerCaseState>(() => fromInitial(initial))
  const inFlight = useRef(false)
  const path = `/dashboard/requests/${encodeURIComponent(requestId)}`

  const revalidate = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      let response: Response
      try {
        response = await fetch(`/api/dashboard/review/cases/${encodeURIComponent(requestId)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
      } catch {
        setState((current) => (current.kind === 'ready' ? { ...current, notice: 'unverified' } : current))
        return
      }
      if (response.status === 404) {
        setState((current) => (current.kind === 'ready' || current.kind === 'revoked' ? { kind: 'revoked' } : { kind: 'not-assigned' }))
        return
      }
      if (response.status === 403) return setState({ kind: 'denied' })
      if (response.status === 401) return setState({ kind: 'expired' })
      if (!response.ok) {
        setState((current) => (current.kind === 'ready' ? { ...current, notice: 'unverified' } : current))
        return
      }
      const next = (await response.json()) as ReviewCaseFileDto
      setState((current) => ({
        kind: 'ready',
        data: next,
        // Once the case changed under the reader, the notice stays until they reload.
        notice:
          current.kind === 'ready' && (current.notice === 'changed' || caseFileChanged(current.data, next))
            ? 'changed'
            : null,
      }))
    } finally {
      inFlight.current = false
    }
  }, [requestId])

  useRevalidateOnFocus(() => void revalidate())

  if (state.kind !== 'ready') return <ReviewerCaseUnavailable kind={state.kind} path={path} />

  const { data, notice } = state
  const item = data.case
  const work = reviewWorkState(item)
  const companyName = typeof data.company?.company?.name === 'string' ? data.company.company.name.trim() : ''
  const companyFacts = [
    ...new Set(
      (['type', 'province', 'city'] as const).flatMap((key) => {
        const value = data.company?.company?.[key]
        return typeof value === 'string' && value.trim() ? [value.trim()] : []
      }),
    ),
  ]
  const evaluable = work === 'open' && item.evaluation?.state !== 'final'

  return (
    <RequestDetailShell
      title={companyName ? `درخواست ${companyName}` : item.title}
      actions={
        <Button asChild size="40" variant={evaluable ? 'default' : 'outline-gray'}>
          <Link href={`${path}/evaluation`}>
            <Typography as="span" variant="14/regular" className="text-inherit">
              {evaluable ? (item.evaluation ? 'ادامه فرم ارزیابی' : 'شروع فرم ارزیابی') : 'مشاهده فرم ارزیابی'}
            </Typography>
          </Link>
        </Button>
      }
      notices={
        <>
          {notice === 'changed' ? (
            <Banner tone="warning">این پرونده پس از باز شدن صفحه تغییر کرده است. اطلاعات تازه نمایش داده می‌شود.</Banner>
          ) : null}
          {notice === 'unverified' ? (
            <Banner tone="warning">بررسی دوباره دسترسی انجام نشد. اطلاعات ممکن است به‌روز نباشد؛ صفحه را دوباره بارگذاری کنید.</Banner>
          ) : null}
          {work !== 'open' ? <Banner tone="neutral">{REVIEW_WORK_STATE_LABELS[work]}. فقط نسخه‌ای که به شما ارجاع شده بود قابل مشاهده است.</Banner> : null}
        </>
      }
    >
      {companyName ? <RequestCompanyCard name={companyName} facts={companyFacts} /> : null}

      <DetailCard title="اطلاعات داوری">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label="نقش شما" value={reviewerRoleLabel(item)} />
          <InfoField label="وضعیت داوری" value={REVIEW_WORK_STATE_LABELS[work]} />
          <InfoField label="ارزیابی شما" value={ownEvaluationLabel(item.evaluation)} />
          <InfoField label="نسخه پروپوزال مورد داوری" value={item.proposalRevision?.toLocaleString('fa-IR') ?? '—'} />
          <InfoField label="تاریخ ارجاع" value={formatDate(item.assignment.assignedAt)} />
          <InfoField label="تاریخ ثبت درخواست" value={formatDate(item.submissionDate) || 'ثبت نشده'} />
        </div>
      </DetailCard>

      <DetailCard title="اطلاعات شرکت">
        {data.company ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {PROFILE_FIELDS.map(([section, key, label]) => (
              <ReadonlyField key={`${section}.${key}`} label={label} value={answerText(data.company?.[section]?.[key])} />
            ))}
          </div>
        ) : (
          <Typography variant="14/regular" color="neutral-500">پروفایلی همراه این درخواست ثبت نشده است.</Typography>
        )}
      </DetailCard>

      <DetailCard title="اطلاعات و فرم رویداد">
        <div className="flex min-w-0 flex-col gap-1">
          <Typography as="h3" variant="16/semibold" color="neutral-900" className="break-words">{item.title}</Typography>
          <Typography variant="14/regular" color="neutral-500" className="break-words">
            <span className="font-mono">{item.trackingCode}</span>
            {item.event ? ` · ${item.event.title}${item.subtopic ? ` · ${item.subtopic.title}` : ''}` : ''}
          </Typography>
        </div>
        {data.proposal ? (
          <>
            <Typography variant="14/regular" color="neutral-500">
              نسخه {data.proposal.revision.toLocaleString('fa-IR')} · ثبت در {formatDate(data.proposal.createdAt)}
            </Typography>
            {data.proposal.answers && Object.keys(data.proposal.answers).length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(data.proposal.answers)
                  .filter(([key]) => key !== 'applicationTeam')
                  .map(([key, value]) => (
                    <ReadonlyField key={key} label={key} value={answerText(value)} />
                  ))}
              </div>
            ) : null}
            {data.proposal.applicationTeam.length ? (
              <div className="flex flex-col gap-3">
                <Typography as="h3" variant="16/semibold" color="neutral-900">تیم متقاضی</Typography>
                <ul className="flex flex-col gap-2">
                  {data.proposal.applicationTeam.map((member, index) => (
                    <li key={`${index}-${member.name}`} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                      <Typography variant="14/regular" color="neutral-800" className="break-words">
                        {member.name} · {member.role}{member.relation ? ` · ${member.relation}` : ''}
                      </Typography>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-col gap-3">
              <Typography as="h3" variant="16/semibold" color="neutral-900">فایل‌های پروپوزال</Typography>
              {data.proposal.documents.length ? (
                <ul className="flex flex-col gap-2">
                  {data.proposal.documents.map((file) => (
                    <li key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                      <FileName name={file.filename} size={file.sizeBytes} />
                      <PrivateDocumentDownload documentId={file.id} filename={file.filename} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Typography variant="14/regular" color="neutral-500">فایلی برای این نسخه ثبت نشده است.</Typography>
              )}
            </div>
          </>
        ) : (
          <Typography variant="14/regular" color="neutral-500">نسخه ثبت‌شده‌ای از پروپوزال برای این پرونده وجود ندارد.</Typography>
        )}
      </DetailCard>

      <DetailCard title="RFP رویداد">
        {data.rfp?.files.length ? (
          <>
            <ul className="flex flex-col gap-2">
              {data.rfp.files.map((file) => (
                <li key={file.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                  <FileName name={file.filename} size={file.sizeBytes} />
                </li>
              ))}
            </ul>
            <Typography variant="12/regular" color="neutral-500">دریافت فایل‌های RFP از این صفحه هنوز فعال نیست.</Typography>
          </>
        ) : (
          <Typography variant="14/regular" color="neutral-500">فایل RFP برای این پرونده ثبت نشده است.</Typography>
        )}
      </DetailCard>
    </RequestDetailShell>
  )
}

export type ReviewerCaseUnavailableKind = Exclude<ReviewerCaseState, { kind: 'ready' }>['kind']

/** Why an assigned reviewer's page shows no case data; also used by the evaluation form route. */
export function ReviewerCaseUnavailable({ kind, path }: { kind: ReviewerCaseUnavailableKind; path: string }) {
  const state = { kind }
  const copy: Record<ReviewerCaseUnavailableKind, { title: string; body: string }> = {
    revoked: {
      title: 'دسترسی شما به این پرونده پایان یافته است',
      body: 'ارجاع این پرونده به شما لغو یا جایگزین شده است و اطلاعات آن دیگر نمایش داده نمی‌شود.',
    },
    'not-assigned': {
      title: 'این پرونده به شما ارجاع نشده است',
      body: 'فقط پرونده‌هایی که سردبیر به شما ارجاع داده قابل مشاهده‌اند. اگر نشانی را از جای دیگری دریافت کرده‌اید، از فهرست پرونده‌های خود اقدام کنید.',
    },
    denied: {
      title: 'دسترسی به پرونده‌های داوری مجاز نیست',
      body: 'نقش فعلی شما اجازه مشاهده این پرونده را ندارد.',
    },
    expired: {
      title: 'نشست شما پایان یافته است',
      body: 'برای ادامه کار دوباره وارد حساب خود شوید.',
    },
    error: {
      title: 'دریافت پرونده انجام نشد',
      body: 'ارتباط با سرویس برقرار نشد یا پاسخ نامعتبر بود. دوباره تلاش کنید.',
    },
  }
  const { title, body } = copy[state.kind]
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-10" dir="rtl">
      <section role="alert" data-state={state.kind} className="flex flex-col items-start gap-2 rounded-2xl border border-warning-500 bg-warning-50 p-4">
        <Typography as="h1" variant="16/semibold" color="neutral-700">{title}</Typography>
        <Typography variant="14/regular" color="neutral-600">{body}</Typography>
        <div className="flex flex-wrap gap-2">
          {state.kind === 'expired' ? (
            <Button asChild size="36">
              <Link href={getLoginUrl(path, { expired: true })}>
                <Typography as="span" variant="14/regular" className="text-inherit">ورود دوباره</Typography>
              </Link>
            </Button>
          ) : null}
          {state.kind === 'error' ? (
            <Button asChild size="36" variant="outline-gray">
              <Link href={path}>
                <Typography as="span" variant="14/regular" className="text-inherit">تلاش دوباره</Typography>
              </Link>
            </Button>
          ) : null}
          {state.kind !== 'expired' ? (
            <Button asChild size="36" variant="outline-gray">
              <Link href={state.kind === 'denied' ? '/dashboard' : '/dashboard/requests'}>
                <Typography as="span" variant="14/regular" className="text-inherit">
                  {state.kind === 'denied' ? 'بازگشت به پیشخوان' : 'پرونده‌های من'}
                </Typography>
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  )
}

function Banner({ tone, children }: { tone: 'warning' | 'neutral'; children: React.ReactNode }) {
  return (
    <Typography
      role="status"
      variant="14/regular"
      color="neutral-700"
      className={`rounded-xl p-3 ${tone === 'warning' ? 'border border-warning-500 bg-warning-50' : 'bg-neutral-100'}`}
    >
      {children}
    </Typography>
  )
}

function FileName({ name, size }: { name: string; size: number }) {
  return (
    <span className="flex min-w-0 flex-col">
      <Typography as="span" variant="14/regular" color="neutral-800" className="break-all">{name}</Typography>
      <Typography as="span" variant="12/regular" color="neutral-500">{formatFileSize(size)}</Typography>
    </span>
  )
}
