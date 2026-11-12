import type { CompanyVerificationDto } from '@/utilities/dashboard-api'
import { formatDate } from '@/utilities/dashboard-api'
import type { RequestItem } from './types'

/** The page that follows the company's verification; the form itself stays in the company profile. */
export const VERIFICATION_HREF = '/dashboard/requests/verification'

const BY_STATUS: Record<
  CompanyVerificationDto['status'],
  { label: string; stage: NonNullable<RequestItem['stage']>; nextAction?: string }
> = {
  unsubmitted: { label: 'ارسال نشده', stage: 'verification', nextAction: 'تکمیل اطلاعات و ارسال برای احراز هویت' },
  pending: { label: 'در انتظار بررسی', stage: 'reviewing' },
  returned: { label: 'برگشت داده شده', stage: 'verification', nextAction: 'اصلاح اطلاعات و ارسال مجدد' },
  rejected: { label: 'رد شده', stage: 'finished' },
  approved: { label: 'تأیید شده', stage: 'finished' },
}

/**
 * The company's verification as a row of its requests list. It is not a request of the review
 * workflow, so it has no tracking code and opens its own follow-up page.
 */
export function verificationRequestItem(verification: CompanyVerificationDto): RequestItem {
  const entry = BY_STATUS[verification.status]
  return {
    id: 'company-verification',
    trackingCode: '',
    title: 'درخواست احراز هویت شرکت',
    status: verification.status === 'approved' ? 'approved' : verification.status === 'rejected' ? 'rejected' : verification.status === 'pending' ? 'in_review' : 'draft',
    statusLabel: entry.label,
    stage: entry.stage,
    currentStep: 'بررسی دبیرخانه',
    nextAction: entry.nextAction,
    revision: null,
    allowedActions: [],
    dueDate: '',
    createdDate: formatDate(verification.submittedAt),
    href: VERIFICATION_HREF,
  }
}
