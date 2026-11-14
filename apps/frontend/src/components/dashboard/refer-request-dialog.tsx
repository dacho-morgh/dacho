'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import { DecisionDialog } from '@/components/dashboard/decision-dialog'
import { DashboardCloseCircle, InformationBulkIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  decideTriage,
  describeMutationFailure,
  getReviewCandidates,
  startReviewRound,
  type ReviewCandidatesDto,
} from '@/utilities/dashboard-api'

const REVIEWERS = 3

const ERROR_MESSAGES: Record<string, string> = {
  stale_revision: 'پرونده پس از باز شدن این صفحه تغییر کرده است. صفحه به‌روز شد؛ وضعیت را دوباره بررسی کنید.',
  invalid_triage_state: 'پرونده دیگر در مرحله بررسی اولیه نیست. صفحه به‌روز شد.',
  invalid_round_state: 'پرونده دیگر در مرحله داوری نیست. صفحه به‌روز شد.',
  round_already_started: 'دور داوری این نسخه قبلاً آغاز شده است. صفحه به‌روز شد.',
  employer_unavailable: 'کارفرمای فعالی برای این پرونده در دسترس نیست. با صاحب سیستم تماس بگیرید.',
  reviewer_not_eligible: 'داور انتخاب‌شده دیگر فعال یا واجد شرایط نیست. داور دیگری انتخاب کنید.',
  duplicate_people: 'هر جایگاه باید به فرد متفاوتی برسد.',
  forbidden: 'این اقدام برای نقش شما مجاز نیست یا دسترسی شما تغییر کرده است.',
  not_found: 'پرونده پیدا نشد یا دیگر در دسترس شما نیست.',
}

const errorMessage = (cause: unknown) =>
  ERROR_MESSAGES[cause instanceof DashboardApiError ? cause.code : ''] ??
  describeMutationFailure(cause, 'اقدام انجام نشد. دوباره تلاش کنید.')

const fa = (value: number) => value.toLocaleString('fa-IR')

/** A round with initials, since accounts carry no picture. */
function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"
    >
      <Typography as="span" variant="14/semibold" className="text-inherit">
        {name.trim().charAt(0) || '—'}
      </Typography>
    </span>
  )
}

/**
 * «ارجاع» from the requests list (Figma 31885:20481): the chief picks three reviewers one at a time, may leave a
 * note, and refers the case. The fixed employer takes the fourth place. Two commands run in order: the first
 * accepts the case in triage, the second starts its review round with the picked reviewers.
 */
