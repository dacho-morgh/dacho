'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SupportTicketActions({ id, status }: { id: string; status: 'open' | 'answered' | 'closed' }) {
  const router = useRouter()
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const act = async (url: string, body?: object) => {
    setBusy(true); setNotice(null)
    try {
      const result = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      if (!result.ok) throw new Error()
      setResponse(''); setNotice('عملیات با موفقیت انجام شد.'); router.refresh()
    } catch { setNotice('عملیات انجام نشد.') } finally { setBusy(false) }
  }
  return <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5" dir="rtl">
    {notice && <p className="mb-3 text-sm text-neutral-600">{notice}</p>}
    {status !== 'closed' && <>
      <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} placeholder="پاسخ پشتیبانی..." className="w-full rounded-xl border border-neutral-200 p-3 text-sm" />
      <button type="button" disabled={busy || !response.trim()} onClick={() => act(`/api/dashboard/support/${encodeURIComponent(id)}/respond`, { response: response.trim() })} className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">ارسال پاسخ</button>
      <button type="button" disabled={busy} onClick={() => act(`/api/dashboard/support/${encodeURIComponent(id)}/close`)} className="mr-2 mt-3 rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-700 disabled:opacity-50">بستن تیکت</button>
    </>}
  </div>
}
