'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
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
import { deleteLetter, describeMutationFailure } from '@/utilities/dashboard-api'
import { letterAttachmentDownloadPath } from '@/utilities/document-api'
import { toast } from 'sonner'

export interface MailAttachment {
  id: string
  name: string
  size: string
}

export interface MailData {
  id: string
  title: string
  category: string
  senderName: string
  senderRole: string
  senderEmail?: string
  senderAvatar?: string
  datePersian: string
  dayOfWeek: string
  timeStr: string
  body: string
  /** Authorized attachment metadata; bytes come only from the letter-scoped download route. */
  attachments?: MailAttachment[]
  /** Other letters of this case the reader may see, oldest first. */
  thread?: MailData[]
  /** Why the case history above may be incomplete. */
  threadNotice?: string
  /** The reader's pending next step on the case (S1 inbox). */
  action?: { label: string; href: string } | null
}

interface MailDetailViewProps {
  mail: MailData | null
  showActions?: boolean
  supportReply?: boolean
  supportClosed?: boolean
  /** Compose link that answers this letter; absent when policy does not allow a reply. */
  replyHref?: string
  /** Only the recipient's mailbox can drop a letter; its sender keeps their copy. */
  canDelete?: boolean
}

function LetterAttachments({ letterId, attachments }: { letterId: string; attachments: MailAttachment[] }) {
  return (
    <section aria-label="پیوست‌های نامه" className="flex flex-col gap-2">
      <Typography variant="14/semibold" className="text-neutral-600">پیوست‌های نامه</Typography>
      <ul className="flex flex-col gap-2">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2">
            <div className="flex min-w-0 flex-col gap-1">
              <Typography variant="14/semibold" className="break-all text-neutral-700"><bdi dir="auto">{attachment.name}</bdi></Typography>
              <Typography variant="12/light" className="text-neutral-400">{attachment.size}</Typography>
            </div>
            <PrivateDocumentDownload path={letterAttachmentDownloadPath(letterId, attachment.id)} filename={attachment.name} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function MailDetailView({ mail, showActions = false, supportReply = false, supportClosed = false, replyHref, canDelete = true }: MailDetailViewProps) {
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
      toast.success('نامه از کارتابل حذف شد.')
      router.push('/dashboard/letters')
      router.refresh()
    } catch (cause) {
      deletingRef.current = false
      setDeleting(false)
      toast.error('حذف نامه انجام نشد.')
      setNotice(describeMutationFailure(cause, 'حذف نامه انجام نشد. دوباره تلاش کنید.'))
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
                {mail.action && (
                  <Button asChild size="40">
                    <Link href={mail.action.href}>
                      <Typography as="span" variant="16/semibold" className="text-inherit">{mail.action.label}</Typography>
                    </Link>
                  </Button>
                )}
                {replyHref && (
                  <Button asChild variant="white" size="40">
                    <Link href={replyHref}>
                      <DashboardMessageTextIcon aria-hidden="true" className="size-6" />
                      <Typography as="span" variant="16/semibold" className="text-neutral-700">ثبت بازخورد</Typography>
                    </Link>
                  </Button>
                )}
                {canDelete && <DropdownMenu dir="rtl">
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
                </DropdownMenu>}
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
          {!!mail.attachments?.length && <LetterAttachments letterId={mail.id} attachments={mail.attachments} />}
          {(!!mail.thread?.length || mail.threadNotice) && (
            <section aria-label="تاریخچه مکاتبات پرونده" className="flex flex-col gap-4 border-t border-neutral-100 pt-4">
              <Typography variant="14/semibold" className="text-neutral-600">تاریخچه مکاتبات پرونده</Typography>
              {mail.threadNotice && <Typography role="status" variant="14/regular" className="text-neutral-500">{mail.threadNotice}</Typography>}
              {mail.thread?.map((message) => (
                <article key={message.id} className="flex flex-col gap-3 rounded-xl border border-neutral-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Typography variant="14/semibold" className="break-words text-neutral-700">{message.senderName}</Typography>
                      <Typography variant="12/regular" className="break-words text-neutral-500">{message.senderRole}</Typography>
                    </div>
                    <Typography variant="12/regular" className="text-neutral-400">
                      {message.dayOfWeek} {message.datePersian} {message.timeStr && `ساعت ${message.timeStr}`}
                    </Typography>
                  </div>
                  <Typography variant="14/semibold" className="break-words text-neutral-700">{message.title}</Typography>
                  {message.body && <Typography variant="14/regular" className="whitespace-pre-wrap break-words text-neutral-600">{message.body}</Typography>}
                  {!!message.attachments?.length && <LetterAttachments letterId={message.id} attachments={message.attachments} />}
                </article>
              ))}
            </section>
          )}
        </>}
        {notice && <Typography role="status" variant="14/regular" className="rounded-lg bg-neutral-100 p-3 text-neutral-600">{notice}</Typography>}
      </article>
    </div>
  )
}
