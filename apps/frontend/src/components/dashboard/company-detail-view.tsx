'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  AddressDialog,
  CompanyInfoDialog,
  ContactDialog,
  DeleteAddressDialog,
  PasswordDialog,
  describeCommandError,
  type AddressValues,
  type CompanyAddress,
  type CompanyInfoValues,
  type ContactValues,
} from '@/components/dashboard/company-detail/company-action-dialogs'
import {
  addCompanyAddress,
  deleteCompanyAddress,
  removeCompanyLogo,
  updateCompanyAddress,
  updateCompanyInfo,
  updateRepresentativeAccount,
  uploadCompanyLogo,
} from '@/components/dashboard/company-detail/company-admin-api'
import {
  mergeVerification,
  verificationTargetId,
  type VerificationDetailResponse,
} from '@/components/dashboard/company-detail/company-detail-data'
import { CompanyDetailSkeleton } from '@/components/dashboard/company-detail/company-detail-skeleton'
import { CompanyLogoRow } from '@/components/dashboard/company-detail/company-logo-row'
import { CompanyAccountTab } from '@/components/dashboard/company-detail/company-account-tab'
import { DetailCard, InfoField } from '@/components/dashboard/company-detail/company-detail-parts'
import {
  CompanyDetailShell,
  type CompanyTab,
} from '@/components/dashboard/company-detail/company-detail-shell'
import { CompanyRequestsTab } from '@/components/dashboard/company-detail/company-requests-tab'
import { notFound } from 'next/navigation'
import {
  DashboardAddIcon,
  DashboardEditIcon,
  DashboardTrashIcon,
} from '@/components/icons'
import type { UnavailableReason } from '@/utilities/dashboard-fetch-result'
import {
  documentCategoryLabel,
  downloadDocument,
  formatDocumentSize,
} from '@/utilities/document-api'
import { DashboardApiError } from '@/utilities/dashboard-api'
import { toast } from 'sonner'

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
    /** The account's version stamp, which the account commands are guarded by. */
    updatedAt?: string | null
  }
  companyId?: string | null
  /** The stored logo and its access-checked file route; null when the company has none. */
  logo?: { id: string; url: string } | null
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
  addresses?: { id?: string; title: string; province?: string; city?: string; address: string; postalCode: string }[]
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

type LoadState = 'loading' | 'ready' | 'missing' | UnavailableReason

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

/** An open dialog, with what was typed and the server's refusal when it is reopened after one. */
type CompanyDialog =
  | { kind: 'info'; values?: CompanyInfoValues; error?: string }
  | { kind: 'address'; address?: CompanyAddress; values?: AddressValues; error?: string }
  | { kind: 'delete-address'; address: CompanyAddress; error?: string }
  | { kind: 'contact'; values?: ContactValues; error?: string }
  | { kind: 'password'; error?: string }

/** Optimistic addresses carry this id until the server has given them a real one. */
const PENDING_ADDRESS = 'pending-'

