'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Edit2,
  FileText,
  MapPin,
  Plus,
  Search,
  Store,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import {
  createBooth,
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
import { cn } from '@/utilities/ui'

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

export function ExhibitionBoothAdmin({
  exhibition,
  initialCatalogue = null,
}: ExhibitionBoothAdminProps) {
  const [catalogue, setCatalogue] = useState<ExhibitionCatalogueDto | null>(initialCatalogue)
  const [loading, setLoading] = useState<boolean>(!initialCatalogue)
  const [error, setError] = useState<string | null>(null)

  // Settings form state
  const [companyLimitInput, setCompanyLimitInput] = useState<string>(
    initialCatalogue?.companyBoothLimit != null ? String(initialCatalogue.companyBoothLimit) : '1',
  )
  const [guideMapInput, setGuideMapInput] = useState<string>(
    initialCatalogue?.guideMapReference ?? '',
  )
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false)
  const [settingsSuccess, setSettingsSuccess] = useState<boolean>(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Booth filtering and search
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'unavailable'>('all')

  // Booth Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [editingBooth, setEditingBooth] = useState<BoothDto | null>(null)
  const [boothSubmitting, setBoothSubmitting] = useState<boolean>(false)
  const [boothError, setBoothError] = useState<string | null>(null)

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
      const msg = err instanceof Error ? err.message : 'خطا در دریافت کاتالوگ غرفه‌ها'
      setError(msg)
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
    setSettingsSaving(true)
    setSettingsError(null)
    setSettingsSuccess(false)

    const limit = parsePersianNumber(companyLimitInput)
    if (!limit || limit < 1) {
      setSettingsError('سقف غرفه هر شرکت باید عدد صحیح بزرگتر از صفر باشد')
      setSettingsSaving(false)
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
      setSettingsSuccess(true)
      setTimeout(() => setSettingsSuccess(false), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات نمایشگاه'
      setSettingsError(msg)
    } finally {
      setSettingsSaving(false)
    }
  }

  // Filtered Booths
  const filteredBooths = useMemo(() => {
    if (!catalogue?.booths) return []
    return catalogue.booths.filter((b) => {
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
  }, [catalogue?.booths, searchQuery, statusFilter])

  // Open modal for new booth
  const handleOpenAdd = () => {
    setEditingBooth(null)
    setBoothError(null)
    setModalOpen(true)
  }

  // Open modal for editing booth
  const handleOpenEdit = (booth: BoothDto) => {
    setEditingBooth(booth)
    setBoothError(null)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingBooth(null)
    setBoothError(null)
  }

  // Stats
  const totalBooths = catalogue?.booths?.length ?? 0
  const activeBooths = catalogue?.booths?.filter((b) => b.active).length ?? 0
  const availableBooths = catalogue?.booths?.filter((b) => b.available).length ?? 0

  return (
    <div className="flex w-full max-w-7xl flex-col gap-8 px-4 py-6 font-sans sm:px-6 lg:px-8" dir="rtl">
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/events"
          className="inline-flex w-fit items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-brand-600"
        >
          <ArrowRight className="size-4" />
          <span>بازگشت به رویدادها و نمایشگاه‌ها</span>
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
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {exhibition.location}
                  </span>
                )}
                {exhibition.dates && <span>{exhibition.dates}</span>}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="default"
            size="md"
            onClick={handleOpenAdd}
            className="flex items-center gap-2"
          >
            <Plus className="size-4" />
            <span>تعریف غرفه جدید</span>
          </Button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-error-100 bg-error-50 p-4 text-error-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0 text-error-600" />
            <Typography variant="14/regular">{error}</Typography>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadCatalogue()}>
            تلاش مجدد
          </Button>
        </div>
      )}

      {/* Section 1: Exhibition Settings (Cap & Guide Map) */}
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-100 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <FileText className="size-5 text-neutral-500" />
          <Typography as="h2" variant="16/semibold" color="neutral-700">
            تنظیمات عمومی کاتالوگ نمایشگاه
          </Typography>
        </div>

        <form onSubmit={handleSaveSettings} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="company-limit-input" className="mb-1 block text-sm font-medium text-neutral-600">
              سقف مجاز غرفه برای هر شرکت (تعداد)
            </label>
            <input
              id="company-limit-input"
              type="text"
              inputMode="numeric"
              value={companyLimitInput}
              onChange={(e) => setCompanyLimitInput(e.target.value)}
              placeholder="مثال: ۲"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition-colors focus:border-brand-500"
            />
          </div>

          <div className="flex-1">
            <label htmlFor="guide-map-input" className="mb-1 block text-sm font-medium text-neutral-600">
              شناسه یا آدرس نقشه راهنمای نمایشگاه
            </label>
            <input
              id="guide-map-input"
              type="text"
              value={guideMapInput}
              onChange={(e) => setGuideMapInput(e.target.value)}
              placeholder="شناسه فایل یا مرجع نقشه راهنما"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition-colors focus:border-brand-500"
            />
          </div>

          <Button
            type="submit"
            variant="default"
            size="md"
            disabled={settingsSaving}
            className="flex shrink-0 items-center gap-2"
          >
            {settingsSaving ? (
              <span>در حال ذخیره...</span>
            ) : (
              <>
                <Check className="size-4" />
                <span>ذخیره تنظیمات</span>
              </>
            )}
          </Button>
        </form>

        {settingsSuccess && (
          <div className="flex items-center gap-2 text-xs text-success-600">
            <CheckCircle2 className="size-4" />
            <span>تنظیمات کاتالوگ با موفقیت به‌روزرسانی شد.</span>
          </div>
        )}
        {settingsError && (
          <div className="flex items-center gap-2 text-xs text-error-600">
            <AlertCircle className="size-4" />
            <span>{settingsError}</span>
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
              کل: {totalBooths}
            </Badge>
            <Badge variant="blue" size="sm">
              فعال: {activeBooths}
            </Badge>
            <Badge variant="green" size="sm">
              در دسترس: {availableBooths}
            </Badge>
          </div>

          {/* Search & Status Filter */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در غرفه‌ها..."
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pr-9 pl-3 text-sm text-neutral-700 outline-none transition-colors focus:border-brand-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'available' | 'unavailable')}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition-colors focus:border-brand-500"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="available">فقط در دسترس</option>
              <option value="unavailable">غیرقابل دسترس</option>
            </select>
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
        {!loading && filteredBooths.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white p-12 text-center">
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
            <Button type="button" variant="default" size="sm" onClick={handleOpenAdd}>
              افزودن غرفه
            </Button>
          </div>
        )}

        {/* Booths Table / Cards */}
        {!loading && filteredBooths.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-2xs">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-neutral-100 bg-neutral-50/70 text-xs font-semibold text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">شناسه غرفه</th>
                    <th className="px-4 py-3">ابعاد و مشخصات</th>
                    <th className="px-4 py-3">موقعیت / سالن</th>
                    <th className="px-4 py-3">قیمت ثابت</th>
                    <th className="px-4 py-3">وضعیت رزرو</th>
                    <th className="px-4 py-3">فعال بودن</th>
                    <th className="px-4 py-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredBooths.map((booth) => (
                    <tr key={booth.id} className="transition-colors hover:bg-neutral-50/50">
                      <td className="px-4 py-3 font-semibold text-neutral-700">{booth.identifier}</td>
                      <td className="px-4 py-3 text-neutral-600">{booth.specification}</td>
                      <td className="px-4 py-3 text-neutral-500">{booth.location || '—'}</td>
                      <td className="px-4 py-3 font-medium text-brand-600">{formatToman(booth.priceAmount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={booth.status === 'available' ? 'green' : 'red'} size="sm">
                          {booth.status === 'available' ? 'در دسترس' : 'غیرقابل دسترس'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={booth.active ? 'blue' : 'gray'} size="sm">
                          {booth.active ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(booth)}
                          className="flex items-center gap-1 text-neutral-600 hover:text-brand-600"
                        >
                          <Edit2 className="size-3.5" />
                          <span>ویرایش</span>
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
                    <span className="font-semibold text-neutral-800">{booth.identifier}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={booth.status === 'available' ? 'green' : 'red'} size="sm">
                        {booth.status === 'available' ? 'در دسترس' : 'غیرقابل دسترس'}
                      </Badge>
                      <Badge variant={booth.active ? 'blue' : 'gray'} size="sm">
                        {booth.active ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-600">{booth.specification}</p>
                  {booth.location && (
                    <p className="flex items-center gap-1 text-xs text-neutral-400">
                      <MapPin className="size-3" />
                      <span>{booth.location}</span>
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t border-neutral-50 pt-2">
                    <span className="text-sm font-semibold text-brand-600">
                      {formatToman(booth.priceAmount)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(booth)}
                      className="flex items-center gap-1 text-xs"
                    >
                      <Edit2 className="size-3" />
                      <span>ویرایش</span>
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
          status: data.status,
          active: Boolean(data.active),
        }
        const res = await updateBooth(exhibitionId, booth.id, payload)
        onSaved(res.booth)
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
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت غرفه'
      if (msg.includes('duplicate_identifier') || msg === 'duplicate_identifier') {
        setServerError('شناسه غرفه در این نمایشگاه تکراری است. لطفاً شناسه دیگری انتخاب کنید.')
      } else if (msg.includes('invalid_price') || msg === 'invalid_price') {
        setServerError('مبلغ قیمت نامعتبر است. عدد مثبت به تومان وارد کنید.')
      } else {
        setServerError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booth-modal-title"
      dir="rtl"
    >
      <section className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <Typography id="booth-modal-title" as="h3" variant="20/bold" color="neutral-700">
            {isEditing ? `ویرایش غرفه: ${booth?.identifier}` : 'افزودن غرفه جدید'}
          </Typography>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="بستن"
          >
            <X className="size-5" />
          </button>
        </div>

        {serverError && (
          <div className="flex items-center gap-2 rounded-lg border border-error-100 bg-error-50 p-3 text-xs text-error-700">
            <AlertCircle className="size-4 shrink-0 text-error-600" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 text-right">
          <div>
            <label htmlFor="booth-id-input" className="mb-1 block text-xs font-medium text-neutral-600">
              شناسه غرفه <span className="text-error-500">*</span>
            </label>
            <input
              id="booth-id-input"
              type="text"
              {...register('identifier', { required: 'شناسه غرفه الزامی است' })}
              placeholder="مثال: A-1 یا B-12"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition-colors focus:border-brand-500"
            />
            {errors.identifier && (
              <span className="mt-1 block text-xs text-error-500">{errors.identifier.message}</span>
            )}
          </div>

          <div>
            <label htmlFor="booth-spec-input" className="mb-1 block text-xs font-medium text-neutral-600">
              ابعاد و مشخصات <span className="text-error-500">*</span>
            </label>
            <input
              id="booth-spec-input"
              type="text"
              {...register('specification', { required: 'ابعاد و مشخصات غرفه الزامی است' })}
              placeholder="مثال: ۳ متر × ۴ متر، مجهز به اسپیس‌فریم و برق"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition-colors focus:border-brand-500"
            />
            {errors.specification && (
              <span className="mt-1 block text-xs text-error-500">{errors.specification.message}</span>
            )}
          </div>

          <div>
            <label htmlFor="booth-loc-input" className="mb-1 block text-xs font-medium text-neutral-600">
              موقعیت / سالن (اختیاری)
            </label>
            <input
              id="booth-loc-input"
              type="text"
              {...register('location')}
              placeholder="مثال: سالن خلیج فارس، ردیف اول"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition-colors focus:border-brand-500"
            />
          </div>

          <div>
            <label htmlFor="booth-price-input" className="mb-1 block text-xs font-medium text-neutral-600">
              قیمت قطعی غرفه (تومان) <span className="text-error-500">*</span>
            </label>
            <input
              id="booth-price-input"
              type="text"
              inputMode="numeric"
              {...register('priceAmount', { required: 'قیمت غرفه الزامی است' })}
              placeholder="مثال: ۱۵۰۰۰۰۰۰"
              className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition-colors focus:border-brand-500"
            />
            {errors.priceAmount && (
              <span className="mt-1 block text-xs text-error-500">{errors.priceAmount.message}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="booth-status-select" className="mb-1 block text-xs font-medium text-neutral-600">
                وضعیت رزرو
              </label>
              <select
                id="booth-status-select"
                {...register('status')}
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition-colors focus:border-brand-500"
              >
                <option value="available">در دسترس</option>
                <option value="unavailable">غیرقابل دسترس</option>
              </select>
            </div>

            <div>
              <label htmlFor="booth-active-select" className="mb-1 block text-xs font-medium text-neutral-600">
                وضعیت نمایش
              </label>
              <select
                id="booth-active-select"
                {...register('active', {
                  setValueAs: (v) => v === 'true' || v === true,
                })}
                className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none transition-colors focus:border-brand-500"
              >
                <option value="true">فعال در کاتالوگ</option>
                <option value="false">غیرفعال (مخفی)</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              انصراف
            </Button>
            <Button type="submit" variant="default" size="sm" disabled={submitting}>
              {submitting ? 'در حال ثبت...' : isEditing ? 'ذخیره تغییرات' : 'ثبت غرفه'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
