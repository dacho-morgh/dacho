'use client'

import { SearchField } from '@/components/dashboard/search-field'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  InfoCircleIcon as AlertCircle,
  CarouselArrowRightIcon as ArrowRight,
  CheckSquareIcon as Check,
  DashboardEditIcon as Edit2,
  DashboardRequestsIcon as FileText,
  EventsLocationIcon as MapPin,
  DashboardAddIcon as Plus,
  DashboardEventsIcon as Store,
  DashboardCloseCircle as X,
} from '@/components/icons/generated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { focusFirstField } from '@/components/ui/dialog-focus'
import { Typography } from '@/components/ui/typography'
import {
  createBooth,
  DashboardApiError,
  formatToman,
  getAdminExhibitionCatalogue,
  parsePersianNumber,
  updateBooth,
  updateExhibitionSettings,
  type BoothDto,
  type BoothStatus,
  type CreateBoothInput,
  type ExhibitionCatalogueDto,
  type UpdateBoothInput,
} from '@/utilities/dashboard-api'
import { NativeSelect } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export interface ExhibitionInfo {
  id: string
  title: string
  location?: string | null
  dates?: string | null
}

export interface ExhibitionBoothAdminProps {
  exhibition: ExhibitionInfo
  initialCatalogue?: ExhibitionCatalogueDto | null
}

interface BoothFormData {
  identifier: string
  specification: string
  location: string
  priceAmount: number | string
  status: BoothStatus
  active: boolean
}

function catalogueFailure(error: unknown, fallback: string): string {
  if (error instanceof DashboardApiError) {
    if (error.status === 401) return 'نشست شما پایان یافته است. دوباره وارد شوید.'
    if (error.status === 403) return 'اجازه مدیریت کاتالوگ را ندارید.'
    if (error.status === 404) return 'این نمایشگاه یا غرفه دیگر در دسترس نیست.'
    if (error.code === 'duplicate_identifier')
      return 'شناسه غرفه در این نمایشگاه تکراری است. شناسه دیگری انتخاب کنید.'
    if (error.status === 409) return 'اطلاعات تغییر کرده است. کاتالوگ را دوباره دریافت کنید.'
    if (error.code.startsWith('invalid_price'))
      return 'مبلغ قیمت نامعتبر است. عدد صحیح مثبت به تومان وارد کنید.'
    if (error.status >= 500)
      return 'ارتباط با سامانه برقرار نشد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید.'
  }
  return fallback
}

