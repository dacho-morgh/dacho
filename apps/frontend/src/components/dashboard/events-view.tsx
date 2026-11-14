'use client'

import { SearchField } from '@/components/dashboard/search-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, FileText, RotateCcw } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CalendarBulkIcon,
  DashboardCloseCircle,
  EmptyInboxIllustration,
  LocationBulkIcon,
  TickSquareIcon,
} from '@/components/icons'
import { Skeleton } from '@/components/ui/skeleton'
import { TreeRow } from '@/components/dashboard/event-tree-row'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  formatFileSize,
  getEventCategories,
  getEventSubtopics,
  getRfpDownloadUrl,
  getSubtopicRfp,
  type EventCategoryDto,
  type EventSubtopicDto,
  type RfpVersionDto,
} from '@/utilities/dashboard-api'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { ListToolbar } from '@/components/dashboard/list-toolbar'
import { rowActivationProps } from '@/components/dashboard/list-table'

export interface EventItem {
  id: string
  rawId?: string
  serviceKey: 'events' | 'exhibitions'
  title: string
  description?: string
  badgeText: string
  badgeType: 'ended' | 'active' | 'upcoming'
  dates: string
  location: string
  imageSrc?: string
  hasActionButton?: boolean
  actionButtonText?: string
  startTimestamp?: number
}

export interface EventsViewProps {
  initialEventsList?: EventItem[]
  state?: 'default' | 'loading' | 'empty'
  isOwner?: boolean
  initialSelectedEventId?: string
  /** Subtopics the representative chose before leaving to complete the profile. */
}

/**
 * The status tag of an event (design QA #281, Figma Tag 45:1243): «پیش‌رو» is the secondary (amber) tag,
 * «در حال برگزاری» the primary (blue) one and «تمام‌شده» the gray one.
 */
export const EVENT_TAG_VARIANT = {
  upcoming: 'secondary',
  active: 'primary',
  ended: 'gray',
} as const satisfies Record<EventItem['badgeType'], 'secondary' | 'primary' | 'gray'>

export function EventStatusTag({ type, children }: { type: EventItem['badgeType']; children: ReactNode }) {
  return (
    <Badge variant={EVENT_TAG_VARIANT[type]} size="md" data-event-status={type}>
      {children}
    </Badge>
  )
}

/**
 * One line of an event card: the icon first, then the text (Figma 56:13490 / 56:13493). In the RTL page the
 * first child sits on the right. The text is the 16/SemiBold body style in neutral-600.
 */
function EventMetaRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <Typography as="span" variant="16/semibold" color="neutral-600" className="min-w-0 flex-1 break-words">
        {children}
      </Typography>
    </div>
  )
}

/** Date and place of an event card: a 16px gap between the two lines (Figma 56:13489 / 56:13527). */
export function EventMeta({ dates, location }: { dates: string; location: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <EventMetaRow icon={<CalendarBulkIcon className="size-[28px] shrink-0 text-neutral-400" />}>{dates}</EventMetaRow>
      <EventMetaRow icon={<LocationBulkIcon className="size-[28px] shrink-0 text-neutral-400" />}>{location}</EventMetaRow>
    </div>
  )
}

// Skeleton state matching Figma node 56:13600
function EventsSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری رویدادها" className="flex flex-col gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col-reverse items-start justify-end gap-[16px] sm:h-[200px] sm:flex-row"
        >
          {/* Content skeleton on left */}
          <div className="flex h-[168px] w-full flex-1 flex-col justify-between py-1">
            <div>
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-neutral-100" />
              <Skeleton className="mt-[16px] h-[32px] w-[400px] max-w-full rounded-[8px] bg-neutral-100" />
            </div>
            <div className="space-y-[16px]">
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-neutral-100" />
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-neutral-100" />
            </div>
          </div>

          {/* Square thumbnail skeleton on right */}
          <Skeleton className="size-[200px] shrink-0 rounded-[8px] bg-neutral-100" />
        </div>
      ))}
    </div>
  )
}

