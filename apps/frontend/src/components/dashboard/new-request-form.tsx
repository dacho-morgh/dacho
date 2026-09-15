'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { createRequest, submitRequest } from '@/utilities/dashboard-api'

export interface RequestFormOption { label: string; value: string }
export interface RequestFormField { name: string; label?: string; blockType: string; required?: boolean; options?: RequestFormOption[] }
export function NewRequestForm({ serviceId, title, fields, initialAnswers = {} }: { serviceId: string; title: string; fields: RequestFormField[]; initialAnswers?: Record<string, string> }) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const update = (name: string, value: string) => setAnswers((current) => ({ ...current, [name]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const created = await createRequest({ serviceId, title, answers })
      await submitRequest(created.request.id)
      router.push(`/dashboard/requests/${encodeURIComponent(created.request.id)}`)
    } catch { setError('ثبت درخواست انجام نشد. لطفاً دوباره تلاش کنید.') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-5" dir="rtl">
    {fields.map((field) => {
      const label = field.label || field.name
      if (field.blockType.includes('textarea') || field.blockType.includes('richText')) return <label key={field.name} className="block"><Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}</Typography><Textarea required={field.required} value={answers[field.name] ?? ''} onChange={(event) => update(field.name, event.target.value)} /></label>
      if (field.blockType.includes('select') && field.options?.length) return <label key={field.name} className="block"><Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}</Typography><select required={field.required} value={answers[field.name] ?? ''} onChange={(event) => update(field.name, event.target.value)} className="h-12 w-full rounded-lg border border-neutral-200 bg-white px-3"><option value="">انتخاب کنید</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      return <Input key={field.name} required={field.required} label={label} value={answers[field.name] ?? ''} onChange={(event) => update(field.name, event.target.value)} />
    })}
    {error && <Typography role="alert" variant="14/regular" className="text-error-600">{error}</Typography>}
    <Button type="submit" loading={saving} disabled={saving}>ثبت و ارسال درخواست</Button>
  </form>
}
