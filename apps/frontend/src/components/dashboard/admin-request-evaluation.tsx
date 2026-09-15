'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { useEffect, useState } from 'react'

export function AdminRequestEvaluation({ id }: { id: string }) {
  const [data, setData] = useState<{ request: { title: string; status: string; answers: Record<string, unknown> }; owner?: { companyName?: string; name?: string }; workflow: { title: string }[] } | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { fetch(`/api/dashboard/admin/requests/${encodeURIComponent(id)}`).then((res) => res.ok ? res.json() : null).then(setData).catch(() => setData(null)) }, [id])
  const transition = async (value: 'forward' | 'reject') => {
    setSaving(true)
    setNotice(null)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard/admin/requests/${encodeURIComponent(id)}/transition`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transition: value, note }) })
      if (!response.ok) throw new Error('transition_failed')
      const result = await response.json() as { request?: { title: string; status: string; answers: Record<string, unknown> } }
      if (!result.request) throw new Error('invalid_transition_response')
      setData((current) => current ? { ...current, request: result.request as typeof current.request } : current)
      setNotice(value === 'forward' ? 'درخواست با موفقیت تایید شد.' : 'درخواست با موفقیت رد شد.')
    } catch {
      setError('تغییر وضعیت درخواست انجام نشد. لطفاً دوباره تلاش کنید.')
    } finally { setSaving(false) }
  }
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/admin/requests/${id}`}>
          <Typography variant="16/regular" color="muted">
            درخواست ها
          </Typography>
        </Link>
        <Typography variant="16/regular" color="muted">
          / {data?.owner?.companyName || data?.owner?.name || 'جزئیات درخواست'} /
        </Typography>
        <Typography variant="24/bold" color="neutral-900">
          ارزیابی درخواست
        </Typography>
      </div>
      {notice && <Typography role="status" variant="14/regular" className="rounded-lg bg-brand-50 p-3 text-brand-700">{notice}</Typography>}
      {error && <Typography role="alert" variant="14/regular" className="rounded-lg bg-error-50 p-3 text-error-700">{error}</Typography>}
      <section className="flex min-h-[912px] flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <Typography variant="20/bold" color="neutral-900">
          {data?.request.title || 'در حال بارگذاری درخواست'}
        </Typography>
        {data?.request.status && <Typography variant="14/regular" className="text-neutral-500">وضعیت فعلی: {requestStatusLabel(data.request.status)}</Typography>}
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="order-2 flex max-h-[828px] w-full max-w-[654px] flex-col gap-4 overflow-y-auto lg:order-1">
            <FormCard title="اطلاعات درخواست" answers={data?.request.answers ?? {}} />
          </div>
          <div className="order-1 flex h-[768px] w-full max-w-[438px] flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm lg:order-2">
            <Typography variant="20/bold" color="neutral-900">
              فرم ارزیابی
            </Typography>
            <Typography variant="16/semibold" color="secondary" className="mt-5">
              متن پیام
            </Typography>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)}
              className="mt-2 min-h-0 flex-1 resize-none rounded-lg"
              placeholder="متن پلیس هولدر"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline-gray" size="40" disabled={!data || saving} onClick={() => transition('reject')}>
                <Typography variant="16/semibold" color="secondary">
                  رد درخواست
                </Typography>
              </Button>
              <Button size="40" disabled={!data || saving} onClick={() => transition('forward')}>
                <Typography variant="16/semibold" color="white">
                  تایید درخواست
                </Typography>
              </Button>
            </div>
          </div>
        </div>
      </section>
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

function FormCard({ title, answers }: { title: string; answers: Record<string, unknown> }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4">
      <Typography variant="20/bold" color="neutral-900">
        {title}
      </Typography>
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {Object.entries(answers).map(([label, value]) => (
          <label key={`${title}-${label}`} className="flex flex-col gap-2">
            <Typography variant="16/semibold" color="secondary">
              {label}
            </Typography>
            <Input readOnly value={String(value ?? '')} className="h-10 rounded-lg bg-white" />
          </label>
        ))}
      </div>
    </section>
  )
}
