'use client'

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  Download,
  FileText,
  Folder,
  Layers,
  RotateCcw,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  CalendarBulkIcon,
  EmptyInboxIllustration,
  FilterIcon,
  LocationBulkIcon,
  SearchNormalIcon,
  TickSquareIcon,
} from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import {
  formatFileSize,
  getEventCategories,
  getEventSubtopics,
  getRfpDownloadUrl,
  getSubtopicRfp,
  type EventCategoryDto,
  type EventSubtopicDto,
  type RfpVersionDto,
} from '@/utilities/dashboard-api'

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
}

// Skeleton state matching Figma node 56:13600
function EventsSkeleton() {
  return (
    <div role="status" aria-label="در حال بارگذاری رویدادها" className="flex flex-col gap-[32px]">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col-reverse items-start justify-end gap-[16px] sm:h-[200px] sm:flex-row"
        >
          {/* Content skeleton on left */}
          <div className="flex h-[168px] w-full flex-1 flex-col justify-between py-1">
            <div>
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-[#f5f5f5]" />
              <Skeleton className="mt-[16px] h-[32px] w-[400px] max-w-full rounded-[8px] bg-[#f5f5f5]" />
            </div>
            <div className="space-y-[16px]">
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-[#f5f5f5]" />
              <Skeleton className="h-[24px] w-[200px] rounded-[8px] bg-[#f5f5f5]" />
            </div>
          </div>

          {/* Square thumbnail skeleton on right */}
          <Skeleton className="size-[200px] shrink-0 rounded-[8px] bg-[#f5f5f5]" />
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
            <Skeleton className="h-6 w-48 rounded-md bg-[#f5f5f5]" />
            <Skeleton className="h-6 w-20 rounded-md bg-[#f5f5f5]" />
          </div>
          <div className="mr-6 flex flex-col gap-2 pt-2">
            <Skeleton className="h-5 w-64 rounded-md bg-[#f5f5f5]" />
            <Skeleton className="h-5 w-56 rounded-md bg-[#f5f5f5]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Empty state matching Figma node 56:13860 / 56:14004
function EventsEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-28 text-center">
      <div className="flex flex-col items-center gap-[4px]">
        <div className="flex size-[80px] items-center justify-center">
          <EmptyInboxIllustration className="size-[80px]" />
        </div>
        <p className="mt-1 font-sans text-[14px] leading-[24px] font-semibold text-[#525252]">
          رویداد و نمایشگاهی در سیستم موجود نیست
        </p>
        <p className="font-sans text-[12px] leading-[20px] font-normal text-[#737373]">
          در صورت ایجاد رویداد یا نمایشگاه به شما اطلاع رسانی خواهیم کرد
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-select-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      dir="rtl"
    >
      <div className="relative flex w-full max-w-md flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 id="quick-select-title" className="font-sans text-[18px] leading-[28px] font-bold text-neutral-800">
              انتخاب عنوان
            </h3>
            <p className="mt-1 font-sans text-[13px] leading-[20px] font-normal text-neutral-500">
              برای مشاهده فرم عنوان و زیر عنوان مورد نظر خود را انتخاب کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Dropdowns */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="modal-cat-select" className="font-sans text-[14px] leading-[24px] font-semibold text-neutral-700">
              عنوان
            </label>
            <select
              id="modal-cat-select"
              aria-label="عنوان"
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 font-sans text-[14px] text-neutral-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="modal-sub-select" className="font-sans text-[14px] leading-[24px] font-semibold text-neutral-700">
              زیر عنوان
            </label>
            <select
              id="modal-sub-select"
              aria-label="زیر عنوان"
              value={selectedSubId}
              disabled={availableSubtopics.length === 0}
              onChange={(e) => setSelectedSubId(e.target.value)}
              className="h-11 w-full rounded-lg border border-neutral-200 bg-white px-3 font-sans text-[14px] text-neutral-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-neutral-50 disabled:text-neutral-400"
            >
              {availableSubtopics.length === 0 ? (
                <option value="">زیرعنوانی یافت نشد</option>
              ) : (
                availableSubtopics.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-2 flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-lg border border-neutral-300 px-4 font-sans text-[14px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            لغو
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSubId}
            className="flex h-10 items-center justify-center rounded-lg bg-brand-500 px-5 font-sans text-[14px] font-semibold text-white shadow-xs hover:bg-brand-600 disabled:opacity-50"
          >
            تایید
          </button>
        </div>
      </div>
    </div>
  )
}

function toPersianDigits(val: number | string): string {
  return String(val).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d)
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

  // Fetch categories & subtopics whenever selectedEvent changes
  const effectiveEventId = selectedEvent?.rawId || selectedEvent?.id.replace(/^events-/, '') || ''

  const loadEventHierarchy = async () => {
    if (!effectiveEventId) return
    setLoadingDetails(true)
    setDetailsError(null)
    try {
      const [catsRes, subsRes] = await Promise.all([
        getEventCategories(effectiveEventId),
        getEventSubtopics(effectiveEventId),
      ])
      setCategories(catsRes.items ?? [])
      setSubtopics(subsRes.items ?? [])
      // Expand all categories by default so user immediately sees hierarchy
      const initialExpanded: Record<string, boolean> = {}
      for (const cat of catsRes.items ?? []) {
        initialExpanded[cat.id] = true
      }
      setExpandedCategories(initialExpanded)
    } catch {
      setDetailsError('خطا در دریافت عناوین و زیرعنوان‌ها')
    } finally {
      setLoadingDetails(false)
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

    try {
      const res = await getSubtopicRfp(effectiveEventId, subtopic.id)
      setRfpState((prev) => ({
        ...prev,
        [subtopic.id]: { loading: false, error: null, version: res.version, isOpen: true },
      }))
    } catch {
      setRfpState((prev) => ({
        ...prev,
        [subtopic.id]: {
          loading: false,
          error: 'دسترسی به فایل RFP امکان‌پذیر نیست یا فایلی وجود ندارد.',
          version: null,
          isOpen: true,
        },
      }))
    }
  }

  const handleRegisterSelected = () => {
    if (selectedSubtopicIds.size === 0) return
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

  const isLoading = state === 'loading'
  const isEmpty = !isLoading && filteredEvents.length === 0

  // -------------------------------------------------------------
  // VIEW: EVENT DISCOVERY & SUBTOPICS SELECTION (Figma node 49:7968)
  // -------------------------------------------------------------
  if (selectedEvent) {
    const isEnded = selectedEvent.badgeType === 'ended'
    const selectedCount = selectedSubtopicIds.size

    return (
      <div className="flex w-full flex-1 flex-col text-right" dir="rtl">
        {/* Breadcrumbs and Top Action Header - Figma Frame 146 (node 31967:73802) */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2">
          {/* Breadcrumb path */}
          <nav aria-label="مسیر راهنما" className="flex items-center gap-2 font-sans text-[14px] text-neutral-600">
            <button
              type="button"
              onClick={() => {
                setSelectedEvent(null)
                router.push('/dashboard/events')
              }}
              className="cursor-pointer font-medium text-neutral-500 hover:text-brand-600 hover:underline"
              aria-label="بازگشت به رویدادها و نمایشگاه‌ها"
            >
              رویدادها و نمایشگاه‌ها
            </button>
            <span className="text-neutral-400">/</span>
            <span className="font-bold text-neutral-800 truncate max-w-[280px] sm:max-w-md">
              {selectedEvent.title}
            </span>
          </nav>

          {/* Top Registration Action Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRegisterSelected}
              disabled={isEnded || selectedCount === 0}
              className="flex h-[40px] items-center justify-center gap-2 rounded-[10px] bg-brand-500 px-4 text-white shadow-xs transition-colors hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
            >
              <span className="font-sans text-[15px] font-semibold">
                {isEnded
                  ? 'مهلت ثبت‌نام پایان یافته'
                  : selectedCount > 0
                    ? `ثبت درخواست (${toPersianDigits(selectedCount)} زیرعنوان)`
                    : 'ثبت‌نام در رویداد'}
              </span>
              <TickSquareIcon className="size-5 shrink-0 stroke-white" />
            </button>
          </div>
        </div>

        {/* Slot 1: Event Summary Banner Card - Figma Frame 61 / Frame 46 / Frame 60 */}
        <section className="relative mt-4 flex w-full flex-col gap-4 rounded-[16px] border border-[#e5e5e5] bg-white p-4 sm:p-6">
          <div className="flex flex-col-reverse items-start justify-end gap-5 sm:flex-row">
            {/* Left Content column */}
            <div className="flex w-full flex-1 flex-col justify-between gap-4 py-1">
              {/* Badge + Title */}
              <div className="flex flex-col items-start gap-3">
                <span className="inline-flex h-[24px] items-center justify-center rounded-[40px] bg-[#f5f5f5] px-3 py-1 font-sans text-[13px] leading-[24px] font-normal text-[#525252]">
                  {selectedEvent.badgeText}
                </span>
                <h1 className="font-sans text-[20px] leading-[32px] font-bold text-[#404040] sm:text-[22px]">
                  {selectedEvent.title}
                </h1>
              </div>

              {/* Dates & Location */}
              <div className="flex flex-col gap-2.5 pt-2">
                <div className="flex items-center gap-2">
                  <CalendarBulkIcon className="size-[24px] shrink-0 text-[#a3a3a3]" />
                  <span className="font-sans text-[15px] leading-[26px] font-semibold text-[#525252]">
                    {selectedEvent.dates}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <LocationBulkIcon className="size-[24px] shrink-0 text-[#a3a3a3]" />
                  <span className="font-sans text-[15px] leading-[26px] font-semibold text-[#525252]">
                    {selectedEvent.location}
                  </span>
                </div>
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

        {/* Slot 2: Categories and Subtopics Tree Card - Figma Slot / Frame 156 */}
        <section className="relative mt-4 flex w-full flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-2">
              <Layers className="size-6 text-brand-500" />
              <h2 className="font-sans text-[18px] leading-[32px] font-bold text-[#404040]">
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
                <button
                  type="button"
                  onClick={() => setQuickModalOpen(true)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 font-sans text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  <span>انتخاب سریع عنوان</span>
                </button>
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

          {/* Hierarchy Content */}
          {loadingDetails ? (
            <TreeSkeleton />
          ) : detailsError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <p className="font-sans text-[14px] text-red-600">{detailsError}</p>
              <button
                type="button"
                onClick={loadEventHierarchy}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3.5 py-1.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
              >
                <RotateCcw className="size-4" />
                <span>تلاش دوباره</span>
              </button>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center font-sans text-[14px] text-neutral-500">
              هیچ عنوان یا زیرعنوانی برای این رویداد تعریف نشده است.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {categories.map((cat) => {
                const catSubtopics = subtopics.filter((sub) => sub.categoryId === cat.id)
                const isExpanded = expandedCategories[cat.id] ?? false

                return (
                  <div
                    key={cat.id}
                    className="overflow-hidden rounded-xl border border-neutral-200/80 bg-neutral-50/50"
                  >
                    {/* Category Accordion Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className="flex w-full items-center justify-between p-3.5 text-right transition-colors hover:bg-neutral-100/70"
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
                    </button>

                    {/* Subtopics List */}
                    {isExpanded && (
                      <div className="flex flex-col divide-y divide-neutral-100 bg-white">
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
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleSubtopicSelect(sub.id)}
                                        aria-label={`انتخاب زیرعنوان ${sub.title}`}
                                        className="size-5 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                      />
                                      <span className="sr-only">انتخاب {sub.title}</span>
                                    </label>

                                    <div className="flex flex-col gap-1">
                                      <span className="font-sans text-[15px] leading-[26px] font-medium text-neutral-800">
                                        {sub.title}
                                      </span>
                                      {sub.employerId && (
                                        <span className="inline-flex items-center text-[12px] text-neutral-500">
                                          کارفرما: <strong className="mr-1 text-neutral-700">{sub.employerId}</strong>
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Left side: RFP Actions */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleRfpViewer(sub)}
                                      aria-label={`دریافت فایل RFP برای ${sub.title}`}
                                      className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-[13px] font-medium text-neutral-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                                    >
                                      <FileText className="size-4" />
                                      <span>مشاهده و دانلود RFP</span>
                                    </button>
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
                                      <div className="text-[13px] text-red-600">{rfp.error}</div>
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
                                              className="flex items-center justify-between rounded-md border border-neutral-200 bg-white p-2 text-[13px]"
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
    <div className="flex w-full flex-1 flex-col text-right" dir="rtl">
      {/* Page Title - Figma node 56:13203 */}
      <h1 className="font-sans text-[24px] leading-[36px] font-bold text-[#404040]">
        رویدادها و نمایشگاه‌ها
      </h1>

      {/* Action Bar - Figma Frame 1 (56:13205) */}
      <div className="mt-5 flex items-center justify-start">
        <div className="flex h-[48px] w-full items-center gap-[8px] sm:w-[458px]">
          <div className="flex h-[48px] flex-1 items-center gap-[8px] overflow-hidden rounded-[8px] border border-[#f5f5f5] bg-white px-[12px] py-[8px] focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 sm:w-[400px]">
            <SearchNormalIcon className="size-[24px] shrink-0 text-[#d4d4d4]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="درخواست خود را جست و جو کنید"
              aria-label="جستجوی رویدادها"
              className="h-[28px] w-full bg-transparent text-right font-sans text-[16px] leading-[28px] font-normal text-[#525252] outline-none placeholder:text-[#d4d4d4]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex h-[48px] w-[50px] shrink-0 items-center justify-center rounded-[12px] bg-white transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  filterType !== 'all'
                    ? 'text-brand-600 ring-2 ring-brand-500/20'
                    : 'text-[#525252]'
                }`}
                title="فیلتر رویدادها"
              >
                <FilterIcon className="size-[26px]" />
                <span className="sr-only">فیلتر</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52 rounded-xl border border-neutral-100 bg-white p-1.5 shadow-md"
            >
              <DropdownMenuItem
                onClick={() => setFilterType('all')}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                  filterType === 'all'
                    ? 'bg-brand-50 font-medium text-brand-600'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>همه رویدادها</span>
                {filterType === 'all' && <Check className="size-4 text-brand-600" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterType('ended')}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                  filterType === 'ended'
                    ? 'bg-brand-50 font-medium text-brand-600'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>تمام شده</span>
                {filterType === 'ended' && <Check className="size-4 text-brand-600" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFilterType('active')}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 text-sm ${
                  filterType === 'active'
                    ? 'bg-brand-50 font-medium text-brand-600'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>در حال ثبت‌نام</span>
                {filterType === 'active' && <Check className="size-4 text-brand-600" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Events Card - Figma Frame 6 (56:13208) */}
      <section className="relative mt-[16px] flex w-full flex-col gap-[32px] rounded-[16px] border border-[#e5e5e5] bg-white p-[16px]">
        {isLoading ? (
          <EventsSkeleton />
        ) : (
          <>
            {!isEmpty && (
              <div className="flex flex-col gap-[32px]">
                {filteredEvents.map((evt) => (
                  <article
                    key={evt.id}
                    className="flex flex-col-reverse items-start justify-end gap-[16px] sm:h-[200px] sm:flex-row"
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
                    {/* Content Column on Left (Frame 46) */}
                    <div className="flex h-[176px] w-full flex-1 flex-col justify-between py-1">
                      {/* Top Section: Tag and Title (Frame 41) */}
                      <div className="flex flex-col items-start gap-[16px]">
                        <span className="inline-flex h-[24px] items-center justify-center rounded-[40px] bg-[#f5f5f5] px-[12px] py-[4px] font-sans text-[14px] leading-[24px] font-normal text-[#525252]">
                          {evt.badgeText}
                        </span>
                        <h2 className="font-sans text-[18px] leading-[32px] font-bold text-[#404040] sm:text-[20px]">
                          {evt.title}
                        </h2>
                      </div>

                      {/* Bottom Section: Details + Action Button */}
                      {(isOwner && evt.serviceKey === 'exhibitions') ||
                      (!isOwner && evt.hasActionButton) ? (
                        /* Frame 91: Has Date/Location + Button */
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          {/* Date and Location */}
                          <div className="flex flex-col gap-[16px]">
                            <div className="flex items-center gap-[8px]">
                              <CalendarBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                              <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                                {evt.dates}
                              </span>
                            </div>
                            <div className="flex items-center gap-[8px]">
                              <LocationBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                              <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                                {evt.location}
                              </span>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isOwner && evt.serviceKey === 'exhibitions') {
                                const rawId = evt.id.replace(/^exhibitions-/, '')
                                router.push(`/dashboard/exhibitions/${encodeURIComponent(rawId)}`)
                              } else if (evt.serviceKey === 'events') {
                                setSelectedEvent(evt)
                                const eventIdParam = evt.rawId || evt.id.replace(/^events-/, '')
                                router.push(`/dashboard/events?eventId=${encodeURIComponent(eventIdParam)}`)
                              } else {
                                router.push(
                                  `/dashboard/new-request?service=${evt.serviceKey}&eventId=${encodeURIComponent(evt.id)}&eventTitle=${encodeURIComponent(evt.title)}`,
                                )
                              }
                            }}
                            className="flex h-[40px] items-center justify-center gap-[8px] rounded-[10px] bg-[#3b82f6] px-[12px] py-[8px] text-white shadow-xs transition-colors hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-brand-500"
                          >
                            <span className="font-sans text-[16px] leading-[28px] font-semibold">
                              {isOwner && evt.serviceKey === 'exhibitions'
                                ? 'مدیریت غرفه‌ها'
                                : evt.actionButtonText || 'ثبت درخواست'}
                            </span>
                            <TickSquareIcon className="size-[24px] shrink-0 stroke-white" />
                          </button>
                        </div>
                      ) : (
                        /* Frame 44: Date and Location only */
                        <div className="flex flex-col gap-[16px]">
                          <div className="flex items-center gap-[8px]">
                            <CalendarBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                            <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                              {evt.dates}
                            </span>
                          </div>
                          <div className="flex items-center gap-[8px]">
                            <LocationBulkIcon className="size-[28px] shrink-0 text-[#a3a3a3]" />
                            <span className="font-sans text-[16px] leading-[28px] font-semibold text-[#525252]">
                              {evt.location}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Empty State */}
            {isEmpty && <EventsEmptyState />}
          </>
        )}
      </section>
    </div>
  )
}