export function CompanyDetailView({
  id,
  tab = 'profile',
  canManageAccount = false,
  initial,
}: {
  id: string
  tab?: CompanyTab
  /** The case as the server read it, so the page opens with its content instead of a skeleton. */
  initial?: CompanyDetailResponse
  /** Only the System Owner may change or remove the representative's account. */
  canManageAccount?: boolean
}) {
  const [dialog, setDialog] = useState<CompanyDialog | null>(null)
  const [data, setData] = useState<CompanyDetailResponse | null>(initial ?? null)
  const [loadState, setLoadState] = useState<LoadState>(initial ? 'ready' : 'loading')
  const dataRef = useRef<CompanyDetailResponse | null>(initial ?? null)
  const skipFirstLoad = useRef(Boolean(initial))
  // Each load gets a sequence number so a slower, older response never overwrites a newer one.
  const loadSequence = useRef(0)

  // Workbench decision form state
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionSubmitting, setDecisionSubmitting] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  // A refused decision keeps its explanation inline (with the typed reason) and is also toasted.
  const failDecision = (message: string) => {
    toast.error('ثبت تصمیم انجام نشد.')
    setDecisionError(message)
  }
  const [staleNotice, setStaleNotice] = useState<string | null>(null)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const draftKey = `dacho:company-decision:${id}`

  // Protect unsaved decision text across refresh/reloads
  useEffect(() => {
    const saved = readDraft(draftKey)
    if (saved) setDecisionReason(saved)
  }, [draftKey])

  const handleReasonChange = (value: string) => {
    setDecisionReason(value)
    writeDraft(draftKey, value)
  }

  const loadData = useCallback(async (options: { quiet?: boolean } = {}) => {
    const sequence = ++loadSequence.current
    const isCurrent = () => sequence === loadSequence.current
    // Keep the loaded case on screen while refreshing after a decision or a stale revision.
    setLoadState((previous) => (previous === 'ready' ? 'ready' : 'loading'))
    // A background refresh after a change never replaces the page with an error: what is shown stays.
    const fail = (state: LoadState) => {
      if (!options.quiet) setLoadState(state)
    }
    try {
      const response = await fetch(`/api/dashboard/admin/companies/${encodeURIComponent(id)}`, {
        cache: 'no-store',
      })
      if (!isCurrent()) return
      if (response.status === 401) return fail('expired')
      if (response.status === 403) return fail('denied')
      if (response.status === 404) return fail('missing')
      if (!response.ok) return fail('unavailable')
      let companyData = (await response.json()) as CompanyDetailResponse

      // Try fetching detailed verification data (including full snapshot and history) if available
      const verifTargetId = verificationTargetId(companyData)
      if (verifTargetId) {
        try {
          const verifRes = await fetch(
            `/api/dashboard/admin/verifications/${encodeURIComponent(verifTargetId)}`,
            { cache: 'no-store' },
          )
          if (verifRes.ok) {
            companyData = mergeVerification(companyData, (await verifRes.json()) as VerificationDetailResponse)
          }
        } catch {
          // Keep base verification projection from /admin/companies/:id
        }
      }

      if (!isCurrent()) return
      dataRef.current = companyData
      setData(companyData)
      setLoadState('ready')
    } catch {
      if (isCurrent()) fail('unavailable')
    }
  }, [id])

  useEffect(() => {
    // The server already read the case this page opened with.
    if (skipFirstLoad.current) {
      skipFirstLoad.current = false
      return
    }
    void loadData()
    return () => {
      // Ignore responses that arrive after unmount or after the id changes.
      loadSequence.current += 1
    }
  }, [loadData])

  /**
   * Shows a change on the page at once and rolls it back when the server refuses it. The dialog
   * closes with the change; a refusal reopens it with what was typed and the reason.
   */
  const patchData = (patch: (current: CompanyDetailResponse) => CompanyDetailResponse) => {
    const previous = dataRef.current
    if (!previous) return () => undefined
    const next = patch(previous)
    dataRef.current = next
    setData(next)
    return () => {
      dataRef.current = previous
      setData(previous)
    }
  }

  const mutate = async ({
    reopen,
    optimistic,
    task,
    success,
    failure,
  }: {
    /** The dialog to reopen when the server refuses; none for a change made without one. */
    reopen?: CompanyDialog
    optimistic?: () => () => void
    task: () => Promise<void>
    success: string
    failure: string
  }) => {
    const rollback = optimistic?.()
    setDialog(null)
    try {
      await task()
      toast.success(success)
      await loadData({ quiet: true })
    } catch (cause) {
      rollback?.()
      const reason = describeCommandError(cause, failure)
      if (reopen) setDialog({ ...reopen, error: reason })
      else toast.error(reason)
    }
  }

  const infoInitial: CompanyInfoValues = {
    name: data?.company?.name ?? '',
    establishmentDate: data?.company?.establishmentDate ?? '',
    status: data?.company?.status ?? '',
    type: data?.company?.type ?? '',
    registrationNumber: data?.company?.registrationNumber ?? '',
    economicCode: data?.company?.economicCode ?? '',
  }

  const submitInfo = (values: CompanyInfoValues) => {
    const changed = (Object.keys(infoInitial) as (keyof CompanyInfoValues)[]).filter(
      (field) => values[field] !== infoInitial[field],
    )
    if (changed.length === 0) return setDialog(null)
    void mutate({
      reopen: { kind: 'info', values },
      optimistic: () => patchData((current) => ({ ...current, company: { ...current.company, ...values } })),
      task: () => updateCompanyInfo(id, Object.fromEntries(changed.map((field) => [field, values[field]]))),
      success: 'اطلاعات شرکت ذخیره شد.',
      failure: 'ذخیرهٔ اطلاعات شرکت انجام نشد. دوباره تلاش کنید.',
    })
  }

  const submitAddress = (current: CompanyAddress | undefined, values: AddressValues) => {
    if (current) {
      void mutate({
        reopen: { kind: 'address', address: current, values },
        optimistic: () =>
          patchData((state) => ({
            ...state,
            addresses: state.addresses?.map((item) => (item.id === current.id ? { ...item, ...values } : item)),
          })),
        task: () => updateCompanyAddress(id, current.id, values),
        success: 'آدرس ذخیره شد.',
        failure: 'ذخیرهٔ آدرس انجام نشد. دوباره تلاش کنید.',
      })
      return
    }
    const pendingId = `${PENDING_ADDRESS}${Date.now()}`
    void mutate({
      reopen: { kind: 'address', values },
      optimistic: () =>
        patchData((state) => ({ ...state, addresses: [...(state.addresses ?? []), { id: pendingId, ...values }] })),
      task: () => addCompanyAddress(id, values),
      success: 'آدرس افزوده شد.',
      failure: 'افزودن آدرس انجام نشد. دوباره تلاش کنید.',
    })
  }

  const removeAddress = (address: CompanyAddress) =>
    void mutate({
      reopen: { kind: 'delete-address', address },
      optimistic: () =>
        patchData((state) => ({ ...state, addresses: state.addresses?.filter((item) => item.id !== address.id) })),
      task: () => deleteCompanyAddress(id, address.id),
      success: 'آدرس حذف شد.',
      failure: 'حذف آدرس انجام نشد. دوباره تلاش کنید.',
    })

  /** Changes the representative's account through the CMS command, guarded by the account's version. */
  const accountTask = (fields: Parameters<typeof updateRepresentativeAccount>[2]) => async () => {
    const version = dataRef.current?.representative?.updatedAt
    if (!version) throw new DashboardApiError(409, 'stale_personnel')
    await updateRepresentativeAccount(id, version, fields)
  }

  const submitContact = (values: ContactValues) => {
    const current = data?.representative
    const changed = (['name', 'phone', 'email'] as const).filter((field) => values[field] !== (current?.[field] ?? ''))
    if (changed.length === 0) return setDialog(null)
    void mutate({
      reopen: { kind: 'contact', values },
      optimistic: () =>
        patchData((state) => ({ ...state, representative: { ...state.representative!, ...values } })),
      task: accountTask(Object.fromEntries(changed.map((field) => [field, values[field]]))),
      success: 'اطلاعات تماس ذخیره شد.',
      failure: 'ذخیرهٔ اطلاعات تماس انجام نشد. دوباره تلاش کنید.',
    })
  }

  const submitPassword = (password: string) =>
    void mutate({
      reopen: { kind: 'password' },
      task: accountTask({ password }),
      success: 'رمز عبور نماینده تغییر کرد.',
      failure: 'تغییر رمز عبور انجام نشد. دوباره تلاش کنید.',
    })

  const uploadLogo = (file: File) =>
    mutate({
      optimistic: () =>
        patchData((state) => ({ ...state, logo: { id: 'pending', url: URL.createObjectURL(file) } })),
      task: () => uploadCompanyLogo(id, file),
      success: 'لوگوی شرکت ذخیره شد.',
      failure: 'ذخیرهٔ لوگو انجام نشد. دوباره تلاش کنید.',
    })

  const removeLogo = () =>
    mutate({
      optimistic: () => patchData((state) => ({ ...state, logo: null })),
      task: () => removeCompanyLogo(id),
      success: 'لوگوی شرکت حذف شد.',
      failure: 'حذف لوگو انجام نشد. دوباره تلاش کنید.',
    })

  // Handle secretariat verification decision (Approve / Return / Reject)
  const handleSubmitDecision = async (action: 'approve' | 'return' | 'reject') => {
    if ((action === 'return' || action === 'reject') && !decisionReason.trim()) {
      setDecisionError('ثبت دلیل برای بازگرداندن یا رد الزامی است.')
      return
    }

    setDecisionSubmitting(true)
    setDecisionError(null)
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
          failDecision('وضعیت احراز در انتظار بررسی نیست.')
          await loadData()
          return
        }
      }

      if (response.status === 403) {
        if (result.error === 'self_approval_prohibited') {
          failDecision('تأیید یا رد شرکت توسط نماینده خود مجاز نیست (ممنوعیت تأیید خود).')
          return
        }
        failDecision('شما دسترسی لازم برای ثبت تصمیم در این پرونده را ندارید.')
        return
      }

      if (response.status === 400) {
        if (result.error === 'reason_required') {
          failDecision('ثبت دلیل برای بازگرداندن یا رد الزامی است.')
          return
        }
        failDecision('درخواست ثبت تصمیم نامعتبر است.')
        return
      }

      if (!response.ok) {
        failDecision('خطا در ثبت تصمیم. لطفاً ارتباط را بررسی و دوباره تلاش کنید.')
        return
      }

      // Success: clean up draft
      writeDraft(draftKey, '')
      setDecisionReason('')
      toast.success(
        action === 'approve'
          ? 'احراز شرکت با موفقیت تأیید شد.'
          : action === 'return'
            ? 'مدارک شرکت با موفقیت جهت اصلاح بازگردانده شد.'
            : 'مدارک شرکت با موفقیت رد شد.',
      )
      await loadData()
    } catch {
      failDecision('خطا در ارسال درخواست به سرور.')
    } finally {
      setDecisionSubmitting(false)
    }
  }

  // Handle authorized document download
  const handleDownloadDocument = async (docId: string, filename: string) => {
    setDownloadingDocId(docId)
    setDownloadError(null)
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
      setDownloadError('دانلود مدرک انجام نشد. لطفاً دسترسی را بررسی و دوباره تلاش کنید.')
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

  if (loadState === 'missing') notFound()
  if (loadState === 'expired' || loadState === 'denied' || loadState === 'unavailable') {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 pt-20 md:p-10" dir="rtl">
        <OfflineNotice reason={loadState} retryHref={`/dashboard/companies/${encodeURIComponent(id)}`} />
      </div>
    )
  }
  if (loadState === 'loading' || !data) return <CompanyDetailSkeleton />

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
    ['تاریخ تاسیس', establishmentLabel(company?.establishmentDate)],
    ['وضعیت شرکت', company?.status],
    ['نوع شرکت', company?.type],
    ['شماره ثبت', company?.registrationNumber],
    ['کد اقتصادی', company?.economicCode],
    ['شناسه ملی', company?.nationalId],
  ]

  const addresses = data.addresses ?? []
  const snapshotDocuments = verification?.snapshot?.documents ?? []

  return (
    <CompanyDetailShell
      id={id}
      companyName={companyName}
      active={tab}
      representativeUpdatedAt={data.representative?.updatedAt}
      canManageAccount={canManageAccount}
    >
      {tab === 'profile' && (
        <>
          <CompanyLogoRow companyName={companyName} logo={data.logo} onUpload={uploadLogo} onRemove={removeLogo}>
            <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ms-auto sm:w-auto">
              <Badge variant={badgeInfo.variant} size="md">
                {badgeInfo.label}
              </Badge>
              {verification?.revision ? (
                <Typography as="span" variant="12/regular" color="muted">
                  نسخه {verification.revision.toLocaleString('fa-IR')}
                </Typography>
              ) : null}
            </div>
          </CompanyLogoRow>

          {/* Basic Company Info */}
          <DetailCard
            title="اطلاعات پایه"
            action={
              <Button
                type="button"
                variant="gray"
                size="32"
                icon={<DashboardEditIcon />}
                className="px-3"
                onClick={() => setDialog({ kind: 'info' })}
              >
                <Typography as="span" variant="14/regular" className="text-inherit">
                  ویرایش
                </Typography>
              </Button>
            }
          >
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <InfoField key={label} label={label} value={value || '—'} />
              ))}
            </div>
          </DetailCard>

          {/* Addresses */}
          <DetailCard
            title="آدرس ها"
            action={
              <Button
                type="button"
                variant="gray"
                size="32"
                icon={<DashboardAddIcon />}
                className="px-3"
                onClick={() => setDialog({ kind: 'address' })}
              >
                <Typography as="span" variant="14/regular" className="text-inherit">
                  آدرس جدید
                </Typography>
              </Button>
            }
          >
            <div className="flex flex-col gap-5">
              {addresses.map((address, index) => (
                <div
                  key={address.id ?? `${index}-${address.title}`}
                  className="flex flex-col gap-3 rounded-lg border border-neutral-100 px-4 py-2"
                >
                  <div className="flex items-start gap-3">
                    <Typography as="h3" variant="14/semibold" sm="16/bold" color="secondary" className="min-w-0 flex-1 break-words">
                      {address.title}
                    </Typography>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="text-gray"
                        size="icon-32"
                        aria-label={`ویرایش آدرس ${address.title}`}
                        disabled={!isSavedAddress(address.id)}
                        onClick={() => address.id && setDialog({ kind: 'address', address: toCompanyAddress(address, address.id) })}
                      >
                        <DashboardEditIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="text-gray"
                        size="icon-32"
                        aria-label={`حذف آدرس ${address.title}`}
                        disabled={!isSavedAddress(address.id)}
                        onClick={() =>
                          address.id && setDialog({ kind: 'delete-address', address: toCompanyAddress(address, address.id) })
                        }
                      >
                        <DashboardTrashIcon />
                      </Button>
                    </div>
                  </div>
                  <Typography variant="14/semibold" sm="16/semibold" color="neutral-400">
                    {address.address}
                  </Typography>
                  <Typography variant="14/semibold" sm="16/semibold" color="neutral-400">
                    کد پستی: {address.postalCode || '—'}
                  </Typography>
                </div>
              ))}
              {addresses.length === 0 ? (
                <Typography variant="14/regular" color="muted">
                  آدرسی برای این شرکت ثبت نشده است.
                </Typography>
              ) : null}
            </div>
          </DetailCard>

          {/* Identity Edits Awaiting Re-verification Banner */}
          {identityEdits.length > 0 && (
            <section
              className="flex flex-col gap-3 rounded-2xl border border-warning-400 bg-warning-50 p-4"
              role="region"
              aria-label="تغییرات هویتی نیازمند احراز مجدد"
            >
              <Typography as="h2" variant="16/bold" sm="20/bold" className="text-warning-700">
                تغییرات هویتی جدید در انتظار احراز مجدد
              </Typography>
              <Typography variant="14/regular" className="text-warning-700">
                اطلاعات هویتی شرکت پس از ثبت تغییر یافته است. پرونده‌های قبلی نسخه تأییدشده زمان
                ارسال را حفظ می‌کنند.
              </Typography>
              <div className="grid gap-2 sm:grid-cols-2">
                {identityEdits.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-1 rounded-lg border border-neutral-100 bg-background p-2"
                  >
                    <Typography as="span" variant="12/semibold" sm="14/semibold" color="neutral-400">
                      {item.label}
                    </Typography>
                    <div className="flex flex-wrap items-center gap-1">
                      <Typography as="span" variant="12/regular" color="muted">
                        نسخه احراز:
                      </Typography>
                      <Typography as="span" variant="14/regular" color="secondary">
                        {item.snapVal}
                      </Typography>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Typography as="span" variant="12/regular" color="muted">
                        جاری:
                      </Typography>
                      <Typography as="span" variant="12/semibold" sm="14/semibold" color="secondary">
                        {item.liveVal}
                      </Typography>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Secretariat Verification Decision Workbench */}
          <DetailCard
            title="میز کار بررسی و تصمیم احراز دبیرخانه"
            className="border-brand-400"
            action={
              <Badge variant={badgeInfo.variant} size="md">
                {badgeInfo.label}
              </Badge>
            }
          >
            <Typography variant="14/regular" color="muted" className="-mt-3">
              بررسی نسخه اطلاعات ثبتی، مدارک ارسالی و ثبت تأیید یا بازگرداندن پرونده
            </Typography>

            {/* Notification / Feedback Alerts */}
            {staleNotice && (
              <div role="alert" className="rounded-lg border border-warning-400 bg-warning-50 p-3">
                <Typography variant="14/regular" className="text-warning-700">
                  {staleNotice}
                </Typography>
              </div>
            )}
            {decisionError && (
              <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3">
                <Typography variant="14/regular" color="error">
                  {decisionError}
                </Typography>
              </div>
            )}

            {/* Verification Metadata Summary */}
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-3">
              <InfoField
                label="تاریخ ارسال پرونده"
                value={verification?.submittedAt ? formatDate(verification.submittedAt) : '—'}
              />
              <InfoField
                label="تاریخ آخرین تصمیم"
                value={verification?.decidedAt ? formatDate(verification.decidedAt) : '—'}
              />
              <InfoField
                label="نماینده ثبت‌کننده"
                value={`${data.representative?.name || '—'} (${data.representative?.phone || '—'})`}
              />
            </div>

            {/* Previous return/rejection reason if available */}
            {verification?.reason && (
              <InfoField label="توضیحات و دلیل تصمیم قبلی" value={verification.reason} />
            )}

            {/* Decision Controls */}
            {isPending && canDecide && (
              <div className="flex flex-col gap-3">
                <Typography as="label" htmlFor="decision-reason" variant="14/semibold" sm="16/semibold" color="neutral-700">
                  توضیحات و دلیل تصمیم{' '}
                  <Typography as="span" variant="12/regular" color="muted">
                    (برای برگشت مدارک یا رد احراز الزامی است)
                  </Typography>
                </Typography>
                <Textarea
                  id="decision-reason"
                  rows={3}
                  placeholder="دلیل تصمیم، نواقص مدارک یا توضیحات لازم را اینجا وارد کنید..."
                  value={decisionReason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  disabled={decisionSubmitting}
                />
                {decisionReason.trim().length > 0 && (
                  <Typography variant="12/regular" color="muted">
                    متن پیش‌نویس شما ذخیره شده است.
                  </Typography>
                )}
                {/* Figma 02 (31650:7): actions sit at the row's end, approve last in reading order. */}
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button asChild size="40" variant="link">
                    <Link href="/dashboard/companies?status=pending">بازگشت به صف</Link>
                  </Button>
                  <Button
                    size="40"
                    variant="outline-gray"
                    className="px-4"
                    disabled={decisionSubmitting}
                    onClick={() => void handleSubmitDecision('return')}
                  >
                    برگشت جهت اصلاح
                  </Button>
                  <Button
                    size="40"
                    variant="destructive"
                    className="px-4"
                    disabled={decisionSubmitting}
                    onClick={() => void handleSubmitDecision('reject')}
                  >
                    رد احراز هویت
                  </Button>
                  <Button
                    size="40"
                    variant="default"
                    className="px-4"
                    disabled={decisionSubmitting}
                    onClick={() => void handleSubmitDecision('approve')}
                  >
                    {decisionSubmitting ? 'در حال ثبت...' : 'تایید احراز هویت'}
                  </Button>
                </div>
              </div>
            )}

            {isSelf && (
              <div role="alert" className="rounded-lg border border-warning-400 bg-warning-50 p-3">
                <Typography variant="14/regular" className="text-warning-700">
                  شما نماینده این شرکت هستید. تأیید یا تصمیم‌گیری برای شرکت خود مجاز نیست (ممنوعیت
                  تأیید خود).
                </Typography>
              </div>
            )}

            {!isPending && (
              <Typography variant="12/regular" color="muted">
                این پرونده در وضعیت{' '}
                <Typography as="span" variant="12/semibold" color="neutral-700">
                  {badgeInfo.label}
                </Typography>{' '}
                قرار دارد و در این نسخه نهایی شده است.
              </Typography>
            )}
          </DetailCard>
          {/* Exact Submitted Verification Documents & Authorized Downloads */}
          <DetailCard title="مدارک ارسالی در نسخه احراز">
            <Typography variant="14/regular" color="muted" className="-mt-3">
              مدارک رسمی ثبت‌شده در پرونده این نسخه با امکان دریافت فایل با مجوز معتبر
            </Typography>
            {downloadError && (
              <div role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3">
                <Typography variant="14/regular" color="error">
                  {downloadError}
                </Typography>
              </div>
            )}
            {snapshotDocuments.length > 0 ? (
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                {snapshotDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-neutral-100 p-2"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="primary" size="sm">
                          {documentCategoryLabel(doc.category)}
                        </Badge>
                        <Typography as="span" variant="12/regular" color="muted">
                          {formatDocumentSize(doc.sizeBytes)}
                        </Typography>
                      </div>
                      <Typography
                        variant="14/regular"
                        color="secondary"
                        className="truncate font-mono"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </Typography>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="32"
                        variant="outline-gray"
                        className="px-3"
                        disabled={downloadingDocId === doc.id}
                        onClick={() => void handleDownloadDocument(doc.id, doc.filename)}
                      >
                        <Typography as="span" variant="14/regular" className="text-inherit">
                          {downloadingDocId === doc.id ? 'در حال دریافت...' : 'دانلود مدرک'}
                        </Typography>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Typography variant="14/regular" color="muted" className="text-center">
                مدرکی در نسخه ارسالی احراز ثبت نشده است.
              </Typography>
            )}
          </DetailCard>

        </>
      )}

      {/* General Private Documents Field (Upload Seam) */}
      {tab === 'resume' && (
        <DetailCard title="مدارک خصوصی بارگذاری‌شده">
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
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
                companyId={data.companyId ?? undefined}
                canUpload
              />
            ))}
          </div>
        </DetailCard>
      )}

      {tab === 'account' && (
        <CompanyAccountTab
          userId={id}
          companyName={companyName}
          representative={data.representative}
          canManage={canManageAccount}
          onEditContact={() => setDialog({ kind: 'contact' })}
          onChangePassword={() => setDialog({ kind: 'password' })}
        />
      )}

      {dialog?.kind === 'info' ? (
        <CompanyInfoDialog
          initial={dialog.values ?? infoInitial}
          error={dialog.error}
          onClose={() => setDialog(null)}
          onSubmit={submitInfo}
        />
      ) : null}
      {dialog?.kind === 'address' ? (
        <AddressDialog
          isNew={!dialog.address}
          initial={dialog.values ?? addressInitial(dialog.address)}
          error={dialog.error}
          onClose={() => setDialog(null)}
          onSubmit={(values) => submitAddress(dialog.address, values)}
        />
      ) : null}
      {dialog?.kind === 'delete-address' ? (
        <DeleteAddressDialog
          address={dialog.address}
          error={dialog.error}
          onClose={() => setDialog(null)}
          onConfirm={() => removeAddress(dialog.address)}
        />
      ) : null}
      {dialog?.kind === 'contact' ? (
        <ContactDialog
          initial={
            dialog.values ?? {
              name: data.representative?.name ?? '',
              phone: data.representative?.phone ?? '',
              email: data.representative?.email ?? '',
            }
          }
          error={dialog.error}
          onClose={() => setDialog(null)}
          onSubmit={submitContact}
        />
      ) : null}
      {dialog?.kind === 'password' ? (
        <PasswordDialog
          error={dialog.error}
          onClose={() => setDialog(null)}
          onSubmit={(values) => submitPassword(values.password)}
        />
      ) : null}

      {tab === 'requests' && <CompanyRequestsTab companyId={id} />}
    </CompanyDetailShell>
  )
}

