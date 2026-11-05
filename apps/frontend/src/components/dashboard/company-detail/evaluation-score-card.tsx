'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  decideReview,
  decideTriage,
  type RequestAction,
} from '@/utilities/dashboard-api'

type Outcome = 'approve' | 'reject'

const REFUSALS: Record<string, string> = {
  stale_revision: 'نسخه درخواست تغییر کرده است. صفحه را تازه کنید و دوباره بررسی کنید.',
  reason_required: 'برای رد درخواست، نوشتن متن پیام الزامی است.',
  forbidden: 'شما اجازه ثبت تصمیم برای این درخواست را ندارید.',
  invalid_triage_state: 'درخواست در مرحله‌ای نیست که بتوان آن را بررسی اولیه کرد.',
  invalid_decision_state: 'درخواست در مرحله‌ای نیست که بتوان برایش تصمیم ثبت کرد.',
  round_not_ready: 'ارزیابی‌های این دور هنوز کامل نشده است.',
}

/**
 * The decision box of the evaluation form (Figma 30632:24135). Approve and reject map to the
 * server's triage or review decision, whichever the request currently allows the viewer.
 */
export function EvaluationScoreCard({
  requestId,
  revision,
  allowedActions,
  requestHref,
}: {
  requestId: string
  revision?: number
  allowedActions: readonly RequestAction[]
  requestHref: string
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stage = allowedActions.includes('triage') ? 'triage' : allowedActions.includes('decideReview') ? 'review' : null

  const submit = async (outcome: Outcome) => {
    if (!stage) return
    const reason = message.trim()
    if (outcome === 'reject' && !reason) {
      setError(REFUSALS.reason_required ?? null)
      return
    }
    setSubmitting(outcome)
    setError(null)
    try {
      if (stage === 'triage') {
        await decideTriage(requestId, outcome === 'approve' ? 'accept' : 'reject', reason, revision)
      } else {
        await decideReview(requestId, outcome === 'approve' ? 'advance' : 'reject', reason, revision)
      }
      toast.success(outcome === 'approve' ? 'درخواست تایید شد.' : 'درخواست رد شد.')
      router.push(requestHref)
      router.refresh()
    } catch (caught) {
      const code = caught instanceof DashboardApiError ? caught.code : ''
      setError(REFUSALS[code] ?? 'ثبت تصمیم انجام نشد. ارتباط را بررسی و دوباره تلاش کنید.')
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <section
      aria-label="ثبت امتیاز"
      className="flex flex-col gap-5 rounded-2xl border border-brand-400 bg-background p-4"
    >
      <Typography as="h2" variant="20/bold" color="secondary">
        ثبت امتیاز
      </Typography>

      <div className="flex flex-col gap-2">
        <Typography as="label" htmlFor="evaluation-message" variant="16/semibold" color="neutral-700">
          متن پیام
        </Typography>
        <Textarea
          id="evaluation-message"
          rows={6}
          placeholder="متن پیام"
          value={message}
          disabled={!stage || submitting !== null}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      {error ? (
        <Typography role="alert" variant="14/regular" color="error">
          {error}
        </Typography>
      ) : null}
      {!stage ? (
        <Typography variant="14/regular" color="muted">
          در این مرحله امکان ثبت تصمیم برای شما وجود ندارد.
        </Typography>
      ) : null}

      <div className="flex items-start gap-2">
        <Button
          type="button"
          variant="outline-gray"
          size="40"
          className="flex-1"
          disabled={!stage || submitting !== null}
          loading={submitting === 'reject'}
          onClick={() => void submit('reject')}
        >
          رد درخواست
        </Button>
        <Button
          type="button"
          variant="primary"
          size="40"
          className="flex-1"
          disabled={!stage || submitting !== null}
          loading={submitting === 'approve'}
          onClick={() => void submit('approve')}
        >
          تایید درخواست
        </Button>
      </div>
    </section>
  )
}
