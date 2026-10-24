'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { ArrowUpIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { documentCategoryLabel, type DocumentCategory } from '@/utilities/document-api'

interface AdminRequest {
  id: string
  title: string
  status: string
  ownerId: string
  serviceName?: string
  currentStep?: string | null
  currentStepIndex?: number
  answers: Record<string, unknown>
  allowedActions?: string[]
}

interface Assignment {
  id: string
  userId: string
  role: string
  active: boolean
  assignedAt: string
  revokedAt: string | null
}

interface Employee {
  id: string
  name: string | null
  operationalRole: string
  isActive: boolean
}

const MANUAL_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'proposal',
  'financialStatements',
  'debtFacilityEvidence',
  'taxInsuranceRecords',
  'contractsOrdersMousCommitments',
  'projectEstimateUseOfFunds',
  'guaranteeCollateral',
]

export function AdminRequestDetail({ id }: { id: string }) {
  const [data, setData] = useState<{
    request: AdminRequest
    owner?: { id: string; name: string | null } | null
    workflow: { title: string }[]
  } | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [assignmentError, setAssignmentError] = useState<string | null>(null)

  const loadAssignments = useCallback(async () => {
    const response = await fetch(`/api/dashboard/admin/requests/${encodeURIComponent(id)}/assignments`)
    if (!response.ok) return
    const body = (await response.json()) as { items: Assignment[] }
    setAssignments(body.items.filter((assignment) => assignment.active))
  }, [id])

  useEffect(() => {
    let active = true
    fetch(`/api/dashboard/admin/requests/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!active) return
        setData(body)
        if (body?.request?.allowedActions?.includes('assign')) {
          void loadAssignments()
          fetch('/api/dashboard/admin/employees')
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              if (active) setEmployees(payload?.items ?? [])
            })
            .catch(() => setEmployees([]))
        }
      })
      .catch(() => setData(null))
    return () => { active = false }
  }, [id, loadAssignments])

  const request = data?.request
  const canAssign = request?.allowedActions?.includes('assign') === true

  const assign = async () => {
    if (!selectedEmployee) return
    const employee = employees.find((item) => item.id === selectedEmployee)
    if (!employee) return
    setAssignmentError(null)
    const response = await fetch(`/api/dashboard/admin/requests/${encodeURIComponent(id)}/assignments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: employee.id, role: employee.operationalRole }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      setAssignmentError(body?.error === 'already_assigned' ? 'این شخص قبلاً به پرونده منتسب شده است.' : 'انتساب انجام نشد.')
      return
    }
    setSelectedEmployee('')
    await loadAssignments()
  }

  const revoke = async (assignment: Assignment) => {
    setAssignmentError(null)
    const response = await fetch(
      `/api/dashboard/admin/requests/${encodeURIComponent(id)}/assignments/${encodeURIComponent(assignment.userId)}`,
      { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'revoked by owner' }) },
    )
    if (!response.ok) {
      setAssignmentError('لغو انتساب انجام نشد.')
      return
    }
    await loadAssignments()
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 lg:pt-10" dir="rtl">
      <Link href="/dashboard/requests">
        <Typography variant="14/regular" color="brand-600">
          درخواست ها / {data?.owner?.name || 'جزئیات درخواست'}
        </Typography>
      </Link>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <div>
            <Typography variant="20/bold" color="neutral-900">
              {data?.owner?.name || '—'}
            </Typography>
            <Typography variant="14/regular" color="muted">
              {request ? requestStatusLabel(request.status) : '—'}
            </Typography>
          </div>
        </div>
        {request?.ownerId ? (
          <Button asChild variant="outline" size="40">
            <Link href={`/dashboard/companies/${request.ownerId}`}>
              <Typography variant="14/regular">مشاهده پروفایل شرکت</Typography>
            </Link>
          </Button>
        ) : (
          <Typography variant="14/regular" color="muted">پروفایل شرکت در دسترس نیست</Typography>
        )}
      </section>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 flex-col gap-3">
            <Typography
              variant="14/regular"
              color="muted"
              className="w-fit rounded-lg bg-neutral-100 px-3 py-1"
            >
              {request ? requestStatusLabel(request.status) : '—'}
            </Typography>
            <Typography variant="20/bold" color="neutral-900">
              {request?.title || 'در حال بارگذاری درخواست'}
            </Typography>
            {request?.serviceName && <Typography variant="14/regular" color="secondary">خدمت: {request.serviceName}</Typography>}
            {request?.currentStep && <Typography variant="14/regular" color="secondary">مرحله فعلی: {request.currentStep}</Typography>}
          </div>
        </div>
        <div className="my-8 h-px bg-neutral-200" />
        <Typography variant="20/bold" color="neutral-900">
          وضعیت درخواست
        </Typography>
        <div className="mt-6">
          {(data?.workflow?.length ? data.workflow.map((step) => step.title) : []).map((step, index) => (
            <div className="flex gap-3" key={`${index}-${step}`}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-8 items-center justify-center rounded-full ${index < (request?.currentStepIndex ?? -1) ? 'bg-success-50 text-success-700' : index === (request?.currentStepIndex ?? -1) ? 'bg-brand-50 text-brand-600' : 'bg-neutral-100 text-neutral-500'}`}
                >
                  <Typography variant="14/semibold">{index + 1}</Typography>
                </div>
                {index < (data?.workflow?.length ?? 0) - 1 && (
                  <div
                    className={`h-12 w-px ${index < (request?.currentStepIndex ?? -1) ? 'bg-success-500' : 'bg-neutral-200'}`}
                  />
                )}
              </div>
              <div className="pb-5">
                <Typography variant="16/semibold" color={index === (request?.currentStepIndex ?? -1) ? 'brand-600' : 'secondary'}>
                  {step}
                </Typography>
              </div>
            </div>
          ))}
        </div>
        <div className="my-8 h-px bg-neutral-200" />
        <div className="flex items-center justify-between">
          <Typography variant="20/bold" color="neutral-900">
            اطلاعات فرم درخواست
          </Typography>
          <ArrowUpIcon className="size-6 text-neutral-600" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Object.entries(request?.answers ?? {}).map(([label, value]) => (
            <div className="rounded-xl border border-neutral-200 p-4" key={label}>
              <Typography variant="12/regular" color="muted">
                {label}
              </Typography>
              <Typography variant="16/regular" color="secondary" className="mt-2">
                {String(value ?? '—')}
              </Typography>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography variant="20/bold" color="neutral-900">
          مدارک درخواست
        </Typography>
        <Typography variant="14/regular" color="neutral-500">
          دسترسی در هر درخواست دوباره با نقش و انتساب فعلی بررسی می‌شود؛ مدارک مالی برای سردبیر و داوران نمایش داده نمی‌شوند.
        </Typography>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {MANUAL_DOCUMENT_CATEGORIES.map((category) => (
            <PrivateDocumentField
              key={category}
              category={category}
              label={documentCategoryLabel(category)}
              requestId={id}
              canUpload={request?.allowedActions?.includes('uploadDocument') === true}
              canDelete={request?.allowedActions?.includes('deleteDocument') === true}
            />
          ))}
        </div>
      </section>

      {canAssign ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
          <Typography variant="20/bold" color="neutral-900">
            انتساب پرونده
          </Typography>
          <Typography variant="14/regular" color="neutral-500">
            انتساب فقط برای نقش عملیاتی منطبق و حساب فعال ثبت می‌شود. با لغو انتساب یا تغییر نقش، دسترسی در همان درخواست بعدی قطع می‌شود.
          </Typography>
          {assignments.length ? (
            <ul className="flex flex-col gap-2">
              {assignments.map((assignment) => (
                <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 p-3">
                  <Typography variant="14/regular" color="neutral-700">
                    {employees.find((item) => item.id === assignment.userId)?.name ?? assignment.userId} — {assignmentRoleLabel(assignment.role)}
                  </Typography>
                  <Button type="button" variant="text-gray" size="32" onClick={() => revoke(assignment)}>
                    <Typography variant="12/semibold" className="text-inherit">لغو انتساب</Typography>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Typography variant="14/regular" color="neutral-400">هنوز انتسابی ثبت نشده است.</Typography>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-60 flex-col gap-1">
              <Typography variant="12/regular" color="neutral-500">شخص</Typography>
              <select
                value={selectedEmployee}
                onChange={(event) => setSelectedEmployee(event.target.value)}
                className="h-10 rounded-lg border border-neutral-200 bg-white px-2"
              >
                <option value="">انتخاب کنید</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name ?? employee.id} — {assignmentRoleLabel(employee.operationalRole)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" size="40" disabled={!selectedEmployee} onClick={assign}>
              <Typography variant="14/regular" className="text-inherit">ثبت انتساب</Typography>
            </Button>
          </div>
          {assignmentError ? (
            <Typography role="alert" variant="14/regular" color="error">{assignmentError}</Typography>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

function requestStatusLabel(status: string): string {
  return {
    draft: 'پیش‌نویس',
    in_review: 'در حال بررسی',
    action_needed: 'نیازمند اصلاح',
    approved: 'تایید شده',
    rejected: 'رد شده',
  }[status] ?? status
}

function assignmentRoleLabel(role: string): string {
  return {
    'system-owner': 'صاحب سیستم',
    'central-secretariat': 'دبیرخانه مرکزی',
    'chief-reviewer': 'سردبیر داوری',
    reviewer: 'داور',
    'employer-reviewer': 'کارفرما',
    'investment-reviewer': 'کمیته سرمایه‌گذاری',
    representative: 'نماینده شرکت',
  }[role] ?? role
}
