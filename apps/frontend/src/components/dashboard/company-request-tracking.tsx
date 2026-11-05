import type { ReactNode } from 'react'

import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  type ActivityDto,
  type PublishedResultDto,
  type RequestDto,
} from '@/utilities/dashboard-api'
import { companyNextAction, companyStageLabel, trackingOutcome } from '@/utilities/request-tracking'

type Part<T> = T | null | 'failed'

export interface CompanyRequestTrackingProps {
  request: Pick<RequestDto, 'status' | 'reviewStage' | 'currentStep' | 'revision' | 'trackingCode' | 'allowedActions'>
  timeline: readonly ActivityDto[]
  /** The proposal revision the company last submitted, from `GET /requests/:id/proposal`. */
  proposalRevision: Part<number>
  /** `GET /requests/:id/result`: only the released text and its date ever reach this component. */
  publishedResult: Part<{ result: PublishedResultDto | null }>
  /** Correction form, rendered only when the server lists `correct`. */
  correction?: ReactNode
  /** The page shows a published result itself (S6 outcome card), so this block stays out. */
  resultShownElsewhere?: boolean
}

const fa = (value: number) => value.toLocaleString('fa-IR')

/**
 * FE13: the company's tracking of one independent application. Stage, next
 * step, revisions, the chief's return or rejection with its reason, an owner's
 * reopen and the published result all come from the server's response for this
 * company. It never reads rounds, evaluations, memos or financial review data.
 */
export function CompanyRequestTracking({
  request,
  timeline,
  proposalRevision,
  publishedResult,
  correction,
  resultShownElsewhere = false,
}: CompanyRequestTrackingProps) {
  const outcome = trackingOutcome(request, timeline)
  const result = publishedResult === 'failed' ? null : publishedResult?.result

  return (
    <>
      <section
        aria-labelledby="tracking-heading"
        data-testid="company-tracking"
        className="flex min-w-0 flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-4 sm:p-6"
      >
        <Typography as="h2" id="tracking-heading" variant="20/bold" color="neutral-900">پیگیری درخواست</Typography>
        <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Item label="مرحله فعلی" value={companyStageLabel(request)} testId="tracking-stage" />
          <Item label="اقدام لازم از سوی شما" value={companyNextAction(request)} testId="tracking-next" />
          <Item
            label="آخرین نسخه ارسال‌شده پروپوزال"
            value={
              proposalRevision === 'failed'
                ? 'دریافت نشد'
                : proposalRevision
                  ? fa(proposalRevision)
                  : request.status === 'draft'
                    ? 'هنوز ارسال نشده'
                    : '—'
            }
            testId="tracking-proposal-revision"
          />
          <Item label="نسخه پرونده" value={request.revision ? fa(request.revision) : '—'} />
        </dl>

        {outcome?.kind === 'correction' ? (
          <Notice tone="warning" testId="tracking-correction">
            <Typography variant="14/semibold" color="neutral-800">
              {outcome.after === 'review'
                ? 'پروپوزال پس از داوری برای اصلاح به شما برگشته است.'
                : 'درخواست در بررسی اولیه برای اصلاح به شما برگشته است.'}
            </Typography>
            <Reason reason={outcome.reason} at={outcome.at} />
          </Notice>
        ) : null}

        {outcome?.kind === 'rejected' ? (
          <Notice tone="error" testId="tracking-rejected">
            <Typography variant="14/semibold" color="neutral-800">
              {outcome.after === 'review' ? 'این درخواست پس از داوری رد شد.' : 'این درخواست در بررسی اولیه رد شد.'}
            </Typography>
            <Reason reason={outcome.reason} at={outcome.at} />
            <Typography variant="14/regular" color="neutral-600">
              این رد فقط همین درخواست (همین رویداد و زیرعنوان) را می‌بندد و درخواست‌های دیگر شما مستقل باقی می‌مانند. بازگشایی تنها توسط صاحب سیستم انجام می‌شود و در صورت بازگشایی، وضعیت تازه در همین صفحه نمایش داده خواهد شد.
            </Typography>
          </Notice>
        ) : null}

        {outcome?.kind === 'reopened' ? (
          <Notice tone="neutral" testId="tracking-reopened">
            <Typography variant="14/semibold" color="neutral-800">
              این درخواست پس از رد، توسط صاحب سیستم بازگشایی شد و دوباره در بررسی اولیه است.
            </Typography>
            <Reason reason={outcome.reason} at={outcome.at} />
          </Notice>
        ) : null}

        {outcome?.kind === 'resubmitted' ? (
          <Notice tone="neutral" testId="tracking-resubmitted">
            <Typography variant="14/semibold" color="neutral-800">
              اصلاحیه شما در {formatDate(outcome.at)} ارسال شد و پرونده دوباره در بررسی اولیه است.
            </Typography>
            {outcome.newRound ? (
              <Typography variant="14/regular" color="neutral-600">
                پس از بررسی اولیه، یک دور داوری تازه برای نسخه اصلاح‌شده آغاز می‌شود.
              </Typography>
            ) : null}
          </Notice>
        ) : null}
      </section>

      {correction}

      {publishedResult === 'failed' ? (
        <Typography role="alert" variant="14/regular" color="error">
          دریافت نتیجه پرونده انجام نشد. صفحه را دوباره بارگذاری کنید.
        </Typography>
      ) : result && resultShownElsewhere ? null : result ? (
        <section data-testid="published-result" className="flex min-w-0 flex-col gap-2 rounded-2xl border border-brand-600 bg-background p-4 sm:p-6">
          <Typography as="h2" variant="20/bold" className="text-neutral-900">نتیجه پرونده</Typography>
          <Typography variant="12/regular" className="text-neutral-500">تاریخ انتشار: {formatDate(result.publishedAt)}</Typography>
          <Typography variant="16/regular" className="whitespace-pre-wrap break-words text-neutral-800">{result.body}</Typography>
        </section>
      ) : request.status === 'in_review' && request.reviewStage === 'advanced' ? (
        <Typography variant="14/regular" color="neutral-500" data-testid="result-pending">
          نتیجه این پرونده هنوز منتشر نشده است. پس از انتشار توسط دبیرخانه، متن آن در همین صفحه نمایش داده می‌شود.
        </Typography>
      ) : null}
    </>
  )
}

function Item({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-neutral-50 p-3">
      <dt>
        <Typography as="span" variant="12/regular" color="neutral-500">{label}</Typography>
      </dt>
      <dd data-testid={testId}>
        <Typography as="span" variant="16/regular" color="neutral-800" className="mt-1 block break-words">{value}</Typography>
      </dd>
    </div>
  )
}

function Reason({ reason, at }: { reason: string | null; at: string }) {
  return (
    <>
      <Typography variant="12/regular" color="neutral-500">{formatDate(at)}</Typography>
      {reason ? (
        <Typography variant="14/regular" color="neutral-700" className="whitespace-pre-wrap break-words" data-testid="tracking-reason">
          دلیل: {reason}
        </Typography>
      ) : null}
    </>
  )
}

function Notice({ tone, testId, children }: { tone: 'warning' | 'error' | 'neutral'; testId: string; children: ReactNode }) {
  const toneClass =
    tone === 'error' ? 'border-error-100 bg-error-50' : tone === 'warning' ? 'border-warning-400 bg-warning-50' : 'border-neutral-200 bg-neutral-50'
  return (
    <div data-testid={testId} className={`flex min-w-0 flex-col gap-2 rounded-xl border p-4 ${toneClass}`}>
      {children}
    </div>
  )
}
