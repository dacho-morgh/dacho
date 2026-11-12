'use client'

import { SearchField } from '@/components/dashboard/search-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertCircle,
  ChevronDown,
  Download,
  FileText,
  Folder,
  Layers,
  RotateCcw,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CalendarBulkIcon,
  EmptyInboxIllustration,
  LocationBulkIcon,
  TickSquareIcon,
} from '@/components/icons'
import { ParticipationEligibilityPanel } from '@/components/dashboard/participation-eligibility-panel'
import { Skeleton } from '@/components/ui/skeleton'
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
import type { Eligibility } from '@/utilities/participation-eligibility'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
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
  initialSubtopicIds?: string[]
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

function EventStatusTag({ type, children }: { type: EventItem['badgeType']; children: ReactNode }) {
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
function EventMeta({ dates, location }: { dates: string; location: string }) {
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

// Quick selection modal matching Figma Frame 120 (node 31994:87443)
function QuickSelectModal({
  isOpen,
  onClose,
  categories,
  subtopics,
  onSelectSubtopic,
}: {
  isOpen: boolean
  onClose: () => void
  categories: EventCategoryDto[]
  subtopics: EventSubtopicDto[]
  onSelectSubtopic: (subtopicId: string) => void
}) {
  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id ?? '')
  const availableSubtopics = useMemo(
    () => subtopics.filter((sub) => sub.categoryId === selectedCatId),
    [subtopics, selectedCatId],
  )
  const [selectedSubId, setSelectedSubId] = useState<string>(availableSubtopics[0]?.id ?? '')

  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0]!.id)
    }
  }, [categories, selectedCatId])

  useEffect(() => {
    setSelectedSubId(availableSubtopics[0]?.id ?? '')
  }, [availableSubtopics])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (selectedSubId) {
      onSelectSubtopic(selectedSubId)
    }
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <DialogTitle id="quick-select-title" className="text-[18px] leading-[28px]">
              انتخاب عنوان
            </DialogTitle>
            <p className="mt-1 font-sans text-[13px] leading-[20px] font-normal text-neutral-500">
              برای مشاهده فرم عنوان و زیر عنوان مورد نظر خود را انتخاب کنید.
            </p>
          </div>
          <Button variant="text-gray" size="icon-36"
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="modal-cat-select" className="font-sans text-[14px] leading-[24px] font-semibold text-neutral-700">
              عنوان
            </label>
            <DashboardSelect
              id="modal-cat-select"
              label="عنوان"
              placeholder="عنوان را جستجو یا انتخاب کنید"
              options={categories.map((c) => ({ value: c.id, label: c.title }))}
              value={selectedCatId}
              onChange={setSelectedCatId}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="modal-sub-select" className="font-sans text-[14px] leading-[24px] font-semibold text-neutral-700">
              زیر عنوان
            </label>
            <DashboardSelect
              id="modal-sub-select"
              label="زیر عنوان"
              placeholder={availableSubtopics.length === 0 ? 'زیرعنوانی یافت نشد' : 'زیرعنوان را جستجو یا انتخاب کنید'}
              disabled={availableSubtopics.length === 0}
              options={availableSubtopics.map((s) => ({ value: s.id, label: s.title }))}
              value={selectedSubId}
              onChange={setSelectedSubId}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-2 flex items-center justify-end gap-3 pt-2">
          <Button variant="outline-gray" size="40"
            type="button"
            onClick={onClose}
          >
            لغو
          </Button>
          <Button size="40"
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSubId}
          >
            تایید
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A 404 here means the event is not open to this account, not that the list is empty. */
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

function toPersianDigits(val: number | string): string {
  return String(val).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d)
}