export function ExhibitionBoothAdmin({
  exhibition,
  initialCatalogue = null,
}: ExhibitionBoothAdminProps) {
  const [catalogue, setCatalogue] = useState<ExhibitionCatalogueDto | null>(initialCatalogue)
  const [loading, setLoading] = useState<boolean>(!initialCatalogue)
  const [error, setError] = useState<string | null>(null)
  const settingsLock = useRef(false)
  const canEdit = !loading && !error && catalogue !== null

  // Settings form state
  const [companyLimitInput, setCompanyLimitInput] = useState<string>(
    initialCatalogue?.companyBoothLimit != null ? String(initialCatalogue.companyBoothLimit) : '1',
  )
  const [guideMapInput, setGuideMapInput] = useState<string>(
    initialCatalogue?.guideMapReference ?? '',
  )
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Booth filtering and search
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all')

  // Booth Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editingBooth, setEditingBooth] = useState<BoothDto | null>(null)

  const loadCatalogue = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAdminExhibitionCatalogue(exhibition.id)
      setCatalogue(data)
      if (data.companyBoothLimit != null) {
        setCompanyLimitInput(String(data.companyBoothLimit))
      }
      setGuideMapInput(data.guideMapReference ?? '')
    } catch (err: unknown) {
      setError(catalogueFailure(err, 'دریافت کاتالوگ غرفه‌ها انجام نشد. دوباره تلاش کنید.'))
    } finally {
      setLoading(false)
    }
  }, [exhibition.id])

  useEffect(() => {
    if (!initialCatalogue) {
      void loadCatalogue()
    }
  }, [initialCatalogue, loadCatalogue])

  // Save Exhibition Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || settingsLock.current) return
    settingsLock.current = true
    setSettingsSaving(true)
    setSettingsError(null)
    const limit = parsePersianNumber(companyLimitInput)
    if (!limit || limit < 1) {
      setSettingsError('سقف غرفه هر شرکت باید عدد صحیح بزرگتر از صفر باشد')
      setSettingsSaving(false)
      settingsLock.current = false
      return
    }

    try {
      const res = await updateExhibitionSettings(exhibition.id, {
        companyBoothLimit: limit,
        guideMapReference: guideMapInput.trim() || null,
      })
      setCatalogue((prev) =>
        prev
          ? {
              ...prev,
              companyBoothLimit: res.settings.companyBoothLimit,
              guideMapReference: res.settings.guideMapReference,
            }
          : prev,
      )
      toast.success('تنظیمات کاتالوگ با موفقیت به‌روزرسانی شد.')
    } catch (err: unknown) {
      toast.error('ذخیره تنظیمات نمایشگاه انجام نشد.')
      setSettingsError(catalogueFailure(err, 'ذخیره تنظیمات نمایشگاه انجام نشد. دوباره تلاش کنید.'))
    } finally {
      setSettingsSaving(false)
      settingsLock.current = false
    }
  }

  // Filtered Booths
  const boothsList = catalogue?.booths ?? []
  const filteredBooths = boothsList.filter((b) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      b.identifier.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      b.specification.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      (b.location && b.location.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'available' && b.status === 'available') ||
      (statusFilter === 'unavailable' && b.status === 'unavailable')
    return matchesSearch && matchesStatus
  })

  // Open modal for new booth
  const handleOpenAdd = () => {
    setEditingBooth(null)
    setModalOpen(true)
  }

  // Open modal for editing booth
  const handleOpenEdit = (booth: BoothDto) => {
    setEditingBooth(booth)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingBooth(null)
  }

  // Stats
  const totalBooths = catalogue?.booths?.length ?? 0
  const activeBooths = catalogue?.booths?.filter((b) => b.active).length ?? 0
  const availableBooths = catalogue?.booths?.filter((b) => b.available).length ?? 0

  return (
    <div
      className="flex w-full max-w-7xl flex-col gap-8 px-4 py-6 font-sans sm:px-6 lg:px-8"
      dir="rtl"
    >
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/events?type=exhibition"
          className="inline-flex w-fit items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-brand-600"
        >
          <ArrowRight className="size-4" />
          <Typography as="span" variant="14/regular">
            بازگشت به رویدادها و نمایشگاه‌ها
          </Typography>
        </Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Store className="size-6 text-brand-600" />
              <Typography as="h1" variant="24/bold" color="neutral-700">
                مدیریت کاتالوگ غرفه‌ها: {exhibition.title}
              </Typography>
            </div>
            {(exhibition.location || exhibition.dates) && (
              <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
                {exhibition.location && (
                  <Typography as="span" variant="14/regular" className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {exhibition.location}
                  </Typography>
                )}
                {exhibition.dates && (
                  <Typography as="span" variant="14/regular">
                    {exhibition.dates}
                  </Typography>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline-gray" size="36">
              <Link href={`/dashboard/exhibitions/${encodeURIComponent(exhibition.id)}/edit`}>
                <Typography as="span" variant="14/regular">
                  ویرایش اطلاعات نمایشگاه
                </Typography>
              </Link>
            </Button>
            <Button
              type="button"
              variant="default"
              size="36"
              onClick={handleOpenAdd}
              disabled={!canEdit}
            >
              <Plus className="size-4" />
              <Typography as="span" variant="14/regular">
                تعریف غرفه جدید
              </Typography>
            </Button>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-error-100 bg-error-50 p-4 text-error-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0 text-error-600" />
            <Typography variant="14/regular">{error}</Typography>
          </div>
          <Button type="button" variant="outline-gray" size="32" onClick={() => void loadCatalogue()}>
            تلاش مجدد
          </Button>
        </div>
      )}

      {/* Section 1: Exhibition Settings (Cap & Guide Map) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-background p-5 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <FileText className="size-5 text-neutral-500" />
          <Typography as="h2" variant="16/semibold" color="neutral-700">
            تنظیمات عمومی کاتالوگ نمایشگاه
          </Typography>
        </div>

        <form
          onSubmit={handleSaveSettings}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <Typography
              as="label"
              variant="14/regular"
              htmlFor="company-limit-input"
              className="mb-1 block text-sm font-medium text-neutral-600"
            >
              سقف مجاز غرفه برای هر شرکت (تعداد)
            </Typography>
            <Input
              id="company-limit-input"
              type="text"
              inputMode="numeric"
              value={companyLimitInput}
              disabled={!canEdit || settingsSaving}
              onChange={(e) => setCompanyLimitInput(e.target.value)}
              placeholder="مثال: ۲"
            />
          </div>

          <div className="flex-1">
            <Typography
              as="label"
              variant="14/regular"
              htmlFor="guide-map-input"
              className="mb-1 block text-sm font-medium text-neutral-600"
            >
              شناسه یا آدرس نقشه راهنمای نمایشگاه
            </Typography>
            <Input
              id="guide-map-input"
              type="text"
              value={guideMapInput}
              disabled={!canEdit || settingsSaving}
              onChange={(e) => setGuideMapInput(e.target.value)}
              placeholder="شناسه فایل یا مرجع نقشه راهنما"
            />
          </div>

          <Button
            type="submit"
            variant="default"
            size="36"
            disabled={!canEdit || settingsSaving}
          >
            {settingsSaving ? (
              <Typography as="span" variant="14/regular">
                در حال ذخیره...
              </Typography>
            ) : (
              <>
                <Check className="size-4" />
                <Typography as="span" variant="14/regular">
                  ذخیره تنظیمات
                </Typography>
              </>
            )}
          </Button>
        </form>

        {settingsError && (
          <div role="alert" className="flex items-center gap-2 text-xs text-error-600">
            <AlertCircle className="size-4" />
            <Typography as="span" variant="14/regular">
              {settingsError}
            </Typography>
          </div>
        )}
      </section>

      {/* Section 2: Booth Catalogue Summary & Filters */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <Typography as="h2" variant="20/bold" color="neutral-700">
              فهرست غرفه‌ها
            </Typography>
            <Badge variant="gray" size="sm">
              <Typography as="span" variant="12/regular">
                کل: {totalBooths}
              </Typography>
            </Badge>
            <Badge variant="blue" size="sm">
              <Typography as="span" variant="12/regular">
                فعال: {activeBooths}
              </Typography>
            </Badge>
            <Badge variant="green" size="sm">
              <Typography as="span" variant="12/regular">
                در دسترس: {availableBooths}
              </Typography>
            </Badge>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در غرفه‌ها..."
              aria-label="جستجو در غرفه‌ها"
            />
            <NativeSelect
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'available' | 'unavailable')
              }
            >
              <Typography as="option" variant="14/regular" value="all">
                همه وضعیت‌ها
              </Typography>
              <Typography as="option" variant="14/regular" value="available">
                فقط در دسترس
              </Typography>
              <Typography as="option" variant="14/regular" value="unavailable">
                غیرقابل دسترس
              </Typography>
            </NativeSelect>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col gap-3" role="status" aria-label="در حال بارگذاری غرفه‌ها">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-neutral-100" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredBooths.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-background p-12 text-center">
            <Store className="mb-3 size-12 text-neutral-300" />
            <Typography variant="16/semibold" color="neutral-600" className="mb-1">
              {searchQuery || statusFilter !== 'all'
                ? 'غرفه‌ای با شرایط جستجو یافت نشد'
                : 'هنوز غرفه‌ای برای این نمایشگاه تعریف نشده است'}
            </Typography>
            <Typography variant="14/regular" color="neutral-400" className="mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'می‌توانید فیلترها را تغییر دهید یا غرفه جدیدی ثبت کنید.'
                : 'با استفاده از دکمه زیر، مشخصات و قیمت نخستین غرفه را ثبت کنید.'}
            </Typography>
            <Button type="button" variant="default" size="32" onClick={handleOpenAdd}>
              افزودن غرفه
            </Button>
          </div>
        )}

        {/* Booths Table / Cards */}
        {!loading && !error && filteredBooths.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-background shadow-2xs">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-neutral-100 bg-neutral-50/70 text-xs font-semibold text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">
                      <Typography as="span" variant="12/semibold">
                        شناسه غرفه
                      </Typography>
                    </th>
                    <th className="px-4 py-3">
                      <Typography as="span" variant="12/semibold">
                        ابعاد و مشخصات
                      </Typography>
                    </th>
                    <th className="px-4 py-3">
                      <Typography as="span" variant="12/semibold">
                        موقعیت / سالن
                      </Typography>
                    </th>
                    <th className="px-4 py-3">
                      <Typography as="span" variant="12/semibold">
                        قیمت ثابت
                      </Typography>
                    </th>
                    <th className="px-4 py-3">
                      <Typography as="span" variant="12/semibold">
                        وضعیت کاتالوگ
                      </Typography>
                    </th>
                    <th className="px-4 py-3">
                      <Typography as="span" variant="12/semibold">
                        فعال بودن
                      </Typography>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <Typography as="span" variant="12/semibold">
                        عملیات
                      </Typography>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredBooths.map((booth) => (
                    <tr key={booth.id} className="transition-colors hover:bg-neutral-50/50">
                      <td className="px-4 py-3 font-semibold text-neutral-700">
                        <Typography as="span" variant="14/regular">
                          {booth.identifier}
                        </Typography>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        <Typography as="span" variant="14/regular">
                          {booth.specification}
                        </Typography>
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        <Typography as="span" variant="14/regular">
                          {booth.location || '—'}
                        </Typography>
                      </td>
                      <td className="px-4 py-3 font-medium text-brand-600">
                        <Typography as="span" variant="14/regular">
                          {formatToman(booth.priceAmount)}
                        </Typography>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={booth.status === 'available' ? 'green' : 'red'} size="sm">
                          <Typography as="span" variant="12/regular">
                            {booth.status === 'available' ? 'در دسترس' : 'غیرقابل دسترس'}
                          </Typography>
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={booth.active ? 'blue' : 'gray'} size="sm">
                          <Typography as="span" variant="12/regular">
                            {booth.active ? 'فعال' : 'غیرفعال'}
                          </Typography>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="text-gray"
                          size="32"
                          onClick={() => handleOpenEdit(booth)}
                        >
                          <Edit2 className="size-3.5" />
                          <Typography as="span" variant="14/regular">
                            ویرایش
                          </Typography>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Cards */}
            <div className="flex flex-col divide-y divide-neutral-100 md:hidden">
              {filteredBooths.map((booth) => (
                <div key={booth.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <Typography
                      as="span"
                      variant="14/regular"
                      className="font-semibold text-neutral-800"
                    >
                      {booth.identifier}
                    </Typography>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={booth.status === 'available' ? 'green' : 'red'} size="sm">
                        <Typography as="span" variant="12/regular">
                          {booth.status === 'available' ? 'در دسترس' : 'غیرقابل دسترس'}
                        </Typography>
                      </Badge>
                      <Badge variant={booth.active ? 'blue' : 'gray'} size="sm">
                        <Typography as="span" variant="12/regular">
                          {booth.active ? 'فعال' : 'غیرفعال'}
                        </Typography>
                      </Badge>
                    </div>
                  </div>
                  <Typography as="p" variant="14/regular" className="text-xs text-neutral-600">
                    {booth.specification}
                  </Typography>
                  {booth.location && (
                    <Typography
                      as="p"
                      variant="14/regular"
                      className="flex items-center gap-1 text-xs text-neutral-400"
                    >
                      <MapPin className="size-3" />
                      <Typography as="span" variant="14/regular">
                        {booth.location}
                      </Typography>
                    </Typography>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t border-neutral-50 pt-2">
                    <Typography
                      as="span"
                      variant="14/regular"
                      className="text-sm font-semibold text-brand-600"
                    >
                      {formatToman(booth.priceAmount)}
                    </Typography>
                    <Button
                      type="button"
                      variant="outline-gray"
                      size="32"
                      onClick={() => handleOpenEdit(booth)}
                    >
                      <Edit2 className="size-3" />
                      <Typography as="span" variant="14/regular">
                        ویرایش
                      </Typography>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Modal: Add / Edit Booth */}
      {modalOpen && (
        <BoothModal
          exhibitionId={exhibition.id}
          booth={editingBooth}
          onClose={handleCloseModal}
          onSaved={(savedBooth) => {
            setCatalogue((prev) => {
              if (!prev) return prev
              const existingIdx = prev.booths.findIndex((b) => b.id === savedBooth.id)
              const newBooths =
                existingIdx >= 0
                  ? prev.booths.map((b) => (b.id === savedBooth.id ? savedBooth : b))
                  : [savedBooth, ...prev.booths]
              return { ...prev, booths: newBooths }
            })
            handleCloseModal()
          }}
        />
      )}
    </div>
  )
}

interface BoothModalProps {
  exhibitionId: string
  booth: BoothDto | null
  onClose: () => void
  onSaved: (booth: BoothDto) => void
}

function BoothModal({ exhibitionId, booth, onClose, onSaved }: BoothModalProps) {
  const isEditing = Boolean(booth)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const submissionLock = useRef(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BoothFormData>({
    defaultValues: {
      identifier: booth?.identifier ?? '',
      specification: booth?.specification ?? '',
      location: booth?.location ?? '',
      priceAmount: booth?.priceAmount ? String(booth.priceAmount) : '',
      status: booth?.status ?? 'available',
      active: booth?.active ?? true,
    },
  })

  const onSubmit = async (data: BoothFormData) => {
    setSubmitting(true)
    setServerError(null)

    const price = parsePersianNumber(String(data.priceAmount))
    if (!price || price <= 0) {
      setServerError('قیمت غرفه باید عدد مثبت به تومان باشد')
      setSubmitting(false)
      return
    }

    try {
      if (isEditing && booth) {
        const payload: UpdateBoothInput = {
          identifier: data.identifier.trim(),
          specification: data.specification.trim(),
          location: data.location.trim() || null,
          priceAmount: price,
          priceUnit: 'toman',
          status: data.status,
          active: Boolean(data.active),
        }
        const res = await updateBooth(exhibitionId, booth.id, payload)
        onSaved(res.booth)
        toast.success(`غرفه ${res.booth.identifier} ذخیره شد.`)
      } else {
        const payload: CreateBoothInput = {
          identifier: data.identifier.trim(),
          specification: data.specification.trim(),
          location: data.location.trim() || null,
          priceAmount: price,
          priceUnit: 'toman',
          status: data.status,
          active: Boolean(data.active),
        }
        const res = await createBooth(exhibitionId, payload)
        onSaved(res.booth)
        toast.success(`غرفه ${res.booth.identifier} اضافه شد.`)
      }
    } catch (err: unknown) {
      toast.error('ثبت غرفه انجام نشد.')
      setServerError(
        catalogueFailure(err, 'ثبت غرفه انجام نشد. اطلاعات شما حفظ شده است؛ دوباره تلاش کنید.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={focusFirstField}
        onEscapeKeyDown={(event) => submitting && event.preventDefault()}
        onInteractOutside={(event) => submitting && event.preventDefault()}
        className="max-w-lg p-6 sm:p-6"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <DialogTitle asChild>
            <Typography id="booth-modal-title" as="h3" variant="20/bold" color="neutral-700">
              {isEditing ? `ویرایش غرفه: ${booth?.identifier}` : 'افزودن غرفه جدید'}
            </Typography>
          </DialogTitle>
          <Button
            variant="text-gray"
            size="icon-32"
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="بستن"
          >
            <X className="size-5" />
          </Button>
        </div>

        {serverError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-error-100 bg-error-50 p-3 text-xs text-error-700"
          >
            <AlertCircle className="size-4 shrink-0 text-error-600" />
            <Typography as="span" variant="14/regular">
              {serverError}
            </Typography>
          </div>
        )}

        <form
          aria-label="اطلاعات غرفه"
          onSubmit={(event) => {
            event.preventDefault()
            if (submissionLock.current) return
            submissionLock.current = true
            void handleSubmit(onSubmit)(event).finally(() => {
              submissionLock.current = false
            })
          }}
        >
          <fieldset disabled={submitting} className="flex flex-col gap-4 text-right">
            <div>
              <Typography
                as="label"
                variant="14/regular"
                htmlFor="booth-id-input"
                className="mb-1 block text-xs font-medium text-neutral-600"
              >
                شناسه غرفه{' '}
                <Typography as="span" variant="14/regular" className="text-error-500">
                  *
                </Typography>
              </Typography>
              <Input
                id="booth-id-input"
                type="text"
                {...register('identifier', { required: 'شناسه غرفه الزامی است' })}
                placeholder="مثال: A-1 یا B-12"
              />
              {errors.identifier && (
                <Typography
                  as="span"
                  variant="14/regular"
                  className="mt-1 block text-xs text-error-500"
                >
                  {errors.identifier.message}
                </Typography>
              )}
            </div>

            <div>
              <Typography
                as="label"
                variant="14/regular"
                htmlFor="booth-spec-input"
                className="mb-1 block text-xs font-medium text-neutral-600"
              >
                ابعاد و مشخصات{' '}
                <Typography as="span" variant="14/regular" className="text-error-500">
                  *
                </Typography>
              </Typography>
              <Input
                id="booth-spec-input"
                type="text"
                {...register('specification', { required: 'ابعاد و مشخصات غرفه الزامی است' })}
                placeholder="مثال: ۳ متر × ۴ متر، مجهز به اسپیس‌فریم و برق"
              />
              {errors.specification && (
                <Typography
                  as="span"
                  variant="14/regular"
                  className="mt-1 block text-xs text-error-500"
                >
                  {errors.specification.message}
                </Typography>
              )}
            </div>

            <div>
              <Typography
                as="label"
                variant="14/regular"
                htmlFor="booth-loc-input"
                className="mb-1 block text-xs font-medium text-neutral-600"
              >
                موقعیت / سالن (اختیاری)
              </Typography>
              <Input
                id="booth-loc-input"
                type="text"
                {...register('location')}
                placeholder="مثال: سالن خلیج فارس، ردیف اول"
              />
            </div>

            <div>
              <Typography
                as="label"
                variant="14/regular"
                htmlFor="booth-price-input"
                className="mb-1 block text-xs font-medium text-neutral-600"
              >
                قیمت قطعی غرفه (تومان){' '}
                <Typography as="span" variant="14/regular" className="text-error-500">
                  *
                </Typography>
              </Typography>
              <Input
                id="booth-price-input"
                type="text"
                inputMode="numeric"
                {...register('priceAmount', { required: 'قیمت غرفه الزامی است' })}
                placeholder="مثال: ۱۵۰۰۰۰۰۰"
              />
              {errors.priceAmount && (
                <Typography
                  as="span"
                  variant="14/regular"
                  className="mt-1 block text-xs text-error-500"
                >
                  {errors.priceAmount.message}
                </Typography>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Typography
                  as="label"
                  variant="14/regular"
                  htmlFor="booth-status-select"
                  className="mb-1 block text-xs font-medium text-neutral-600"
                >
                  وضعیت کاتالوگ
                </Typography>
                <NativeSelect
                  id="booth-status-select"
                  {...register('status')}
                >
                  <Typography as="option" variant="14/regular" value="available">
                    در دسترس
                  </Typography>
                  <Typography as="option" variant="14/regular" value="unavailable">
                    غیرقابل دسترس
                  </Typography>
                </NativeSelect>
              </div>

              <div>
                <Typography
                  as="label"
                  variant="14/regular"
                  htmlFor="booth-active-select"
                  className="mb-1 block text-xs font-medium text-neutral-600"
                >
                  وضعیت نمایش
                </Typography>
                <NativeSelect
                  id="booth-active-select"
                  {...register('active', {
                    setValueAs: (v) => v === 'true' || v === true,
                  })}
                >
                  <Typography as="option" variant="14/regular" value="true">
                    فعال در کاتالوگ
                  </Typography>
                  <Typography as="option" variant="14/regular" value="false">
                    غیرفعال (مخفی)
                  </Typography>
                </NativeSelect>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button
                type="button"
                variant="outline-gray"
                size="32"
                onClick={onClose}
                disabled={submitting}
              >
                انصراف
              </Button>
              <Button type="submit" variant="default" size="32" disabled={submitting}>
                {submitting ? 'در حال ثبت...' : isEditing ? 'ذخیره تغییرات' : 'ثبت غرفه'}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
