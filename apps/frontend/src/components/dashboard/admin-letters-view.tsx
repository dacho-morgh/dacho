'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { InboxListView, type LetterItem } from './inbox-list-view'
import { mapLetterItem, type LetterDto } from '@/utilities/dashboard-api'

interface CompanyOption { id: string; companyName?: string; name?: string }

export function AdminLettersView({ initialLetters }: { initialLetters: LetterItem[] }) {
  const [letters, setLetters] = useState(initialLetters)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [recipientId, setRecipientId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/admin/companies?limit=100').then((response) => response.ok ? response.json() : null).then((data) => setCompanies(data?.items ?? [])).catch(() => setCompanies([]))
  }, [])

  const compose = async (event: FormEvent) => {
    event.preventDefault()
    if (!recipientId || !title.trim() || !body.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/admin/letters', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipientId, title: title.trim(), body: body.trim(), type: 'official' }) })
      if (!response.ok) throw new Error('compose_failed')
      const data = await response.json() as { letter?: LetterDto }
      if (!data.letter) throw new Error('invalid_response')
      setLetters((current) => [mapLetterItem(data.letter as LetterDto), ...current])
      setRecipientId('')
      setTitle('')
      setBody('')
    } catch {
      setError('ارسال نامه انجام نشد. لطفاً دوباره تلاش کنید.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-5" dir="rtl">
    <form onSubmit={compose} className="rounded-2xl border border-neutral-200 bg-white p-5">
      <Typography as="h2" variant="20/bold" className="text-neutral-900">ارسال نامه جدید</Typography>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2"><Typography variant="14/semibold" className="text-neutral-700">گیرنده</Typography><select required value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="h-10 rounded-lg border border-neutral-200 bg-white px-3"><option value="">انتخاب شرکت</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.companyName || company.name || company.id}</option>)}</select></label>
        <Input required label="عنوان" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <Textarea required className="mt-4" placeholder="متن نامه" value={body} onChange={(event) => setBody(event.target.value)} />
      {companies.length === 0 && <Typography variant="12/regular" className="mt-2 text-neutral-500">شرکتی برای انتخاب وجود ندارد.</Typography>}
      {error && <Typography role="alert" variant="14/regular" className="mt-2 text-error-600">{error}</Typography>}
      <Button type="submit" className="mt-4" disabled={saving || companies.length === 0}>{saving ? 'در حال ارسال...' : 'ارسال نامه'}</Button>
    </form>
    <InboxListView letters={letters} onLettersChange={setLetters} basePath="/dashboard/letters" showSupport={false} />
  </div>
}