export function ReferRequestDialog({
  id,
  revision,
  onClose,
}: {
  id: string
  revision?: number
  onClose: () => void
}) {
  const router = useRouter()
  const selectId = useId()
  const noteId = useId()
  const [candidates, setCandidates] = useState<{ data: ReviewCandidatesDto | null; error: string | null }>({
    data: null,
    error: null,
  })
  const [picked, setPicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getReviewCandidates(id)
      .then((data) => alive && setCandidates({ data, error: null }))
      .catch((cause: unknown) => alive && setCandidates({ data: null, error: errorMessage(cause) }))
    return () => {
      alive = false
    }
  }, [id])

  const items = candidates.data?.items ?? []
  const nameOf = (userId: string) => items.find((person) => person.id === userId)?.name ?? 'بدون نام'
  const employerName = candidates.data?.employerName || 'کارفرمای پرونده'
  const full = picked.length >= REVIEWERS

  const submit = async () => {
    if (busy) return
    if (picked.length !== REVIEWERS) {
      setError(`${fa(REVIEWERS)} داور را انتخاب کنید.`)
      return
    }
    setBusy(true)
    setError(null)
    let accepted = false
    try {
      const result = (await decideTriage(id, 'accept', note.trim(), revision)) as { request?: { revision?: number } }
      accepted = true
      await startReviewRound(id, picked, result.request?.revision ?? revision)
      toast.success('درخواست به داوران ارجاع شد.')
      onClose()
    } catch (cause) {
      toast.error('ارجاع انجام نشد.')
      setError(
        accepted
          ? `درخواست پذیرفته شد، اما ارجاع به داوران انجام نشد. ${errorMessage(cause)} از صفحه پرونده دوباره ارجاع دهید.`
          : errorMessage(cause),
      )
      setBusy(false)
    } finally {
      router.refresh()
    }
  }

  return (
    <DecisionDialog
      title="ارجاع درخواست"
      description={`در این مرحله شما می‌توانید درخواست را به ${fa(REVIEWERS)} داور برای داوری ارجاع دهید.`}
      onClose={() => {
        if (!busy) onClose()
      }}
      actions={
        <>
          <Button type="button" size="40" disabled={busy || !candidates.data} onClick={() => void submit()}>
            <Typography variant="14/regular" className="text-inherit">{busy ? 'در حال ثبت…' : 'ارجاع'}</Typography>
          </Button>
          <Button type="button" variant="outline-primary" size="40" disabled={busy} onClick={onClose}>
            <Typography variant="14/regular" className="text-inherit">لغو</Typography>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={selectId}>
          <Typography as="span" variant="16/semibold" color="neutral-700">داور</Typography>
        </label>
        {candidates.error ? (
          <Typography role="alert" variant="14/regular" color="error">دریافت فهرست داوران انجام نشد. {candidates.error}</Typography>
        ) : (
          <DashboardSelect
            id={selectId}
            label="داور"
            value=""
            disabled={busy || !candidates.data || full}
            placeholder={candidates.data ? 'داور خود را انتخاب کنید' : 'در حال دریافت فهرست داوران…'}
            options={items.filter((person) => !picked.includes(person.id)).map((person) => ({ value: person.id, label: person.name ?? 'بدون نام' }))}
            onChange={(next) => {
              if (!next || picked.includes(next) || full) return
              setError(null)
              setPicked((current) => [...current, next])
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={noteId}>
          <Typography as="span" variant="16/semibold" color="neutral-700">توضیحات</Typography>
        </label>
        <Textarea
          id={noteId}
          value={note}
          disabled={busy}
          rows={5}
          placeholder="متن توضیحات خود را وارد کنید"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4">
        <div className="flex items-center gap-2">
          <Typography as="h3" variant="16/semibold" color="neutral-700">داوران انتخابی</Typography>
          <Badge variant="gray" size="sm">{fa(picked.length + 1)}/{fa(REVIEWERS + 1)}</Badge>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="text-gray" size="icon-xs" aria-label="راهنمای داوران انتخابی">
                  <InformationBulkIcon aria-hidden="true" className="size-5 text-neutral-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                در صورت عدم تکمیل داوری از سمت یکی از داوران، داور را حذف کنید و یک داور جایگزین اضافه کنید
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Typography variant="14/regular" color="neutral-500">
          برای اتمام داوری نیاز به {fa(REVIEWERS + 1)} داوری تمام شده است
        </Typography>
        <ul className="flex flex-col gap-3" aria-label="داوران انتخابی">
          <li className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Initial name={employerName} />
              <Typography as="span" variant="16/regular" color="neutral-500" className="truncate">{employerName}</Typography>
              <Badge variant="gray" size="sm">کارفرما</Badge>
            </div>
            <Badge variant="gray" size="sm">مشاهده نشده</Badge>
          </li>
          {picked.map((userId) => (
            <li key={userId} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Initial name={nameOf(userId)} />
                <Typography as="span" variant="16/regular" color="neutral-700" className="truncate">{nameOf(userId)}</Typography>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="gray" size="sm">مشاهده نشده</Badge>
                <Button
                  type="button"
                  variant="text-gray"
                  size="icon-32"
                  disabled={busy}
                  aria-label={`حذف ${nameOf(userId)}`}
                  onClick={() => setPicked((current) => current.filter((item) => item !== userId))}
                >
                  <DashboardCloseCircle aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
    </DecisionDialog>
  )
}
