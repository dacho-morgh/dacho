'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardAddIcon,
  DashboardEditIcon,
  DashboardTrashIcon,
} from '@/components/icons'
import {
  documentCategoryLabel,
  downloadDocument,
  formatDocumentSize,
} from '@/utilities/document-api'

export type VerificationStatus =
  | 'unsubmitted'
  | 'pending'
  | 'approved'
  | 'returned'
  | 'rejected'

export interface SnapshotDocument {
  id: string
  category: Parameters<typeof documentCategoryLabel>[0]
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface VerificationSnapshot {
  company?: {
    name?: string
    nationalId?: string
    registrationNumber?: string
    type?: string
    economicCode?: string
    province?: string
    city?: string
    [key: string]: unknown
  }
  dossier?: Record<string, unknown>
  addresses?: unknown[]
  executives?: unknown[]
  documents?: SnapshotDocument[]
  representative?: {
    id: string
    name: string | null
    phone?: string | null
    email?: string | null
  }
}

export interface VerificationHistoryItem {
  id: string
  revision: number
  status: VerificationStatus
  reason: string | null
  reviewerId: string | null
  decidedAt: string | null
  createdAt: string
}

export interface CompanyDetailResponse {
  representative?: {
    id: string
    name: string | null
    phone?: string | null
    email?: string | null
    position?: string | null
  }
  companyId?: string | null
  company?: {
    name?: string
    establishmentDate?: string
    status?: string
    type?: string
    registrationNumber?: string
    economicCode?: string
    nationalId?: string
    province?: string
    city?: string
  }
  executives?: { role?: string; name?: string }[]
  addresses?: { title: string; address: string; postalCode: string }[]
  allowedActions?: ('read' | 'approve' | 'return' | 'reject')[]
  verification?: {
    id?: string
    status: VerificationStatus
    revision: number
    submittedAt?: string | null
    decidedAt?: string | null
    reviewerId?: string | null
    reason?: string | null
    snapshot?: VerificationSnapshot
  }
  history?: VerificationHistoryItem[]
}

type LoadState = 'loading' | 'ready' | 'unauthenticated' | 'denied' | 'error'

function verificationStatusBadge(status: VerificationStatus): {
  label: string
  variant: 'warning' | 'success' | 'amber' | 'error' | 'gray'
} {
  switch (status) {
    case 'pending':
      return { label: 'در انتظار بررسی', variant: 'warning' }
    case 'approved':
      return { label: 'تأیید شده', variant: 'success' }
    case 'returned':
      return { label: 'برگشت داده شده', variant: 'amber' }
    case 'rejected':
      return { label: 'رد شده', variant: 'error' }
    case 'unsubmitted':
    default:
      return { label: 'ارسال نشده', variant: 'gray' }
  }
}

export function CompanyDetailView({ id }: { id: string }) {
  const [data, setData] = useState<CompanyDetailResponse | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  // Workbench decision form state
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionSubmitting, setDecisionSubmitting] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null)
  const [staleNotice, setStaleNotice] = useState<string | null>(null)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  // Protect unsaved decision text across refresh/reloads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`dacho:company-decision:${id}`)
      if (saved) {
        setDecisionReason(saved)
      }
    }
  }, [id])

  const handleReasonChange = (value: string) => {
    setDecisionReason(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`dacho:company-decision:${id}`, value)
    }
  }

  const loadData = useCallback(async () => {
    setLoadState('loading')
    try {
      const response = await fetch(`/api/dashboard/admin/companies/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      })
      if (response.status === 401) {
        setLoadState('unauthenticated')
        return
      }
      if (response.status === 403) {
        setLoadState('denied')
        return
      }
      if (!response.ok) {
        setLoadState('error')
        return
      }
      const companyData = (await response.json()) as CompanyDetailResponse

      // Try fetching detailed verification data (including full snapshot and history) if available
      const verifTargetId = companyData.verification?.id || companyData.companyId
      if (verifTargetId) {
        try {
          const verifRes = await fetch(
            `/api/dashboard/admin/verifications/${encodeURIComponent(verifTargetId)}`,
            { cache: 'no-store' },
          )
          if (verifRes.ok) {
            const verifJson = (await verifRes.json()) as {
              verification?: CompanyDetailResponse['verification']
              history?: VerificationHistoryItem[]
              allowedActions?: ('read' | 'approve' | 'return' | 'reject')[]
            }
            if (verifJson.verification) {
              companyData.verification = verifJson.verification
            }
            if (verifJson.history) {
              companyData.history = verifJson.history
            }
            if (verifJson.allowedActions) {
              companyData.allowedActions = verifJson.allowedActions
            }
          }
        } catch {
          // Keep base verification projection from /admin/companies/:id
        }
      }

      setData(companyData)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Handle secretariat verification decision (Approve / Return / Reject)
  const handleSubmitDecision = async (action: 'approve' | 'return' | 'reject') => {
    if ((action === 'return' || action === 'reject') && !decisionReason.trim()) {
      setDecisionError('ثبت دلیل برای بازگرداندن یا رد الزامی است.')
      return
    }

    setDecisionSubmitting(true)
    setDecisionError(null)
    setDecisionSuccess(null)
    setStaleNotice(null)

    try {
      const response = await fetch(
        `/api/dashboard/admin/companies/${encodeURIComponent(id)}/verification/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            reason: decisionReason.trim() || undefined,
            expectedRevision: data?.verification?.revision,
          }),
        },
      )

      const result = (await response.json().catch(() => ({}))) as {
        error?: string
        verification?: CompanyDetailResponse['verification']
      }

      if (response.status === 409) {
        if (result.error === 'stale_revision') {
          setStaleNotice(
            'نسخه پرونده احراز تغییر یافته است. اطلاعات صفحه به‌روزرسانی شد. متن دلیل شما حفظ شده است؛ لطفاً پیش از ثبت نهایی اطلاعات جدید را بررسی کنید.',
          )
          // Unsaved decision text is protected and preserved
          await loadData()
          return
        }
        if (result.error === 'invalid_verification_state') {
          setDecisionError('وضعیت احراز در انتظار بررسی نیست.')
          await loadData()
          return
        }
      }

      if (response.status === 403) {
        if (result.error === 'self_approval_prohibited') {
          setDecisionError('تأیید یا رد شرکت توسط نماینده خود مجاز نیست (ممنوعیت تأیید خود).')
          return
        }
        setDecisionError('شما دسترسی لازم برای ثبت تصمیم در این پرونده را ندارید.')
        return
      }

      if (response.status === 400) {
        if (result.error === 'reason_required') {
          setDecisionError('ثبت دلیل برای بازگرداندن یا رد الزامی است.')
          return
        }
        setDecisionError('درخواست ثبت تصمیم نامعتبر است.')
        return
      }

      if (!response.ok) {
        setDecisionError('خطا در ثبت تصمیم. لطفاً ارتباط را بررسی و دوباره تلاش کنید.')
        return
      }

      // Success: clean up draft
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`dacho:company-decision:${id}`)
      }
      setDecisionReason('')
      setDecisionSuccess(
        action === 'approve'
          ? 'احراز شرکت با موفقیت تأیید شد.'
          : action === 'return'
            ? 'مدارک شرکت با موفقیت جهت اصلاح بازگردانده شد.'
            : 'مدارک شرکت با موفقیت رد شد.',
      )
      await loadData()
    } catch {
      setDecisionError('خطا در ارسال درخواست به سرور.')
    } finally {
      setDecisionSubmitting(false)
    }
  }

  // Handle authorized document download
  const handleDownloadDocument = async (docId: string, filename: string) => {
    setDownloadingDocId(docId)
    try {
      const { blob, filename: resolvedFilename } = await downloadDocument(docId)
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = resolvedFilename || filename || 'document'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      alert('دانلود مدرک انجام نشد. لطفاً دسترسی را بررسی و دوباره تلاش کنید.')
    } finally {
      setDownloadingDocId(null)
    }
  }

  // Detect differences between live company identity edits and submitted/approved snapshot
  const identityEdits = useMemo(() => {
    const live = data?.company
    const snapshotCompany = data?.verification?.snapshot?.company
    if (!live || !snapshotCompany) return []

    const checks: { label: string; liveVal?: string; snapVal?: string }[] = [
      {
        label: 'نام شرکت',
        liveVal: live.name,
        snapVal: typeof snapshotCompany.name === 'string' ? snapshotCompany.name : undefined,
      },
      {
        label: 'شناسه ملی',
        liveVal: live.nationalId,
        snapVal:
          typeof snapshotCompany.nationalId === 'string'
            ? snapshotCompany.nationalId
            : undefined,
      },
      {
        label: 'نوع شرکت',
        liveVal: live.type,
        snapVal: typeof snapshotCompany.type === 'string' ? snapshotCompany.type : undefined,
      },
      {
        label: 'شماره ثبت',
        liveVal: live.registrationNumber,
        snapVal:
          typeof snapshotCompany.registrationNumber === 'string'
            ? snapshotCompany.registrationNumber
            : undefined,
      },
      {
        label: 'کد اقتصادی',
        liveVal: live.economicCode,
        snapVal:
          typeof snapshotCompany.economicCode === 'string'
            ? snapshotCompany.economicCode
            : undefined,
      },
    ]

    return checks.filter(
      (c) => c.liveVal && c.snapVal && c.liveVal.trim() !== c.snapVal.trim(),
    )
  }, [data?.company, data?.verification?.snapshot?.company])

  if (loadState === 'loading') {
    return (
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-10" dir="rtl">
        <Typography role="status" aria-live="polite" variant="16/regular" color="muted">
          در حال دریافت اطلاعات پرونده شرکت...
        </Typography>
      </main>
    )
  }

  if (loadState === 'unauthenticated') {
    return (
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-10" dir="rtl">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <Typography role="alert" variant="16/regular" color="neutral-700">
            نشست شما پایان یافته است. برای مشاهده اطلاعات دوباره وارد شوید.
          </Typography>
          <Button asChild size="36" className="mt-4">
            <Link href="/login">ورود دوباره</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (loadState === 'denied') {
    return (
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-10" dir="rtl">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <Typography role="alert" variant="16/regular" color="neutral-700">
            دسترسی به پرونده شرکت مجاز نیست.
          </Typography>
          <Button asChild size="36" variant="outline-gray" className="mt-4">
            <Link href="/dashboard">بازگشت به پیشخوان</Link>
          </Button>
        </div>
      </main>
    )
  }

  if (loadState === 'error' || !data) {
    return (
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-10" dir="rtl">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
          <Typography role="alert" variant="16/regular" color="neutral-700">
            دریافت اطلاعات پرونده شرکت انجام نشد.
          </Typography>
          <Button onClick={() => void loadData()} size="36" variant="outline-gray" className="mt-4">
            تلاش دوباره
          </Button>
        </div>
      </main>
    )
  }

  const company = data.company
  const companyName = company?.name
  const verification = data.verification
  const verificationStatus = verification?.status || 'unsubmitted'
  const badgeInfo = verificationStatusBadge(verificationStatus)
  const isPending = verificationStatus === 'pending'
  const canDecide =
    data.allowedActions?.some((a) => ['approve', 'return', 'reject'].includes(a)) ?? false
  const isSelf = isPending && !canDecide

  const fields: Array<[string, string | undefined]> = [
    ['نام شرکت', company?.name],
    ['تاریخ تاسیس', company?.establishmentDate],
    ['وضعیت شرکت', company?.status],
    ['نوع شرکت', company?.type],
    ['شماره ثبت', company?.registrationNumber],
    ['کد اقتصادی', company?.economicCode],
    ['شناسه ملی', company?.nationalId],
  ]

  const addresses = data.addresses ?? []
  const snapshotDocuments = verification?.snapshot?.documents ?? []

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 p-6 sm:p-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard/companies">
          <Typography variant="14/regular" color="brand-600">
            شرکت ها
          </Typography>
        </Link>
        <Typography variant="14/regular" color="muted">
          / {companyName || '—'}
        </Typography>
      </div>

      <div className="flex min-h-0 flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-4 lg:min-h-[912px] lg:flex-row">
        {/* Sidebar Nav */}
        <nav className="order-first flex w-full shrink-0 flex-row gap-2 border-b border-neutral-200 pb-4 lg:order-none lg:w-[200px] lg:flex-col lg:border-b-0 lg:border-l lg:pl-5">
          <Typography
            variant="16/semibold"
            color="brand-600"
            className="rounded-xl bg-brand-50 p-3"
          >
            پروفایل شرکت
          </Typography>
          {['رزومه', 'اطلاعات حساب', 'درخواست‌ها'].map((item) => (
            <Typography
              key={item}
              variant="16/regular"
              color="secondary"
              className="rounded-xl p-3"
            >
              {item}
            </Typography>
          ))}
          <Typography variant="16/regular" color="error" className="mt-auto rounded-xl p-3">
            حذف حساب شرکت
          </Typography>
        </nav>

        {/* Content Pane */}
        <div className="flex w-full max-w-[892px] flex-col gap-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Image
                src="/figma/dashboard/profile-avatar.png"
                alt={companyName || 'شرکت'}
                width={80}
                height={80}
                className="rounded-xl object-cover"
              />
              <div>
                <Typography variant="20/bold" color="neutral-900">
                  {companyName || '—'}
                </Typography>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Typography variant="14/regular" color="muted">
                    شناسه: {id}
                  </Typography>
                  <span className="text-neutral-300">•</span>
                  <Badge variant={badgeInfo.variant} size="sm">
                    {badgeInfo.label}
                  </Badge>
                  {verification?.revision ? (
                    <Typography variant="12/regular" color="muted">
                      (نسخه {verification.revision.toLocaleString('fa-IR')})
                    </Typography>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Identity Edits Awaiting Re-verification Banner */}
          {identityEdits.length > 0 && (
            <section
              className="rounded-xl border border-amber-300 bg-amber-50 p-4"
              role="region"
              aria-label="تغییرات هویتی نیازمند احراز مجدد"
            >
              <div className="flex items-center gap-2">
                <Typography variant="16/semibold" color="secondary" className="text-amber-900">
                  تغییرات هویتی جدید در انتظار احراز مجدد
                </Typography>
              </div>
              <Typography variant="14/regular" color="secondary" className="mt-1 text-amber-800">
                اطلاعات هویتی شرکت پس از ثبت تغییر یافته است. پرونده‌های قبلی نسخه تأییدشده زمان
                ارسال را حفظ می‌کنند.
              </Typography>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {identityEdits.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-amber-200 bg-white/70 p-2.5 text-xs text-amber-950"
                  >
                    <span className="font-semibold">{item.label}:</span>{' '}
                    <span className="text-neutral-500">نسخه احراز:</span>{' '}
                    <span className="font-medium text-neutral-700">{item.snapVal}</span>{' '}
                    <span className="text-amber-600 font-bold">←</span>{' '}
                    <span className="text-neutral-500">جاری:</span>{' '}
                    <span className="font-bold text-amber-900">{item.liveVal}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Secretariat Verification Decision Workbench */}
          <section className="rounded-xl border border-brand-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <div>
                <Typography variant="16/semibold" color="neutral-900">
                  میز کار بررسی و تصمیم احراز دبیرخانه
                </Typography>
                <Typography variant="12/regular" color="muted" className="mt-0.5">
                  بررسی نسخه اطلاعات ثبتی، مدارک ارسالی و ثبت تأیید یا بازگرداندن پرونده
                </Typography>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={badgeInfo.variant} size="md">
                  {badgeInfo.label}
                </Badge>
                {verification?.revision ? (
                  <span className="text-xs text-neutral-500">
                    نسخه {verification.revision.toLocaleString('fa-IR')}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Notification / Feedback Alerts */}
            {staleNotice && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              >
                {staleNotice}
              </div>
            )}
            {decisionError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {decisionError}
              </div>
            )}
            {decisionSuccess && (
              <div
                role="status"
                className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {decisionSuccess}
              </div>
            )}

            {/* Verification Metadata Summary */}
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-neutral-50 p-3">
                <Typography variant="12/regular" color="muted">
                  تاریخ ارسال پرونده
                </Typography>
                <Typography variant="14/regular" color="secondary" className="mt-1">
                  {verification?.submittedAt ? formatDate(verification.submittedAt) : '—'}
                </Typography>
              </div>
              <div className="rounded-lg bg-neutral-50 p-3">
                <Typography variant="12/regular" color="muted">
                  تاریخ آخرین تصمیم
                </Typography>
                <Typography variant="14/regular" color="secondary" className="mt-1">
                  {verification?.decidedAt ? formatDate(verification.decidedAt) : '—'}
                </Typography>
              </div>
              <div className="rounded-lg bg-neutral-50 p-3">
                <Typography variant="12/regular" color="muted">
                  نماینده ثبت‌کننده
                </Typography>
                <Typography variant="14/regular" color="secondary" className="mt-1">
                  {data.representative?.name || '—'} ({data.representative?.phone || '—'})
                </Typography>
              </div>
            </div>

            {/* Previous return/rejection reason if available */}
            {verification?.reason && (
              <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 text-sm">
                <span className="font-semibold text-neutral-800">توضیحات و دلیل تصمیم قبلی:</span>{' '}
                <span className="text-neutral-700">{verification.reason}</span>
              </div>
            )}

            {/* Decision Controls */}
            {isPending && canDecide && (
              <div className="mt-4 flex flex-col gap-3">
                <label htmlFor="decision-reason" className="text-sm font-medium text-neutral-800">
                  توضیحات و دلیل تصمیم{' '}
                  <span className="text-xs text-neutral-500 font-normal">
                    (برای برگشت مدارک یا رد احراز الزامی است)
                  </span>
                </label>
                <Textarea
                  id="decision-reason"
                  rows={3}
                  placeholder="دلیل تصمیم، نواقص مدارک یا توضیحات لازم را اینجا وارد کنید..."
                  value={decisionReason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="rounded-lg border-neutral-300 bg-white p-3 text-sm"
                  disabled={decisionSubmitting}
                />
                {decisionReason.trim().length > 0 && (
                  <Typography variant="12/regular" color="muted">
                    متن پیش‌نویس شما ذخیره شده است.
                  </Typography>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button
                    size="40"
                    variant="default"
                    disabled={decisionSubmitting}
                    onClick={() => void handleSubmitDecision('approve')}
                    className="bg-brand-600 hover:bg-brand-700 text-white"
                  >
                    {decisionSubmitting ? 'در حال ثبت...' : 'تأیید مدارک'}
                  </Button>
                  <Button
                    size="40"
                    variant="outline-gray"
                    disabled={decisionSubmitting}
                    onClick={() => void handleSubmitDecision('return')}
                    className="border-amber-400 text-amber-700 hover:bg-amber-50"
                  >
                    برگشت جهت اصلاح
                  </Button>
                  <Button
                    size="40"
                    variant="destructive"
                    disabled={decisionSubmitting}
                    onClick={() => void handleSubmitDecision('reject')}
                  >
                    رد مدارک
                  </Button>
                </div>
              </div>
            )}

            {isSelf && (
              <div
                role="alert"
                className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              >
                شما نماینده این شرکت هستید. تأیید یا تصمیم‌گیری برای شرکت خود مجاز نیست (ممنوعیت
                تأیید خود).
              </div>
            )}

            {!isPending && (
              <div className="mt-2 text-xs text-neutral-500">
                این پرونده در وضعیت{' '}
                <span className="font-semibold text-neutral-700">{badgeInfo.label}</span> قرار دارد و
                در این نسخه نهایی شده است.
              </div>
            )}
          </section>

          {/* Exact Submitted Verification Documents & Authorized Downloads */}
          <section className="rounded-xl border border-neutral-200 p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Typography variant="16/semibold" color="neutral-900">
                  مدارک ارسالی در نسخه احراز
                </Typography>
                <Typography variant="12/regular" color="muted">
                  مدارک رسمی ثبت‌شده در پرونده این نسخه با امکان دریافت فایل با مجوز معتبر
                </Typography>
              </div>
            </div>

            {snapshotDocuments.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {snapshotDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-neutral-50/50 p-3.5"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          {documentCategoryLabel(doc.category)}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatDocumentSize(doc.sizeBytes)}
                        </span>
                      </div>
                      <Typography
                        variant="14/regular"
                        color="secondary"
                        className="mt-2 truncate font-mono text-xs"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </Typography>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="32"
                        variant="outline-gray"
                        disabled={downloadingDocId === doc.id}
                        onClick={() => void handleDownloadDocument(doc.id, doc.filename)}
                      >
                        <Typography variant="12/regular">
                          {downloadingDocId === doc.id ? 'در حال دریافت...' : 'دانلود مدرک'}
                        </Typography>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Typography variant="14/regular" color="muted" className="py-2 text-center">
                مدرکی در نسخه ارسالی احراز ثبت نشده است.
              </Typography>
            )}
          </section>

          {/* Basic Company Info */}
          <InfoSection title="اطلاعات پایه" edit>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <InfoField key={label} label={label} value={value || '—'} />
              ))}
            </div>
          </InfoSection>

          {/* Addresses */}
          <InfoSection title="آدرس ها" add>
            <div className="flex flex-col gap-3">
              {addresses.map((address) => (
                <div key={address.title} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between">
                    <Typography variant="14/semibold" color="secondary">
                      {address.title}
                    </Typography>
                    <div className="flex gap-1">
                      <Button disabled variant="text-gray" size="icon-sm" aria-label="ویرایش">
                        <DashboardEditIcon className="size-5" />
                      </Button>
                      <Button disabled variant="text-gray" size="icon-sm" aria-label="حذف">
                        <DashboardTrashIcon className="size-5" />
                      </Button>
                    </div>
                  </div>
                  <Typography variant="14/regular" color="secondary" className="mt-3">
                    {address.address}
                  </Typography>
                  <Typography variant="12/regular" color="muted" className="mt-2">
                    کد پستی: {address.postalCode || '—'}
                  </Typography>
                </div>
              ))}
            </div>
          </InfoSection>

          {/* General Private Documents Field (Upload Seam) */}
          <InfoSection title="مدارک خصوصی بارگذاری‌شده">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['articlesOfAssociation', 'اساس‌نامه'],
                  ['establishmentNotices', 'آگهی تأسیس'],
                  ['amendmentNotices', 'آگهی تغییرات'],
                  ['catalogues', 'کاتالوگ محصولات'],
                  ['certificatesLicenses', 'گواهی‌ها و مجوزها'],
                ] as const
              ).map(([category, label]) => (
                <PrivateDocumentField
                  key={category}
                  category={category}
                  label={label}
                  companyId={data?.companyId ?? undefined}
                  canUpload
                />
              ))}
            </div>
          </InfoSection>
        </div>
      </div>
    </main>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function InfoSection({
  title,
  children,
  edit,
  add,
}: {
  title: string
  children: React.ReactNode
  edit?: boolean
  add?: boolean
}) {
  return (
    <section className="rounded-xl border border-neutral-200 p-4">
      <div className="mb-5 flex items-center justify-between">
        <Typography variant="16/semibold" color="neutral-900">
          {title}
        </Typography>
        {edit ? (
          <Button disabled variant="outline-gray" size="32" icon={<DashboardEditIcon className="size-5" />}>
            <Typography variant="14/regular">ویرایش</Typography>
          </Button>
        ) : add ? (
          <Button disabled variant="outline-gray" size="32" icon={<DashboardAddIcon className="size-5" />}>
            <Typography variant="14/regular">افزودن آدرس</Typography>
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <Typography variant="12/regular" color="muted">
        {label}
      </Typography>
      <Typography variant="16/regular" color="secondary" className="mt-1">
        {value}
      </Typography>
    </div>
  )
}
