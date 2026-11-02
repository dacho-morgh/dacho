import { REQUEST_STATUS_LABELS, type RequestStats } from '@/utilities/dashboard-api'
import type { BreakdownRow } from './breakdown-card'

/** Booth requests in the order they move: attendance, receipt, review, done. */
export const BOOTH_ROWS: BreakdownRow[] = [
  {
    key: 'attendance_pending',
    label: 'در انتظار تأیید حضور',
    variant: 'primary',
    bar: 'bg-brand-600',
  },
  { key: 'receipt_due', label: 'در انتظار فیش', variant: 'gray', bar: 'bg-neutral-400' },
  {
    key: 'receipt_pending',
    label: 'فیش در حال بررسی',
    variant: 'secondary',
    bar: 'bg-secondary-600',
  },
  { key: 'confirmed', label: 'پرداخت تأیید شده', variant: 'green', bar: 'bg-success-500' },
  { key: 'rejected', label: 'رد شده', variant: 'red', bar: 'bg-error-500' },
]

export const VERIFICATION_ROWS: BreakdownRow[] = [
  { key: 'pending', label: 'در انتظار بررسی', variant: 'primary', bar: 'bg-brand-600' },
  { key: 'returned', label: 'برگشت داده شده', variant: 'yellow', bar: 'bg-warning-400' },
  { key: 'approved', label: 'تأیید شده', variant: 'green', bar: 'bg-success-500' },
  { key: 'rejected', label: 'رد شده', variant: 'red', bar: 'bg-error-500' },
]

/** The person's own evaluations only; the chart never shows scores. */
export const EVALUATION_ROWS: BreakdownRow[] = [
  { key: 'not_started', label: 'شروع‌نشده', variant: 'gray', bar: 'bg-neutral-400' },
  { key: 'draft', label: 'پیش‌نویس', variant: 'yellow', bar: 'bg-warning-400' },
  { key: 'final', label: 'نهایی', variant: 'green', bar: 'bg-success-500' },
]

export const MEMO_ROWS: BreakdownRow[] = [
  { key: 'pending', label: 'در انتظار یادداشت', variant: 'yellow', bar: 'bg-warning-400' },
  { key: 'sent', label: 'یادداشت ارسال‌شده', variant: 'green', bar: 'bg-success-500' },
]

export const REQUEST_ROWS: BreakdownRow[] = [
  { key: 'draft', label: REQUEST_STATUS_LABELS.draft, variant: 'gray', bar: 'bg-neutral-400' },
  {
    key: 'in_review',
    label: REQUEST_STATUS_LABELS.in_review,
    variant: 'primary',
    bar: 'bg-brand-600',
  },
  {
    key: 'action_needed',
    label: REQUEST_STATUS_LABELS.action_needed,
    variant: 'yellow',
    bar: 'bg-warning-400',
  },
  {
    key: 'approved',
    label: REQUEST_STATUS_LABELS.approved,
    variant: 'green',
    bar: 'bg-success-500',
  },
  { key: 'rejected', label: REQUEST_STATUS_LABELS.rejected, variant: 'red', bar: 'bg-error-500' },
]

/** The stats row counts four statuses; whatever is left of the total has not been sent yet. */
export function requestValues(counts: RequestStats): Record<string, number> {
  const sent = counts.in_review + counts.approved + counts.action_needed + counts.rejected
  return {
    draft: Math.max(0, counts.total - sent),
    in_review: counts.in_review,
    action_needed: counts.action_needed,
    approved: counts.approved,
    rejected: counts.rejected,
  }
}