export function EventsView({
  initialEventsList = [],
  state = 'default',
  isOwner = false,
  initialSelectedEventId,
  initialSubtopicIds,
}: EventsViewProps) {
  const router = useRouter()
  const [events] = useState<EventItem[]>(initialEventsList)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest')

  // The event page's own search and filter over its subtopics (the shared toolbar and filter template).
  const [subtopicSearch, setSubtopicSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selectionFilter, setSelectionFilter] = useState<'' | 'selected' | 'unselected'>('')

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

  // Subtopics & categories state for selected event
  const [categories, setCategories] = useState<EventCategoryDto[]>([])
  const [subtopics, setSubtopics] = useState<EventSubtopicDto[]>([])
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  // Expanded categories map
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Selected subtopics for multi-application proposal submission
  const [selectedSubtopicIds, setSelectedSubtopicIds] = useState<Set<string>>(new Set())

  // RFP state: key = subtopicId, value = { loading, error, version }
  const [rfpState, setRfpState] = useState<
    Record<string, { loading: boolean; error: string | null; version: RfpVersionDto | null; isOpen: boolean }>
  >({})

  // Quick Select modal
  const [quickModalOpen, setQuickModalOpen] = useState(false)

  // Company verification read from the server; registration stays off until it is approved.
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  // Subtopics to restore once, for the event the representative returned to.
  const pendingSubtopicIds = useRef<{ eventId: string; ids: string[] } | null>(
    initialSelectedEventId && initialSubtopicIds?.length
      ? { eventId: initialSelectedEventId, ids: initialSubtopicIds }
      : null,
  )

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
      const restore = pendingSubtopicIds.current
      if (restore && restore.eventId === eventId) {
        pendingSubtopicIds.current = null
        const known = new Set((subsRes.items ?? []).map((sub) => sub.id))
        // Only restore subtopics that still exist for this event.
        setSelectedSubtopicIds(new Set(restore.ids.filter((id) => known.has(id))))
      }
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
      setSelectedSubtopicIds(new Set())
      setRfpState({})
    }
  }, [effectiveEventId])

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }

  const toggleSubtopicSelect = (subtopicId: string) => {
    setSelectedSubtopicIds((prev) => {
      const next = new Set(prev)
      if (next.has(subtopicId)) {
        next.delete(subtopicId)
      } else {
        next.add(subtopicId)
      }
      return next
    })
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

  const handleRegisterSelected = () => {
    if (selectedSubtopicIds.size === 0 || !eligibility?.canParticipate) return
    const ids = Array.from(selectedSubtopicIds).join(',')
    router.push(
      `/dashboard/new-request?service=events&eventId=${encodeURIComponent(
        effectiveEventId,
      )}&subtopicId=${encodeURIComponent(ids)}`,
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

  // Subtopics that pass the event page's search and filters; a category with none left is hidden.
  const subtopicQuery = subtopicSearch.trim()
  const subtopicFiltered = Boolean(subtopicQuery || categoryFilter || selectionFilter)
  const subtopicMatches = (sub: EventSubtopicDto) =>
    (!subtopicQuery || sub.title.includes(subtopicQuery)) &&
    (!categoryFilter || sub.categoryId === categoryFilter) &&
    (!selectionFilter || (selectionFilter === 'selected') === selectedSubtopicIds.has(sub.id))

  const isLoading = state === 'loading'
  const isEmpty = !isLoading && filteredEvents.length === 0

  // -------------------------------------------------------------
  // VIEW: EVENT DISCOVERY & SUBTOPICS SELECTION (Figma node 49:7968)
  // -------------------------------------------------------------
  if (selectedEvent) {
    const isEnded = selectedEvent.badgeType === 'ended'
    const selectedCount = selectedSubtopicIds.size

    return (
      <div className="flex min-h-0 w-full flex-1 flex-col text-start" dir="rtl">
        {/* Breadcrumbs and Top Action Header - Figma Frame 146 (node 31967:73802) */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2">
          {/* Breadcrumb path */}
          <nav aria-label="مسیر راهنما" className="flex items-center gap-2 font-sans text-[14px] text-neutral-600">
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
              <Typography as="span" variant="14/regular" className="text-inherit">
                رویدادها و نمایشگاه‌ها
              </Typography>
            </Button>
            <span className="text-neutral-400">/</span>
            <span className="font-bold text-neutral-800 truncate max-w-[280px] sm:max-w-md">
              {selectedEvent.title}
            </span>
          </nav>

          {/* Top Registration Action Button */}
          <div className="flex items-center gap-3">
            <Button size="40"
              type="button"
              onClick={handleRegisterSelected}
              disabled={isEnded || selectedCount === 0 || !eligibility?.canParticipate}
            >
              <TickSquareIcon className="size-6 shrink-0 stroke-white" />
              <Typography as="span" variant="16/semibold" className="text-inherit">
                {isEnded
                  ? 'مهلت ثبت‌نام پایان یافته'
                  : selectedCount > 0
                    ? `ثبت درخواست (${toPersianDigits(selectedCount)} زیرعنوان)`
                    : 'ثبت‌نام در رویداد'}
              </Typography>
            </Button>
          </div>
        </div>

        {/* The route keeps the page fixed (list routes scroll their own region), so the details scroll here. */}
        <ScrollArea className="min-h-0 flex-1">
        {/* Slot 1: Event Summary Banner Card - Figma Frame 61 / Frame 46 / Frame 60 */}
        <section className="relative mt-4 flex w-full flex-col gap-4 rounded-[16px] border border-neutral-200 bg-background p-4 sm:p-6">
          <div className="flex flex-col-reverse items-start justify-end gap-5 sm:flex-row">
            {/* Left Content column */}
            <div className="flex w-full flex-1 flex-col justify-between gap-4 py-1">
              {/* Badge + Title */}
              <div className="flex flex-col items-start gap-3">
                <EventStatusTag type={selectedEvent.badgeType}>{selectedEvent.badgeText}</EventStatusTag>
                <Typography as="h1" variant="20/bold" color="neutral-700">
                  {selectedEvent.title}
                </Typography>
              </div>

              {/* Dates & Location */}
              <div className="pt-2">
                <EventMeta dates={selectedEvent.dates} location={selectedEvent.location} />
              </div>
            </div>

            {/* Event Thumbnail on Right - Figma Frame 60 (200px x 200px) */}
            <div className="relative size-[160px] shrink-0 overflow-hidden rounded-[10px] bg-slate-100 sm:size-[200px]">
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
          </div>

          {/* Event description summary */}
          {selectedEvent.description && (
            <p className="border-t border-neutral-100 pt-4 font-sans text-[14px] leading-[26px] text-neutral-600">
              {selectedEvent.description}
            </p>
          )}
        </section>

        {/* Company verification state, missing profile sections and return destination (FE06) */}
        {!isOwner && !isEnded ? (
          <div className="mt-4">
            <ParticipationEligibilityPanel
              target={{
                kind: 'event',
                eventId: effectiveEventId,
                subtopicIds: Array.from(selectedSubtopicIds),
              }}
              onEligibilityChange={setEligibility}
            />
          </div>
        ) : null}

        {/* Slot 2: Categories and Subtopics Tree Card - Figma Slot / Frame 156 */}
        <section className="relative mt-4 flex w-full flex-col gap-5 rounded-[16px] border border-neutral-200 bg-background p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-2">
              <Layers className="size-6 text-brand-500" />
              <h2 className="font-sans text-[18px] leading-[32px] font-bold text-neutral-700">
                عنوان ها و زیر عنوان های رویداد
              </h2>
            </div>

            {/* Toolbar: Counter and Quick Select */}
            <div className="flex items-center gap-3">
              {selectedCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 font-sans text-[13px] font-medium text-brand-700">
                  {toPersianDigits(selectedCount)} زیرعنوان انتخاب شده
                </span>
              )}
              {categories.length > 0 && (
                <Button variant="outline-gray" size="36"
                  type="button"
                  onClick={() => setQuickModalOpen(true)}
                >
                  <span>انتخاب سریع عنوان</span>
                </Button>
              )}
            </div>
          </div>

          {/* Multiple Applications Notice Banner */}
          <div
            role="note"
            className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-blue-900"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-blue-600" />
            <div className="text-[13px] leading-[22px]">
              <p className="font-semibold">
                برای هر زیرعنوان انتخاب‌شده، یک پرونده و کد رهگیری جداگانه تشکیل خواهد شد.
              </p>
              <p className="text-blue-800">
                شما می‌توانید چندین زیرعنوان مرتبط را همزمان انتخاب کنید؛ پس از تکمیل، ارزیابی هر پروپوزال به‌صورت کاملاً مستقل انجام می‌شود.
              </p>
            </div>
          </div>

          {/* Search and the shared filter template over the subtopics (design QA #276) */}
          {!loadingDetails && !detailsError && categories.length > 0 && (
            <ListToolbar
              search={
                <SearchField
                  value={subtopicSearch}
                  onChange={(event) => setSubtopicSearch(event.target.value)}
                  placeholder="جستجوی زیرعنوان"
                  aria-label="جستجوی زیرعنوان‌ها"
                  maxLength={100}
                />
              }
              filter={
                <ListFilterButton
                  label="فیلتر زیرعنوان‌ها"
                  groups={[
                    ...(categories.length > 1
                      ? [
                          {
                            key: 'category',
                            label: 'عنوان',
                            value: categoryFilter,
                            options: [
                              { value: '', label: 'همه عنوان‌ها' },
                              ...categories.map((cat) => ({ value: cat.id, label: cat.title })),
                            ],
                          },
                        ]
                      : []),
                    {
                      key: 'selection',
                      label: 'وضعیت انتخاب',
                      value: selectionFilter,
                      options: [
                        { value: '', label: 'همه زیرعنوان‌ها' },
                        { value: 'selected', label: 'انتخاب‌شده' },
                        { value: 'unselected', label: 'انتخاب‌نشده' },
                      ],
                    },
                  ]}
                  onChange={(key, value) => {
                    if (key === 'category') setCategoryFilter(value ?? '')
                    else setSelectionFilter((value as 'selected' | 'unselected' | undefined) ?? '')
                  }}
                />
              }
            />
          )}

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
            <div className="flex flex-col gap-3">
              {subtopicFiltered &&
                !categories.some((cat) => subtopics.some((sub) => sub.categoryId === cat.id && subtopicMatches(sub))) && (
                  <div role="status" className="py-8 text-center font-sans text-[14px] text-neutral-500">
                    زیرعنوانی با این جستجو یا فیلتر پیدا نشد.
                  </div>
                )}
              {categories.map((cat) => {
                const catSubtopics = subtopics.filter((sub) => sub.categoryId === cat.id && subtopicMatches(sub))
                // A category with nothing left under the search or filter is not worth showing.
                if (subtopicFiltered && catSubtopics.length === 0) return null
                const isExpanded = subtopicFiltered || (expandedCategories[cat.id] ?? false)

                return (
                  <div
                    key={cat.id}
                    className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/50"
                  >
                    {/* Category Accordion Header */}
                    <Button
                      type="button"
                      variant="row"
                      size="clear"
                      onClick={() => toggleCategory(cat.id)}
                      className="p-3.5"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-3">
                        <Folder className="size-5 text-brand-600" />
                        <span className="font-sans text-[16px] leading-[28px] font-semibold text-neutral-800">
                          {cat.title}
                        </span>
                        <span className="rounded-full bg-neutral-200/70 px-2 py-0.5 font-sans text-[12px] font-normal text-neutral-600">
                          {catSubtopics.length} زیرعنوان
                        </span>
                      </div>
                      <ChevronDown
                        className={`size-5 text-neutral-500 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </Button>

                    {/* Subtopics List */}
                    {isExpanded && (
                      <div className="flex flex-col divide-y divide-neutral-100 bg-background">
                        {catSubtopics.length === 0 ? (
                          <div className="p-4 text-center text-[13px] text-neutral-400">
                            زیرعنوانی در این دسته موجود نیست.
                          </div>
                        ) : (
                          catSubtopics.map((sub) => {
                            const isChecked = selectedSubtopicIds.has(sub.id)
                            const rfp = rfpState[sub.id]

                            return (
                              <div key={sub.id} className="flex flex-col gap-2.5 p-3.5 sm:p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  {/* Right side: Checkbox + Subtopic title + Employer tag */}
                                  <div className="flex items-start gap-3 flex-1 min-w-[260px]">
                                    <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleSubtopicSelect(sub.id)}
                                        aria-label={`انتخاب زیرعنوان ${sub.title}`} />
                                      <span className="sr-only">انتخاب {sub.title}</span>
                                    </label>

                                    <div className="flex flex-col gap-1">
                                      <span className="font-sans text-[15px] leading-[26px] font-medium text-neutral-800">
                                        {sub.title}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Left side: RFP Actions */}
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline-gray" size="32"
                                      type="button"
                                      onClick={() => toggleRfpViewer(sub)}
                                      aria-label={`دریافت فایل RFP برای ${sub.title}`}
                                    >
                                      <FileText className="size-4" />
                                      <span>مشاهده و دانلود RFP</span>
                                    </Button>
                                  </div>
                                </div>

                                {/* Collapsible RFP Details & Files Area */}
                                {rfp?.isOpen && (
                                  <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50/70 p-3">
                                    {rfp.loading ? (
                                      <div className="flex items-center gap-2 text-[13px] text-neutral-500">
                                        <Skeleton className="h-4 w-32 bg-neutral-200" />
                                        <span>در حال دریافت فایل‌های RFP...</span>
                                      </div>
                                    ) : rfp.error ? (
                                      <div className="text-[13px] text-error-500">{rfp.error}</div>
                                    ) : !rfp.version || rfp.version.files.length === 0 ? (
                                      <div className="text-[13px] text-neutral-500">
                                        فایل RFP بارگذاری نشده است
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-2">
                                        {rfp.version.reason && (
                                          <p className="text-[12px] text-neutral-500">
                                            توضیحات نسخه: {rfp.version.reason}
                                          </p>
                                        )}
                                        <div className="flex flex-col gap-1.5">
                                          {rfp.version.files.map((file) => (
                                            <div
                                              key={file.id}
                                              className="flex items-center justify-between rounded-md border border-neutral-200 bg-background p-2 text-[13px]"
                                            >
                                              <div className="flex items-center gap-2 truncate">
                                                <FileText className="size-4 shrink-0 text-brand-600" />
                                                <span className="truncate font-medium text-neutral-800">
                                                  {file.filename}
                                                </span>
                                                <span className="text-[11px] text-neutral-400">
                                                  ({formatFileSize(file.sizeBytes)})
                                                </span>
                                              </div>
                                              <a
                                                href={getRfpDownloadUrl(
                                                  effectiveEventId,
                                                  sub.id,
                                                  rfp.version!.id,
                                                  file.id,
                                                )}
                                                download={file.filename}
                                                className="flex items-center gap-1 rounded px-2.5 py-1 text-[12px] font-semibold text-brand-600 hover:bg-brand-50"
                                              >
                                                <Download className="size-3.5" />
                                                <span>دانلود</span>
                                              </a>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
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

        {/* Quick Select Modal Dialog */}
        <QuickSelectModal
          isOpen={quickModalOpen}
          onClose={() => setQuickModalOpen(false)}
          categories={categories}
          subtopics={subtopics}
          onSelectSubtopic={(subId) => {
            setSelectedSubtopicIds((prev) => new Set([...prev, subId]))
            const targetSub = subtopics.find((s) => s.id === subId)
            if (targetSub) {
              setExpandedCategories((prev) => ({ ...prev, [targetSub.categoryId]: true }))
            }
          }}
        />
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
