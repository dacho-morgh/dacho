'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

interface Assignment {
  id: string
  userId: string
  role: string
  active: boolean
}

interface Employee {
  id: string
  name: string | null
  operationalRole: string
}

const ERROR_MESSAGES: Record<string, string> = {
  already_assigned: 'این شخص قبلاً به پرونده منتسب شده است.',
  managed_by_review_round: 'این انتساب بخشی از دور داوری است و از اینجا لغو نمی‌شود.',
}

/** The owner's case assignments. Slots of a review round are managed by the round itself. */
export function RequestAssignmentPanel({ id }: { id: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [error, setError] = useState<string | null>(null)
  const base = `/api/dashboard/admin/requests/${encodeURIComponent(id)}/assignments`

  const loadAssignments = useCallback(async () => {
    const response = await fetch(base)
    if (!response.ok) {
      setError('دریافت انتساب‌ها انجام نشد.')
      return
    }
    const body = (await response.json()) as { items: Assignment[] }
    setAssignments(body.items.filter((assignment) => assignment.active))
  }, [base])

  useEffect(() => {
    let active = true
    void loadAssignments()
    fetch('/api/dashboard/admin/employees')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active) setEmployees(payload?.items ?? [])
      })
      .catch(() => setEmployees([]))
    return () => {
      active = false
    }
  }, [loadAssignments])

  const failure = async (response: Response, fallback: string) => {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    setError(ERROR_MESSAGES[body?.error ?? ''] ?? fallback)
  }

  const assign = async () => {
    const employee = employees.find((item) => item.id === selectedEmployee)
    if (!employee) return
    setError(null)
    const response = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: employee.id, role: employee.operationalRole }),
    })
    if (!response.ok) {
      await failure(response, 'انتساب انجام نشد.')
      return
    }
    setSelectedEmployee('')
    await loadAssignments()
  }

  const revoke = async (assignment: Assignment) => {
    setError(null)
    const response = await fetch(`${base}/${encodeURIComponent(assignment.userId)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'revoked by owner' }),
    })
    if (!response.ok) {
      await failure(response, 'لغو انتساب انجام نشد.')
      return
    }
    await loadAssignments()
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
      <Typography as="h2" variant="20/bold" color="neutral-900">
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
      {error ? (
        <Typography role="alert" variant="14/regular" color="error">{error}</Typography>
      ) : null}
    </section>
  )
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