/** Browser storage can be blocked; the draft is a convenience, so failures are ignored. */
function readDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeDraft(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value)
    else window.localStorage.removeItem(key)
  } catch {
    // Keep the in-memory draft when storage is unavailable.
  }
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

const isSavedAddress = (id: string | undefined): id is string => Boolean(id) && !id!.startsWith(PENDING_ADDRESS)

const addressInitial = (address: CompanyAddress | undefined): AddressValues => ({
  title: address?.title ?? '',
  province: address?.province ?? '',
  city: address?.city ?? '',
  postalCode: address?.postalCode ?? '',
  address: address?.address ?? '',
})

function toCompanyAddress(
  address: NonNullable<CompanyDetailResponse['addresses']>[number],
  id: string,
): CompanyAddress {
  return {
    id,
    title: address.title,
    province: address.province ?? '',
    city: address.city ?? '',
    postalCode: address.postalCode,
    address: address.address,
  }
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const toLatinDigits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
const toPersianDigits = (value: string) => value.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit)

function currentJalaliYear(): number | undefined {
  const year = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', { year: 'numeric' })
    .formatToParts(new Date())
    .find((part) => part.type === 'year')?.value
  return year ? Number(year) : undefined
}

/** "۱۳۵۱/۰۴/۱۲ (۵۴ سال)": the establishment date as stored (Jalali) or converted (ISO), with the company's age. */
function establishmentLabel(value?: string): string | undefined {
  if (!value) return undefined
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(toLatinDigits(value))
  if (!match) return value
  const year = Number(match[1])
  const isJalali = year >= 1200 && year <= 1600
  const now = isJalali ? currentJalaliYear() : new Date().getFullYear()
  const age = now ? now - year : undefined
  const date = isJalali ? toPersianDigits(`${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`) : formatDate(value)
  return age !== undefined && age >= 0 ? `${date} (${age.toLocaleString('fa-IR')} سال)` : date
}
