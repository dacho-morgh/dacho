'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CalendarBulkIcon, ClockBulkIcon, DashboardMessageTextIcon,
  DashboardMoreIcon, DashboardTrashIcon,
} from '@/components/icons'
import { deleteLetter } from '@/utilities/dashboard-api'

export interface ThreadMessage {
  id: string
  title?: string
  senderName: string
  senderRole: string
  senderAvatar?: string
  datePersian: string
  dayOfWeek: string
  timeStr: string
  body: string
  attachments?: { id?: string; name: string; size: string; ext: string; downloadUrl?: string }[]
}

export interface MailData {
  id: string
  title: string
  category: string
  senderId?: string | null
  senderName: string
  senderRole: string
  senderEmail?: string
  senderAvatar?: string
  requestId?: string | null
  datePersian: string
  dayOfWeek: string
  timeStr: string
  body: string
  attachments?: { id?: string; name: string; size: string; ext: string; downloadUrl?: string }[]
  thread?: ThreadMessage[]
}

interface MailDetailViewProps {
  mail: MailData | null
  showActions?: boolean
  supportReply?: boolean
  supportClosed?: boolean
  /** Compose link that answers this letter while keeping its case scope. */
  replyHref?: string
}

export function MailDetailView({ mail, showActions = false, supportReply = false, supportClosed = false, replyHref }: MailDetailViewProps) {
  const router = useRouter()
  const deletingRef = useRef(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleDelete() {
    if (!mail || deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    try {
      await deleteLetter(mail.id)
      router.push('/dashboard/letters')
      router.refresh()
    } catch {
      deletingRef.current = false
      setDeleting(false)
      setNotice('حذف نامه انجام نشد. دوباره تلاش کنید.')
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 text-right" dir="rtl">
      <nav aria-label="مسیر نامه" className="flex min-h-9 flex-wrap items-center gap-2 pl-12 md:pl-0">
        <Typography asChild variant="16/regular" className="shrink-0 text-neutral-500 hover:text-brand-600">
          <Link href="/dashboard/letters">کارتابل نامه</Link>
        </Typography>
        <Typography as="span" variant="16/regular" className="text-neutral-500" aria-hidden="true">/</Typography>
        <Typography as="h1" variant="24/bold" className="min-w-0 break-words text-neutral-700">
          {mail?.title ?? 'عنوان نامه'}
        </Typography>
      </nav>
      <article aria-busy={!mail} aria-label="متن نامه" className={`flex flex-col gap-6 rounded-2xl bg-white p-4 ring-1 ring-inset ring-neutral-200 ${supportReply ? '' : 'min-h-[calc(100dvh-112px)]'}`}>
        {!mail && <>
          <Typography as="span" variant="14/regular" role="status" className="sr-only">در حال دریافت نامه</Typography>
          <div className="flex items-center gap-2" aria-hidden="true">
            <Skeleton className="size-10 shrink-0 rounded-full bg-neutral-100 motion-reduce:animate-none" />
            <Skeleton className="h-7 w-[200px] max-w-[60vw] rounded-lg bg-neutral-100 motion-reduce:animate-none" />
          </div>
          <div className="flex flex-col gap-2 text-neutral-400" aria-hidden="true">
            <div className="flex items-center gap-2">
              <CalendarBulkIcon className="size-6 shrink-0" />
              <Skeleton className="h-7 w-[200px] max-w-[60vw] rounded-lg bg-neutral-100 motion-reduce:animate-none" />
            </div>
            <div className="flex items-center gap-2">
              <ClockBulkIcon className="size-6 shrink-0" />
              <Skeleton className="h-7 w-[200px] max-w-[60vw] rounded-lg bg-neutral-100 motion-reduce:animate-none" />
            </div>
          </div>
          <div role="separator" className="h-0 w-full border-t border-neutral-100" />
          <Skeleton className="h-8 w-[200px] max-w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />
          {[0, 1, 2].map((line) => <Skeleton key={line} className="h-7 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />)}
        </>}
        {mail && <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              {mail.senderAvatar ? (
                <Image src={mail.senderAvatar} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <Typography as="span" variant="14/semibold" aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  {mail.senderName.slice(0, 1)}
                </Typography>
              )}
              <div className="min-w-0">
                <Typography variant="16/semibold" className="break-words text-neutral-600">{mail.senderName}</Typography>
                <Typography variant="14/regular" className="break-words text-neutral-500">{mail.senderRole}</Typography>
              </div>
            </div>
            {supportReply && !supportClosed && <Button type="button" variant="white" size="40" onClick={() => {
              const target = document.getElementById('support-reply') ?? document.getElementById('support-conversation')
              target?.scrollIntoView({ block: 'center' })
              target?.focus({ preventScroll: true })
            }}>
              <DashboardMessageTextIcon aria-hidden="true" className="size-6" />
              <Typography as="span" variant="16/semibold" className="text-inherit">ثبت بازخورد</Typography>
            </Button>}
            {showActions && (
              <div className="mr-auto flex items-center gap-1">
                {replyHref ? (
                  <Button asChild variant="white" size="40">
                    <Link href={replyHref}>
                      <DashboardMessageTextIcon aria-hidden="true" className="size-6" />
                      <Typography as="span" variant="16/semibold" className="text-neutral-700">ثبت بازخورد</Typography>
                    </Link>
                  </Button>
                ) : (
                  <Button type="button" variant="white" size="40" onClick={() => setNotice('ثبت بازخورد هنوز در دسترس نیست.')}>
                    <DashboardMessageTextIcon aria-hidden="true" className="size-6" />
                    <Typography as="span" variant="16/semibold" className="text-neutral-700">ثبت بازخورد</Typography>
                  </Button>
                )}
                <DropdownMenu dir="rtl">
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="white" size="icon-40" aria-label="عملیات بیشتر" disabled={deleting}>
                      <DashboardMoreIcon aria-hidden="true" className="size-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[164px]">
                    <DropdownMenuItem variant="destructive" disabled={deleting} onSelect={handleDelete}>
                      <DashboardTrashIcon aria-hidden="true" className="size-5" />
                      <Typography as="span" variant="14/regular" className="text-inherit">پاک کردن</Typography>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 text-neutral-400">
            <div className="flex items-center gap-2">
              <CalendarBulkIcon aria-hidden="true" className="size-6 shrink-0" />
              <Typography as="span" variant="16/regular" className="text-neutral-400">{mail.dayOfWeek}</Typography>
              <Typography as="span" variant="16/regular" className="text-neutral-400">{mail.datePersian}</Typography>
            </div>
            <div className="flex items-center gap-2">
              <ClockBulkIcon aria-hidden="true" className="size-6 shrink-0" />
              <Typography as="span" variant="16/regular" className="text-neutral-400">{mail.timeStr ? `ساعت ${mail.timeStr}` : '—'}</Typography>
            </div>
          </div>
          <div role="separator" className="h-0 w-full border-t border-neutral-100" />
          <Typography as="h2" variant="20/bold" className="break-words text-neutral-700">{mail.title}</Typography>
          {mail.body && <Typography variant="16/regular" className="whitespace-pre-wrap break-words text-neutral-500">{mail.body}</Typography>}
          {!!mail.attachments?.length && (
            <section aria-label="پیوست‌های نامه" className="flex flex-col gap-2">
              <Typography variant="14/semibold" className="text-neutral-600">پیوست‌های نامه</Typography>
              <div className="flex flex-col gap-2">
                {mail.attachments.map((attachment, index) => (
                  <div
                    key={attachment.id || index}
                    className="flex items-center justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Typography as="span" variant="14/regular" className="text-neutral-700">
                        {attachment.name}
                      </Typography>
                      <Typography as="span" variant="14/regular" className="text-neutral-400">
                        {`(${attachment.size})`}
                      </Typography>
                    </div>
                    {attachment.downloadUrl && (
                      <Button asChild variant="outline" size="sm" className="h-8 px-3 text-xs">
                        <a
                          href={attachment.downloadUrl}
                          download={attachment.name}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          دانلود
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {!!mail.thread?.length && (
            <section aria-label="تاریخچه مکاتبات پرونده" className="mt-4 flex flex-col gap-4 border-t border-neutral-100 pt-4">
              <Typography variant="14/semibold" className="text-neutral-600">
                تاریخچه مکاتبات پرونده
              </Typography>
              <div className="flex flex-col gap-4">
                {mail.thread.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Typography as="span" variant="14/semibold" aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                          {msg.senderName.slice(0, 1)}
                        </Typography>
                        <div>
                          <Typography variant="14/semibold" className="text-neutral-700">{msg.senderName}</Typography>
                          <Typography variant="12/regular" className="text-neutral-500">{msg.senderRole}</Typography>
                        </div>
                      </div>
                      <Typography variant="12/regular" className="text-neutral-400">
                        {msg.dayOfWeek} {msg.datePersian} {msg.timeStr ? `ساعت ${msg.timeStr}` : ''}
                      </Typography>
                    </div>
                    {msg.title && (
                      <Typography variant="14/semibold" className="text-neutral-700">{msg.title}</Typography>
                    )}
                    {msg.body && (
                      <Typography variant="14/regular" className="whitespace-pre-wrap text-neutral-600">{msg.body}</Typography>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>}
        {notice && <Typography role="status" variant="14/regular" className="rounded-lg bg-neutral-100 p-3 text-neutral-600">{notice}</Typography>}
      </article>
    </div>
  )
}