// Skeleton state for Categories/Subtopics hierarchy
function TreeSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری عناوین و زیرعنوان‌ها" className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-neutral-100 p-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48 rounded-md bg-neutral-100" />
            <Skeleton className="h-6 w-20 rounded-md bg-neutral-100" />
          </div>
          <div className="ms-6 flex flex-col gap-2 pt-2">
            <Skeleton className="h-5 w-64 rounded-md bg-neutral-100" />
            <Skeleton className="h-5 w-56 rounded-md bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Empty state matching Figma node 56:13860 / 56:14004
function EventsEmptyState({ noMatch = false }: { noMatch?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-28 text-center">
      <div className="flex flex-col items-center gap-[4px]">
        <div className="flex size-[80px] items-center justify-center">
          <EmptyInboxIllustration className="size-[80px]" />
        </div>
        <p className="mt-1 font-sans text-[14px] leading-[24px] font-semibold text-neutral-600">
          {noMatch ? 'نتیجه‌ای پیدا نشد' : 'رویداد و نمایشگاهی در سیستم موجود نیست'}
        </p>
        <p className="font-sans text-[12px] leading-[20px] font-normal text-neutral-500">
          {noMatch ? 'عبارت جستجو یا فیلتر را تغییر دهید' : 'در صورت ایجاد رویداد یا نمایشگاه به شما اطلاع رسانی خواهیم کرد'}
        </p>
      </div>
    </div>
  )
}

/**
 * The popup behind «ثبت نام»: the applicant picks the title and the subtitle to apply for, and confirming
 * continues to the application page for that subtitle.
 */
function RegisterDialog({
  onClose,
  categories,
  subtopics,
  onConfirm,
}: {
  onClose: () => void
  categories: EventCategoryDto[]
  subtopics: EventSubtopicDto[]
  onConfirm: (subtopicId: string) => void
}) {
  const [selectedCatId, setSelectedCatId] = useState('')
  const [selectedSubId, setSelectedSubId] = useState('')
  const availableSubtopics = useMemo(
    () => subtopics.filter((sub) => sub.categoryId === selectedCatId),
    [subtopics, selectedCatId],
  )

  const chooseCategory = (categoryId: string) => {
    setSelectedCatId(categoryId)
    setSelectedSubId('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[400px] gap-5 rounded-[16px] p-4 sm:p-4">
        {/* Header (Figma 31994:87443): the title at the start, the close button at the end */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <DialogTitle>انتخاب عنوان</DialogTitle>
            <Button variant="text-gray" size="icon-40" type="button" onClick={onClose}>
              <DashboardCloseCircle aria-hidden="true" />
              <span className="sr-only">بستن پنجره</span>
            </Button>
          </div>
          <DialogDescription>
            برای مشاهده فرم عنوان و زیر عنوان مورد نظر خود را انتخاب کنید.
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="register-cat-select">
              <Typography as="span" variant="16/semibold" color="neutral-700">
                عنوان
              </Typography>
            </label>
            <DashboardSelect
              id="register-cat-select"
              label="عنوان"
              placeholder="عنوان مد نظر خود را انتخاب کنید"
              options={categories.map((c) => ({ value: c.id, label: c.title }))}
              value={selectedCatId}
              onChange={chooseCategory}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-sub-select">
              <Typography as="span" variant="16/semibold" color="neutral-700">
                زیر عنوان
              </Typography>
            </label>
            <DashboardSelect
              id="register-sub-select"
              label="زیر عنوان"
              placeholder="زیر عنوان مد نظر خود را انتخاب کنید"
              disabled={availableSubtopics.length === 0}
              options={availableSubtopics.map((s) => ({ value: s.id, label: s.title }))}
              value={selectedSubId}
              onChange={setSelectedSubId}
            />
          </div>
        </div>

        {/* Confirm first in the DOM: it sits at the start (right) and cancel follows on its left */}
        <div className="flex items-center gap-2">
          <Button size="40" type="button" className="flex-1" onClick={() => onConfirm(selectedSubId)} disabled={!selectedSubId}>
            تایید
          </Button>
          <Button variant="outline-primary" size="40" type="button" className="flex-1" onClick={onClose}>
            لغو
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function describeHierarchyFailure(cause: unknown): string {
  if (cause instanceof TypeError) return 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.'
  if (cause instanceof DashboardApiError) {
    if (cause.status === 401) return 'نشست شما پایان یافته است. برای مشاهده عناوین دوباره وارد شوید.'
    if (cause.status === 403) return 'دسترسی به عناوین و زیرعنوان‌های این رویداد مجاز نیست.'
    if (cause.status === 404) return 'عناوین این رویداد برای حساب شما در دسترس نیست.'
  }
  return 'خطا در دریافت عناوین و زیرعنوان‌ها'
}

function describeRfpFailure(cause: unknown): string {
  if (cause instanceof TypeError) return 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.'
  if (cause instanceof DashboardApiError) {
    if (cause.status === 401) return 'نشست شما پایان یافته است. برای دریافت RFP دوباره وارد شوید.'
    if (cause.status === 403 || cause.status === 404) return 'دسترسی به فایل RFP این زیرعنوان امکان‌پذیر نیست.'
  }
  return 'دریافت فایل RFP انجام نشد. دوباره تلاش کنید.'
}

export function EventsView({
  initialEventsList = [],
  state = 'default',
  isOwner = false,
  initialSelectedEventId,
}: EventsViewProps) {
  const router = useRouter()
  const [events] = useState<EventItem[]>(initialEventsList)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest')

  // The event page's own search and filter over its subtopics (the shared toolbar and filter template).

  // Find initial selected event if provided
  const foundInitial = useMemo(() => {
    if (!initialSelectedEventId) return null
    return (
      events.find(
        (e) =>
          e.rawId === initialSelectedEventId ||
          e.id === initialSelectedEventId ||
          e.id.replace(/^events-/, '') === initialSelectedEventId,
      ) ?? null
    )
  }, [events, initialSelectedEventId])

  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(foundInitial)
  const [registerOpen, setRegisterOpen] = useState(false)

  // Subtopics & categories state for selected event
  const [categories, setCategories] = useState<EventCategoryDto[]>([])
  const [subtopics, setSubtopics] = useState<EventSubtopicDto[]>([])
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  // Expanded categories map
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Selected subtopics for multi-application proposal submission

  // RFP state: key = subtopicId, value = { loading, error, version }
  const [rfpState, setRfpState] = useState<
    Record<string, { loading: boolean; error: string | null; version: RfpVersionDto | null; isOpen: boolean }>
  >({})


  // Fetch categories & subtopics whenever selectedEvent changes
  const effectiveEventId = selectedEvent?.rawId || selectedEvent?.id.replace(/^events-/, '') || ''
  // The event whose responses may still be applied; a reply for an event the user left is dropped.
  const activeEventId = useRef(effectiveEventId)
  activeEventId.current = effectiveEventId
  const hierarchyRequest = useRef(0)

  const loadEventHierarchy = async () => {
    if (!effectiveEventId) return
    const eventId = effectiveEventId
    const request = ++hierarchyRequest.current
    const isCurrent = () => request === hierarchyRequest.current && activeEventId.current === eventId
    setLoadingDetails(true)
    setDetailsError(null)
    setCategories([])
    setSubtopics([])
    try {
      const [catsRes, subsRes] = await Promise.all([
        getEventCategories(eventId),
        getEventSubtopics(eventId),
      ])
      if (!isCurrent()) return
      setCategories(catsRes.items ?? [])
      setSubtopics(subsRes.items ?? [])
      // Expand all categories by default so user immediately sees hierarchy
      const initialExpanded: Record<string, boolean> = {}
      for (const cat of catsRes.items ?? []) {
        initialExpanded[cat.id] = true
      }
      setExpandedCategories(initialExpanded)
    } catch (cause) {
      if (isCurrent()) setDetailsError(describeHierarchyFailure(cause))
    } finally {
      if (isCurrent()) setLoadingDetails(false)
    }
  }

  useEffect(() => {
    if (selectedEvent) {
      void loadEventHierarchy()
      setRfpState({})
    }
  }, [effectiveEventId])

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  const toggleRfpViewer = async (subtopic: EventSubtopicDto) => {
    const current = rfpState[subtopic.id]
    if (current?.isOpen) {
      setRfpState((prev) => ({ ...prev, [subtopic.id]: { ...current, isOpen: false } }))
      return
    }

    if (!subtopic.currentRfpVersionId) {
      setRfpState((prev) => ({
        ...prev,
        [subtopic.id]: { loading: false, error: null, version: null, isOpen: true },
      }))
      return
    }

    if (current?.version) {
      setRfpState((prev) => ({ ...prev, [subtopic.id]: { ...current, isOpen: true } }))
      return
    }

    setRfpState((prev) => ({
      ...prev,
      [subtopic.id]: { loading: true, error: null, version: null, isOpen: true },
    }))

    const eventId = effectiveEventId
    try {
      const res = await getSubtopicRfp(eventId, subtopic.id)
      if (activeEventId.current !== eventId) return
      setRfpState((prev) => ({
        ...prev,
        [subtopic.id]: { loading: false, error: null, version: res.version, isOpen: true },
      }))
    } catch (cause) {
      if (activeEventId.current !== eventId) return
      setRfpState((prev) => ({
        ...prev,
        [subtopic.id]: {
          loading: false,
          error: describeRfpFailure(cause),
          version: null,
          isOpen: true,
        },
      }))
    }
  }

  // «ثبت نام» opens the title and subtitle popup; confirming continues to the application for that subtitle.
  const handleRegister = (subtopicId: string) => {
    setRegisterOpen(false)
    router.push(
      `/dashboard/new-request?service=events&eventId=${encodeURIComponent(
        effectiveEventId,
      )}&subtopicId=${encodeURIComponent(subtopicId)}`,
    )
  }

  const filteredEvents = useMemo(() => {
    if (state === 'empty') return []
    return events.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.dates.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesFilter = filterType === 'all' || item.badgeType === filterType

      return matchesSearch && matchesFilter
    })
  }, [events, searchQuery, filterType, state])

  // The server lists the newest first; «قدیمی‌ترین» reverses it and the name order is Persian alphabetical.
  const sortedEvents = useMemo(() => {
    const list = [...filteredEvents]
    if (sortOrder === 'name') return list.sort((a, b) => a.title.localeCompare(b.title, 'fa'))
    const stamp = (item: EventItem) => item.startTimestamp
    if (list.every((item) => stamp(item) !== undefined)) {
      return list.sort((a, b) => (sortOrder === 'oldest' ? stamp(a)! - stamp(b)! : stamp(b)! - stamp(a)!))
    }
    return sortOrder === 'oldest' ? list.reverse() : list
  }, [filteredEvents, sortOrder])

  /** Where a card leads: the booth page of an exhibition, or the event's registration page. */
  const openEvent = (evt: EventItem) => {
    if (isOwner && evt.serviceKey === 'exhibitions') {
      const rawId = evt.id.replace(/^exhibitions-/, '')
      router.push(`/dashboard/exhibitions/${encodeURIComponent(rawId)}`)
    } else if (evt.serviceKey === 'events') {
      setSelectedEvent(evt)
      const eventIdParam = evt.rawId || evt.id.replace(/^events-/, '')
      router.push(`/dashboard/events?eventId=${encodeURIComponent(eventIdParam)}`)
    } else {
      // Booth requests replace the generic request form (S7, #245).
      const rawId = evt.rawId || evt.id.replace(/^exhibitions-/, '')
      router.push(`/dashboard/exhibitions/${encodeURIComponent(rawId)}`)
    }
  }
  const eventHasAction = (evt: EventItem) =>
    (isOwner && evt.serviceKey === 'exhibitions') || (!isOwner && Boolean(evt.hasActionButton))
  // Every card with a page behind it is clickable: the ones with an action, and an ended event (its page
  // is read-only). Only a card with no operational event behind it has nowhere to go and stays inert.
  const eventHasTarget = (evt: EventItem) => eventHasAction(evt) || (!isOwner && evt.badgeType === 'ended')

  const isLoading = state === 'loading'
  const isEmpty = !isLoading && filteredEvents.length === 0

  // -------------------------------------------------------------
  // VIEW: EVENT DISCOVERY & SUBTOPICS SELECTION (Figma node 49:7968)
  // -------------------------------------------------------------
  if (selectedEvent) {
    const isEnded = selectedEvent.badgeType === 'ended'

    return (
      <div className="flex min-h-0 w-full flex-1 flex-col text-start" dir="rtl">
        {/* Header: register button at the end, breadcrumb at the start (Figma 31981:77643) */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="مسیر راهنما" className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="link-gray"
              size="clear"
              onClick={() => {
                setSelectedEvent(null)
                router.push('/dashboard/events')
              }}
              aria-label="بازگشت به رویدادها و نمایشگاه‌ها"
            >
              <Typography as="span" variant="16/regular" color="neutral-500">
                رویدادها و نمایشگاه‌ها
              </Typography>
            </Button>
            <Typography as="span" variant="16/regular" color="neutral-500">
              /
            </Typography>
            <Typography as="h1" variant="24/bold" color="neutral-700" className="min-w-0 truncate">
              {selectedEvent.title}
            </Typography>
          </nav>

          <Button
            size="40"
            type="button"
            className="min-w-[120px]"
            onClick={() => setRegisterOpen(true)}
            disabled={isEnded || loadingDetails || subtopics.length === 0}
          >
            <Typography as="span" variant="16/semibold" className="text-inherit">
              {isEnded ? 'مهلت ثبت‌نام پایان یافته' : 'ثبت نام'}
            </Typography>
          </Button>
        </div>

        {/* The route keeps the page fixed (list routes scroll their own region), so the details scroll here. */}
        <ScrollArea className="min-h-0 flex-1">
        {/* Slot 1: event summary card (Figma 31981:77598) */}
        <section className="mt-5 flex w-full flex-col gap-6 rounded-[16px] border border-neutral-200 bg-background p-4">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            {/* The image comes first, so it sits at the start (right) of the RTL row */}
            <div className="relative size-[160px] shrink-0 self-center overflow-hidden rounded-[8px] bg-neutral-100 sm:size-[200px]">
              {selectedEvent.imageSrc ? (
                <Image
                  src={selectedEvent.imageSrc}
                  alt={selectedEvent.title}
                  fill
                  className="object-cover"
                  sizes="200px"
                />
              ) : (
                <Typography
                  variant="14/regular"
                  className="flex h-full items-center justify-center text-neutral-400"
                >
                  تصویری ثبت نشده است
                </Typography>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-8">
              <div className="flex flex-col items-start gap-4">
                <EventStatusTag type={selectedEvent.badgeType}>{selectedEvent.badgeText}</EventStatusTag>
                <Typography as="h2" variant="20/bold" color="neutral-700">
                  {selectedEvent.title}
                </Typography>
              </div>
              <EventMeta dates={selectedEvent.dates} location={selectedEvent.location} />
            </div>
          </div>

          {selectedEvent.description && (
            <Typography as="p" variant="16/regular" color="neutral-500">
              {selectedEvent.description}
            </Typography>
          )}
        </section>

        {/* Slot 2: titles and subtitles tree (Figma 31981:77613) */}
        <section className="mt-5 flex w-full flex-col gap-6 rounded-[16px] border border-neutral-200 bg-background p-4">
          <Typography as="h2" variant="20/extrabold" color="neutral-800">
            عنوان ها و زیر عنوان های رویداد
          </Typography>

          {/* Hierarchy Content */}
          {loadingDetails ? (
            <TreeSkeleton />
          ) : detailsError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <p className="font-sans text-[14px] text-error-500">{detailsError}</p>
              <Button variant="outline-gray" size="32"
                type="button"
                onClick={loadEventHierarchy}
              >
                <RotateCcw className="size-4" />
                <span>تلاش دوباره</span>
              </Button>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center font-sans text-[14px] text-neutral-500">
              هیچ عنوان یا زیرعنوانی برای این رویداد تعریف نشده است.
            </div>
          ) : (
            <div className="flex flex-col">
              {categories.map((cat) => {
                const catSubtopics = subtopics.filter((sub) => sub.categoryId === cat.id)
                const isExpanded = expandedCategories[cat.id] ?? false

                return (
                  <div key={cat.id} className="flex flex-col">
                    <TreeRow
                      title={cat.title}
                      strong
                      expanded={isExpanded}
                      onToggle={() => toggleCategory(cat.id)}
                    />

                    {isExpanded && (
                      <div className="ms-2 flex flex-col border-s border-neutral-200 ps-4">
                        {catSubtopics.length === 0 ? (
                          <Typography as="p" variant="16/regular" color="neutral-500" className="px-2 py-3">
                            زیرعنوانی در این دسته موجود نیست.
                          </Typography>
                        ) : (
                          catSubtopics.map((sub) => {
                            const rfp = rfpState[sub.id]

                            return (
                              <div key={sub.id} className="flex flex-col">
                                <TreeRow
                                  title={sub.title}
                                  expanded={Boolean(rfp?.isOpen)}
                                  onToggle={() => toggleRfpViewer(sub)}
                                />

                                {/* RFP details and files: the «توضیحات» level of the tree */}
                                {rfp?.isOpen && (
                                  <div className="ms-2 flex flex-col gap-2 border-s border-neutral-200 ps-4 py-2">
                                    {rfp.loading ? (
                                      <div className="flex items-center gap-2 px-2">
                                        <Skeleton className="h-4 w-32 bg-neutral-200" />
                                        <Typography as="span" variant="14/regular" color="neutral-500">
                                          در حال دریافت فایل‌های RFP...
                                        </Typography>
                                      </div>
                                    ) : rfp.error ? (
                                      <Typography as="p" variant="14/regular" color="error" className="px-2">
                                        {rfp.error}
                                      </Typography>
                                    ) : !rfp.version || rfp.version.files.length === 0 ? (
                                      <Typography as="p" variant="16/regular" color="neutral-500" className="px-2">
                                        فایل RFP بارگذاری نشده است
                                      </Typography>
                                    ) : (
                                      <>
                                        {rfp.version.reason && (
                                          <Typography as="p" variant="16/regular" color="neutral-500" className="px-2">
                                            {rfp.version.reason}
                                          </Typography>
                                        )}
                                        {rfp.version.files.map((file) => (
                                          <div
                                            key={file.id}
                                            className="flex items-center justify-between gap-3 rounded-[8px] border border-neutral-200 bg-background p-2"
                                          >
                                            <div className="flex min-w-0 items-center gap-2">
                                              <FileText className="size-4 shrink-0 text-neutral-500" />
                                              <Typography as="span" variant="14/regular" color="neutral-700" className="truncate">
                                                {file.filename}
                                              </Typography>
                                              <Typography as="span" variant="14/regular" color="neutral-500">
                                                ({formatFileSize(file.sizeBytes)})
                                              </Typography>
                                            </div>
                                            <a
                                              href={getRfpDownloadUrl(
                                                effectiveEventId,
                                                sub.id,
                                                rfp.version!.id,
                                                file.id,
                                              )}
                                              download={file.filename}
                                              className="flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-brand-600 hover:bg-brand-50"
                                            >
                                              <Download className="size-3.5" />
                                              <Typography as="span" variant="14/regular" className="text-inherit">
                                                دانلود
                                              </Typography>
                                            </a>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
        </ScrollArea>

        {registerOpen && (
          <RegisterDialog
            onClose={() => setRegisterOpen(false)}
            categories={categories}
            subtopics={subtopics}
            onConfirm={handleRegister}
          />
        )}
      </div>
    )
  }

  // -------------------------------------------------------------
  // VIEW: EVENTS LIST VIEW (Figma node 56:14018)
  // -------------------------------------------------------------
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col text-start" dir="rtl">
      {/* Page Title - Figma node 56:13203 */}
      <Typography as="h1" variant="24/bold" color="neutral-700">
        رویدادها و نمایشگاه‌ها
      </Typography>

      {/* Action Bar - Figma Frame 1 (56:13205): search and the filter template on the right */}
      <ListToolbar
        className="mt-5"
        search={
          <SearchField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="درخواست خود را جست و جو کنید"
            aria-label="جستجوی رویدادها"
          />
        }
        filter={
          <ListFilterButton
            label="فیلتر رویدادها"
            groups={[
              {
                key: 'state',
                label: 'وضعیت رویداد',
                value: filterType === 'all' ? undefined : filterType,
                options: [
                  { value: '', label: 'همه رویدادها' },
                  { value: 'active', label: 'در حال ثبت‌نام' },
                  { value: 'ended', label: 'تمام شده' },
                ],
              },
              {
                key: 'sort',
                label: 'مرتب سازی بر اساس',
                kind: 'radio',
                value: sortOrder === 'newest' ? undefined : sortOrder,
                options: [
                  { value: '', label: 'جدیدترین رویداد ها' },
                  { value: 'oldest', label: 'قدیمی ترین رویداد ها' },
                  { value: 'name', label: 'نام رویداد ( الف - ی)' },
                ],
              },
            ]}
            onChange={(key, value) => {
              if (key === 'sort') setSortOrder((value as 'oldest' | 'name' | undefined) ?? 'newest')
              else setFilterType(value ?? 'all')
            }}
          />
        }
      />

      {/* Main Events Card - Figma Frame 6 (56:13208) */}
      <section className="relative mt-[16px] flex min-h-0 w-full flex-1 flex-col rounded-[16px] border border-neutral-200 bg-background p-[16px]">
        {isLoading ? (
          <EventsSkeleton />
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            {!isEmpty && (
              <div className="flex flex-col gap-4">
                {sortedEvents.map((evt) => (
                  <article
                    key={evt.id}
                    className={`flex flex-col-reverse items-start justify-end gap-4 rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 sm:h-[200px] sm:flex-row sm:items-center ${
                      eventHasTarget(evt) ? 'cursor-pointer hover:bg-neutral-50' : ''
                    }`}
                    {...rowActivationProps(eventHasTarget(evt) ? (newTab) => {
                      if (newTab) return
                      openEvent(evt)
                    } : undefined)}
                  >
                    <div className="relative size-[200px] shrink-0 overflow-hidden rounded-[8px] bg-slate-100">
                      {evt.imageSrc ? (
                        <Image
                          src={evt.imageSrc}
                          alt={evt.title}
                          fill
                          className="object-cover"
                          sizes="200px"
                        />
                      ) : (
                        <Typography
                          variant="14/regular"
                          className="flex h-full items-center justify-center text-neutral-400"
                        >
                          تصویری ثبت نشده است
                        </Typography>
                      )}
                    </div>
                    {/* Content column (Figma Frame 46, 176px tall): tag and title, then date, place and the action */}
                    <div className="flex w-full flex-1 flex-col justify-between gap-8 sm:h-[176px]">
                      {/* Top Section: Tag and Title (Frame 41), 16px apart */}
                      <div className="flex flex-col items-start gap-4">
                        <EventStatusTag type={evt.badgeType}>{evt.badgeText}</EventStatusTag>
                        <Typography as="h2" variant="20/bold" color="neutral-700">
                          {evt.title}
                        </Typography>
                      </div>

                      {/* Bottom Section: date and place, and the action button on the far side (Frame 91) */}
                      {eventHasAction(evt) ? (
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          <EventMeta dates={evt.dates} location={evt.location} />

                          {/* The tick icon comes first in the DOM, so in RTL it sits on the right of the label (Figma 56:14063). */}
                          <Button size="40" type="button" onClick={() => openEvent(evt)}>
                            <TickSquareIcon className="size-[24px] shrink-0 stroke-white" />
                            <Typography as="span" variant="16/semibold" className="text-inherit">
                              {isOwner && evt.serviceKey === 'exhibitions'
                                ? 'مدیریت غرفه‌ها'
                                : evt.serviceKey === 'exhibitions'
                                  ? 'رزرو غرفه'
                                  : evt.actionButtonText || 'ثبت درخواست'}
                            </Typography>
                          </Button>
                        </div>
                      ) : (
                        <EventMeta dates={evt.dates} location={evt.location} />
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Empty State */}
            {isEmpty && <EventsEmptyState noMatch={state !== 'empty' && events.length > 0} />}
          </ScrollArea>
        )}
      </section>
    </div>
  )
}
