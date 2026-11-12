'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  formatFileSize,
  getRfpDownloadUrl,
  type EventCategoryDto,
  type EventSubtopicDto,
  type RfpVersionDto,
} from '@/utilities/dashboard-api'
import {
  DOCUMENT_ACCEPT,
  MAX_DOCUMENT_BYTES,
  validateSelectedFile,
} from '@/utilities/document-api'
import {
  AdminError,
  Field,
  RequestError,
  adminRequest,
  loadPeople,
  resolver,
  type Person,
} from './owner-admin'
import { DashboardSelect } from './dashboard-select'
import { Input } from '@/components/ui/input'
import { RequiredMark } from '@/components/ui/field'
import { FileInput, SelectedFile } from '@/components/ui/file-input'
import { toast } from 'sonner'
import { AdminBreadcrumb } from './owner-events-form'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DashboardAddIcon,
  DashboardCloseCircle,
  DashboardUserTagIcon,
  DocumentTextIcon,
} from '@/components/icons/generated'

type Event = {
  id: string
  title: string
  description: string
  registrationOpenAt: string
  registrationCloseAt: string
  responsibleChiefId: string
  responsibleInvestmentId: string
  revision: number
}
const categorySchema = z.object({
  title: z.string().trim().min(1, 'عنوان دسته را وارد کنید.'),
})
type CategoryValues = z.infer<typeof categorySchema>

/** The add-category / add-subtopic forms open in place, on a quiet tinted panel. */
const inlineFormClass = 'flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4'

function CategoryForm({
  eventId,
  onSaved,
  onCancel,
}: {
  eventId: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [failure, setFailure] = useState<unknown>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryValues>({
    resolver: resolver(categorySchema),
    defaultValues: { title: '' },
  })

  async function save(values: CategoryValues) {
    setFailure(null)
    try {
      const result = await adminRequest(
        `/api/dashboard/admin/events/${encodeURIComponent(eventId)}/categories`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      )
      if (!result.category?.id) throw new Error('invalid_category_response')
      toast.success('دسته فناوری اضافه شد.')
      onSaved()
    } catch (error) {
      toast.error('افزودن دسته فناوری انجام نشد.')
      setFailure(error)
      if (error instanceof AdminError && error.data?.error === 'invalid_category') {
        setError(
          'title',
          { message: 'عنوان دسته نامعتبر است یا سرور آن را نپذیرفت.' },
          { shouldFocus: true },
        )
      }
    }
  }

  return (
    <form
      aria-label="دسته فناوری جدید"
      noValidate
      onSubmit={handleSubmit(save)}
      className={inlineFormClass}
    >
      {/* One row on wide screens: the buttons line up with the input, below its label. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <Field name="title" label="عنوان دسته فناوری" error={errors.title?.message}>
            <Input
              id="title"
              autoFocus
              aria-required="true"
              placeholder="مثلاً برق و ابزار دقیق"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'title-error' : undefined}
              {...register('title')}
            />
          </Field>
        </div>
        <div className="flex shrink-0 gap-2 md:pt-9">
          <Button size="40" type="submit" disabled={isSubmitting}>
            <Typography variant="14/regular" color="white">
              {isSubmitting ? 'در حال ذخیره...' : 'ذخیره دسته'}
            </Typography>
          </Button>
          <Button size="40" type="button" variant="outline-gray" disabled={isSubmitting} onClick={onCancel}>
            <Typography variant="14/regular">انصراف</Typography>
          </Button>
        </div>
      </div>
      {failure !== null && <RequestError error={failure} returnTo="/dashboard/events" />}
    </form>
  )
}

const subtopicSchema = z.object({
  title: z.string().trim().min(1, 'عنوان زیرعنوان را وارد کنید.'),
  categoryId: z.string().trim().min(1, 'دسته فناوری را انتخاب کنید.'),
  employerId: z.string().trim().min(1, 'کارفرمای مسئول را انتخاب کنید.'),
})
type SubtopicValues = z.infer<typeof subtopicSchema>

function SubtopicForm({
  eventId,
  categories,
  people,
  category,
  onSaved,
  onCancel,
}: {
  eventId: string
  categories: EventCategoryDto[]
  people: Person[]
  /** Opened from a category's own row: that category is fixed and its picker hidden. */
  category?: EventCategoryDto
  onSaved: () => void
  onCancel: () => void
}) {
  const [failure, setFailure] = useState<unknown>(null)
  const eligibleEmployers = people.filter(
    (p) => p.isActive && p.operationalRole === 'employer-reviewer',
  )
  const schema = subtopicSchema.superRefine((value, context) => {
    if (!categories.some((c) => c.id === value.categoryId)) {
      context.addIssue({
        code: 'custom',
        path: ['categoryId'],
        message: 'دسته انتخاب‌شده متعلق به این رویداد نیست.',
      })
    }
    if (!eligibleEmployers.some((p) => String(p.id) === value.employerId)) {
      context.addIssue({
        code: 'custom',
        path: ['employerId'],
        message: 'یک شخص فعال با نقش کارفرما انتخاب کنید.',
      })
    }
  })

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubtopicValues>({
    resolver: resolver(schema),
    defaultValues: {
      title: '',
      categoryId: category?.id ?? (categories.length === 1 ? categories[0].id : ''),
      employerId: '',
    },
  })

  async function save(values: SubtopicValues) {
    setFailure(null)
    try {
      const result = await adminRequest(
        `/api/dashboard/admin/events/${encodeURIComponent(eventId)}/subtopics`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      )
      if (!result.subtopic?.id) throw new Error('invalid_subtopic_response')
      toast.success('زیرعنوان اضافه شد.')
      onSaved()
    } catch (error) {
      toast.error('افزودن زیرعنوان انجام نشد.')
      setFailure(error)
      if (error instanceof AdminError) {
        if (error.data?.error === 'invalid_category_event') {
          setError(
            'categoryId',
            { message: 'دسته انتخاب‌شده متعلق به این رویداد نیست.' },
            { shouldFocus: true },
          )
        } else if (error.data?.error === 'ineligible_employer') {
          setError(
            'employerId',
            { message: 'کارفرمای انتخاب‌شده نامعتبر یا دارای شرکت است.' },
            { shouldFocus: true },
          )
        } else if (error.data?.error === 'invalid_subtopic') {
          setError(
            'title',
            { message: 'عنوان زیرعنوان نامعتبر است.' },
            { shouldFocus: true },
          )
        }
      }
    }
  }

  return (
    <form
      aria-label="زیرعنوان جدید"
      noValidate
      onSubmit={handleSubmit(save)}
      className={inlineFormClass}
    >
      <div className="flex flex-col gap-1">
        <Typography variant="16/semibold" color="neutral-700">
          زیرعنوان جدید
        </Typography>
        <Typography variant="14/regular" color="muted">
          {category
            ? `در دسته «${category.title}» — شرکت‌ها برای این زیرعنوان درخواست می‌دهند.`
            : 'شرکت‌ها برای این زیرعنوان درخواست می‌دهند و کارفرمای مسئول، درخواست‌ها را بررسی می‌کند.'}
        </Typography>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {category ? (
        <input type="hidden" {...register('categoryId')} />
      ) : (
        <Field name="categoryId" label="دسته فناوری" required error={errors.categoryId?.message}>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <DashboardSelect
                ref={field.ref}
                id="categoryId"
                label="دسته فناوری"
                required
                invalid={!!errors.categoryId}
                aria-describedby={errors.categoryId ? 'categoryId-error' : undefined}
                placeholder="دسته را جستجو یا انتخاب کنید"
                options={categories.map((c) => ({ value: c.id, label: c.title }))}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
      )}

      <div>
        <Field name="title" label="عنوان زیرعنوان" error={errors.title?.message}>
          <Input
            id="title"
            autoFocus
            aria-required="true"
            placeholder="مثلاً طراحی سیستم‌های پایش آنلاین"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-error' : undefined}
            {...register('title')}
          />
        </Field>
      </div>

      {/* With the category picker shown, the employer takes the second row on its own. */}
      <div className={category ? undefined : 'md:col-span-2'}>
      <Field name="employerId" label="کارفرمای مسئول" required error={errors.employerId?.message}>
        <Controller
          control={control}
          name="employerId"
          render={({ field }) => (
            <DashboardSelect
              ref={field.ref}
              id="employerId"
              label="کارفرمای مسئول"
              required
              invalid={!!errors.employerId}
              aria-describedby={errors.employerId ? 'employerId-error' : undefined}
              placeholder="کارفرما را جستجو یا انتخاب کنید"
              emptyText="کارفرمایی پیدا نشد"
              options={eligibleEmployers.map((p) => ({
                value: String(p.id),
                label: `${p.name || 'بدون نام'} — ${p.phone || p.id}`,
              }))}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
        {eligibleEmployers.length === 0 && (
          <Typography variant="14/regular" color="warning">
            شخص کارفرمای واجد شرایط وجود ندارد؛ ابتدا در بخش پرسنل حساب فعال با نقش کارفرما بسازید.
          </Typography>
        )}
      </Field>
      </div>
      </div>

      {failure !== null && <RequestError error={failure} returnTo="/dashboard/events" />}

      <div className="flex flex-wrap gap-2">
        <Button size="40" type="submit" disabled={isSubmitting || eligibleEmployers.length === 0}>
          <Typography variant="14/regular" color="white">
            {isSubmitting ? 'در حال ذخیره...' : 'ذخیره زیرعنوان'}
          </Typography>
        </Button>
        <Button size="40" type="button" variant="outline-gray" disabled={isSubmitting} onClick={onCancel}>
          <Typography variant="14/regular">انصراف</Typography>
        </Button>
      </div>
    </form>
  )
}

const rfpUploadMessages: Record<string, string> = {
  file_too_large: 'حجم فایل بیش از سقف مجاز (۱۰ مگابایت) است.',
  invalid_file: 'فایل انتخاب‌شده نامعتبر است؛ دوباره انتخاب کنید.',
  invalid_file_type: 'فرمت فایل مجاز نیست (تنها PDF و Word مجاز است).',
  invalid_file_content: 'محتوای فایل با فرمت آن مطابقت ندارد.',
  invalid_filename: 'نام فایل نامعتبر است.',
  empty_file: 'فایل خالی قابل بارگذاری نیست.',
  invalid_rfp: 'دلیل یا شناسه نسخه نامعتبر است.',
}

function RfpManager({
  eventId,
  subtopic,
  onUpdated,
  onClose,
}: {
  eventId: string
  subtopic: EventSubtopicDto
  onUpdated: (versionId: string | null) => void
  onClose: () => void
}) {
  const [version, setVersion] = useState<RfpVersionDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [requestFailure, setRequestFailure] = useState<unknown>(null)
  const [stale, setStale] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Upload form state (preserved across 409 stale conflict)
  const [reason, setReason] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileInputKey, setFileInputKey] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)

  function acceptServerVersion(next: RfpVersionDto | null) {
    setVersion(next)
    setStale(false)
    setFailure(null)
    setRequestFailure(null)
    onUpdated(next?.id ?? null)
  }

  const fetchRfp = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await adminRequest(
        `/api/dashboard/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopic.id)}/rfp`,
      )
      acceptServerVersion(res.version ?? null)
    } catch (err) {
      if (err instanceof AdminError && err.status === 404) {
        acceptServerVersion(null)
      } else {
        setLoadError(err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchRfp()
  }, [eventId, subtopic.id])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFailure(null)
    setRequestFailure(null)
    if (!reason.trim()) {
      setFormError('توضیحات و دلیل نسخه جدید الزامی است.')
      return
    }
    if (selectedFiles.length === 0) {
      setFormError('حداقل یک فایل برای نسخه RFP انتخاب کنید.')
      return
    }
    for (const file of selectedFiles) {
      const invalid = validateSelectedFile(file)
      if (invalid) {
        setFormError(`${file.name}: ${rfpUploadMessages[invalid]}`)
        return
      }
    }
    // src/proxy.ts covers this route, and Next buffers at most 10MB of a request
    // body there, so a larger multi-file upload would reach the backend truncated.
    if (selectedFiles.reduce((total, file) => total + file.size, 0) > MAX_DOCUMENT_BYTES) {
      setFormError('مجموع حجم فایل‌های یک نسخه نباید از ۱۰ مگابایت بیشتر باشد.')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      for (const file of selectedFiles) {
        formData.append('files', file)
      }
      formData.append('reason', reason.trim())
      formData.append('expectedVersionId', version?.id ?? '')

      const res = await adminRequest(
        `/api/dashboard/admin/events/${encodeURIComponent(eventId)}/subtopics/${encodeURIComponent(subtopic.id)}/rfp`,
        {
          method: 'POST',
          body: formData,
        },
      )

      if (!res.version?.id) throw new Error('invalid_rfp_response')
      acceptServerVersion(res.version)
      toast.success('نسخه جدید RFP با موفقیت بارگذاری شد.')
      setReason('')
      setSelectedFiles([])
      setFileInputKey((value) => value + 1)
    } catch (err) {
      toast.error('بارگذاری RFP انجام نشد.')
      const code = err instanceof AdminError ? String(err.data?.error) : ''
      if (err instanceof AdminError && err.status === 409) {
        setStale(true)
        setFailure('نسخه RFP توسط شخص دیگری تغییر یافته است؛ پیش از ذخیره، آخرین نسخه را بررسی کنید.')
      } else if (rfpUploadMessages[code]) {
        setFailure(rfpUploadMessages[code])
      } else {
        setRequestFailure(err)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      aria-label={`فایل RFP ${subtopic.title}`}
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <DocumentTextIcon aria-hidden="true" className="size-5 shrink-0 text-neutral-500" />
          <Typography variant="16/semibold" color="neutral-700" className="truncate">
            فایل RFP — {subtopic.title}
          </Typography>
        </div>
        <Button size="icon-32" type="button" variant="text-gray" aria-label="بستن پنل RFP" onClick={onClose}>
          <DashboardCloseCircle aria-hidden="true" />
        </Button>
      </div>

      <div role="note" className="rounded-lg border border-warning-400 bg-warning-50 p-3">
        <Typography variant="14/regular" className="leading-6">
          توجه: تغییرات و نسخه‌های جدید RFP طبق قوانین نگارش سرور اعمال می‌شوند و پرونده‌های ارسال‌شده قبلی شرکت‌ها را بازنویسی نمی‌کنند (نسخه پرونده‌های ثبت‌شده ثابت می‌ماند).
        </Typography>
      </div>

      {loading ? (
        <Typography variant="14/regular">در حال بارگذاری اطلاعات RFP...</Typography>
      ) : loadError !== null ? (
        <RequestError error={loadError} returnTo="/dashboard/events" retry={fetchRfp} />
      ) : (
        <div className="flex flex-col gap-3">
          <Typography variant="14/semibold" color="neutral-700">
            نسخه فعال
          </Typography>
          {version ? (
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-background p-3">
              <div className="flex flex-col gap-0.5">
                <Typography variant="14/regular" color="neutral-700">
                  {version.reason}
                </Typography>
                <Typography variant="12/regular" color="muted">
                  {new Date(version.createdAt).toLocaleString('fa-IR')}
                </Typography>
              </div>
              <div className="flex flex-col gap-2">
                {version.files.map((file) => (
                  <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-2 ps-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Typography as="span" variant="14/regular" className="break-all">
                        {file.filename}
                      </Typography>
                      <Typography as="span" variant="12/regular" color="muted">
                        ({formatFileSize(file.sizeBytes)})
                      </Typography>
                    </div>
                    <Button size="32" asChild variant="outline-gray" className="max-w-full">
                      <a
                        href={getRfpDownloadUrl(eventId, subtopic.id, version.id, file.id)}
                        download
                        aria-label={`دانلود ${file.filename}`}
                      >
                        <Typography as="span" variant="14/regular">
                          دانلود
                        </Typography>
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Typography variant="14/regular" color="muted">
              هنوز نسخه‌ای از فایل RFP برای این زیرعنوان ثبت نشده است.
            </Typography>
          )}
        </div>
      )}

      <form
        onSubmit={handleUpload}
        noValidate
        className="mt-3 flex flex-col gap-3 border-t border-neutral-100 pt-3"
      >
        <Typography variant="16/semibold">بارگذاری نسخه جدید RFP</Typography>


        <div className="flex min-w-0 flex-col gap-2">
          <Typography asChild variant="16/semibold">
            <label htmlFor="rfp-reason">
              توضیحات و دلیل نسخه جدید
              <RequiredMark className="ms-0.5" />
            </label>
          </Typography>
          <Input
            id="rfp-reason"
            aria-label="توضیحات و دلیل نسخه جدید"
            aria-required="true"
            placeholder="مثال: اصلاح بخش معیارهای ارزیابی"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Typography asChild variant="16/semibold">
            <label htmlFor="rfp-files">
              انتخاب فایل‌های RFP
              <RequiredMark className="ms-0.5" />
            </label>
          </Typography>
          <FileInput
            key={fileInputKey}
            id="rfp-files"
            aria-label="انتخاب فایل‌های RFP"
            aria-required="true"
            multiple
            accept={DOCUMENT_ACCEPT}
            onChange={(e) => {
              const fileList = e.target.files ? Array.from(e.target.files) : []
              setSelectedFiles(fileList)
            }}
          />
          <Typography variant="12/regular" color="muted">
            فرمت‌های مجاز: PDF, DOC, DOCX — حداکثر ۱۰ مگابایت برای مجموع فایل‌های هر نسخه
          </Typography>
          {selectedFiles.map((file, index) => (
            <SelectedFile
              key={`${file.name}-${file.size}-${index}`}
              file={file}
              disabled={isSubmitting}
              onRemove={() => {
                setSelectedFiles((current) => current.filter((_, at) => at !== index))
                setFileInputKey((value) => value + 1)
              }}
            />
          ))}
        </div>

        {formError && (
          <Typography role="alert" variant="14/regular" color="error">
            {formError}
          </Typography>
        )}

        {failure && (
          <Typography role="alert" variant="14/regular" color="error">
            {failure}
          </Typography>
        )}

        {requestFailure !== null && (
          <RequestError error={requestFailure} returnTo="/dashboard/events" />
        )}

        {stale && (
          <div className="flex items-center gap-3">
            <Button size="40" type="button" variant="outline-gray" onClick={fetchRfp} disabled={loading}>
              <Typography variant="14/regular">بررسی نسخه جدید سرور</Typography>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button size="40"
            type="submit"
            loading={isSubmitting}
            disabled={loading || stale || loadError !== null}
          >
            بارگذاری نسخه جدید RFP
          </Button>
        </div>
      </form>
    </section>
  )
}

function EventSubtopicsManager({
  event,
  people,
  onBack,
  embedded = false,
}: {
  event: Event
  people: Person[]
  onBack: () => void
  /** Inside the event's edit page: no page breadcrumb or back button, only the section card. */
  embedded?: boolean
}) {
  const [categories, setCategories] = useState<EventCategoryDto[]>([])
  const [subtopics, setSubtopics] = useState<EventSubtopicDto[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<unknown>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  // null: closed. `category` set: opened from that category's row, so the category is fixed.
  const [addingSubtopic, setAddingSubtopic] = useState<{ category?: EventCategoryDto } | null>(null)
  const [activeRfpSubtopic, setActiveRfpSubtopic] = useState<EventSubtopicDto | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setFailure(null)
    try {
      const [catsRes, subsRes] = await Promise.all([
        adminRequest(`/api/dashboard/admin/events/${encodeURIComponent(event.id)}/categories`),
        adminRequest(`/api/dashboard/admin/events/${encodeURIComponent(event.id)}/subtopics`),
      ])
      setCategories(catsRes.items ?? [])
      setSubtopics(subsRes.items ?? [])
    } catch (err) {
      setFailure(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [event.id])

  const openCategoryForm = () => {
    setSuccessMessage(null)
    setAddingCategory(true)
    setAddingSubtopic(null)
  }
  const openSubtopicForm = (category?: EventCategoryDto) => {
    setSuccessMessage(null)
    setAddingSubtopic({ category })
    setAddingCategory(false)
  }
  const subtopicForm = (category?: EventCategoryDto) => (
    <SubtopicForm
      eventId={event.id}
      categories={categories}
      people={people}
      category={category}
      onSaved={() => {
        setAddingSubtopic(null)
        setSuccessMessage('زیرعنوان با موفقیت ایجاد شد.')
        void loadData()
      }}
      onCancel={() => setAddingSubtopic(null)}
    />
  )

  const ready = !loading && failure === null
  const withoutRfp = subtopics.filter((s) => !s.currentRfpVersionId).length
  const count = (value: number) => value.toLocaleString('fa-IR')

  return (
    <div className="flex flex-col gap-5">
      {!embedded && (
        <AdminBreadcrumb
          title={`عناوین، زیرعنوان‌ها و RFP رویداد: ${event.title}`}
          actions={
            <Button size="40" type="button" variant="outline-gray" onClick={onBack}>
              <Typography variant="14/regular">بازگشت به فهرست رویدادها</Typography>
            </Button>
          }
        />
      )}

      {/* Same card as the event form's sections above it (FormSection). */}
      <section
        aria-labelledby="event-subtopics-heading"
        className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-background p-4"
      >
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <Typography as="h2" id="event-subtopics-heading" variant="20/bold" color="neutral-600">
              دسته‌ها و زیرعنوان‌ها
            </Typography>
            <Typography variant="14/regular" color="muted">
              شرکت‌ها برای یکی از زیرعنوان‌ها درخواست می‌دهند؛ هر زیرعنوان یک کارفرمای مسئول و یک فایل RFP دارد.
            </Typography>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="40" type="button" variant="outline-gray" onClick={openCategoryForm}>
              <DashboardAddIcon aria-hidden="true" />
              <Typography variant="14/regular" className="text-inherit">
                دسته جدید
              </Typography>
            </Button>
            <Button
              size="40"
              type="button"
              disabled={!ready || categories.length === 0}
              onClick={() => openSubtopicForm()}
            >
              <DashboardAddIcon aria-hidden="true" />
              <Typography variant="14/regular" color="white">
                زیرعنوان جدید
              </Typography>
            </Button>
          </div>
        </header>

        {ready && categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="gray">{count(categories.length)} دسته</Badge>
            <Badge variant="gray">{count(subtopics.length)} زیرعنوان</Badge>
            {withoutRfp > 0 ? (
              <Badge variant="warning">{count(withoutRfp)} زیرعنوان بدون RFP</Badge>
            ) : subtopics.length > 0 ? (
              <Badge variant="success">RFP همه زیرعنوان‌ها بارگذاری شده</Badge>
            ) : null}
          </div>
        )}

        {successMessage && (
          <Typography role="status" variant="14/regular" color="success" className="rounded-xl bg-success-50 px-3 py-2">
            {successMessage}
          </Typography>
        )}

        {failure !== null && (
          <RequestError error={failure} returnTo="/dashboard/events" retry={loadData} />
        )}

        {addingCategory && (
          <CategoryForm
            eventId={event.id}
            onSaved={() => {
              setAddingCategory(false)
              setSuccessMessage('دسته با موفقیت ایجاد شد.')
              void loadData()
            }}
            onCancel={() => setAddingCategory(false)}
          />
        )}

        {addingSubtopic && !addingSubtopic.category && subtopicForm()}

        {loading ? (
          <div role="status" aria-label="در حال بارگذاری عناوین و زیرعنوان‌ها" className="flex flex-col gap-3">
            {[0, 1].map((index) => (
              <Skeleton key={index} className="h-28 w-full rounded-xl bg-neutral-100 motion-reduce:animate-none" />
            ))}
          </div>
        ) : failure !== null ? null : categories.length === 0 ? (
          !addingCategory && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 px-4 py-10 text-center">
              <Typography variant="16/semibold" color="neutral-700">
                هنوز دسته‌ای برای این رویداد تعریف نشده است.
              </Typography>
              <Typography variant="14/regular" color="muted">
                ابتدا یک دسته فناوری بسازید، سپس زیرعنوان‌های آن را اضافه کنید.
              </Typography>
              <Button size="40" type="button" variant="outline-gray" onClick={openCategoryForm}>
                <DashboardAddIcon aria-hidden="true" />
                <Typography variant="14/regular" className="text-inherit">
                  ساخت نخستین دسته
                </Typography>
              </Button>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
            {categories.map((cat) => {
              const catSubtopics = subtopics.filter((s) => s.categoryId === cat.id)
              const addingHere = addingSubtopic?.category?.id === cat.id
              return (
                <article key={cat.id} className="overflow-hidden rounded-xl border border-neutral-200">
                  <div className="flex items-center justify-between gap-3 bg-neutral-50 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Typography as="h3" variant="16/semibold" color="neutral-700" className="truncate">
                        {cat.title}
                      </Typography>
                      <Badge variant="white" size="sm">
                        {count(catSubtopics.length)} زیرعنوان
                      </Badge>
                    </div>
                    <Button
                      size="32"
                      type="button"
                      variant="text-primary"
                      aria-label={`افزودن زیرعنوان به ${cat.title}`}
                      aria-expanded={addingHere}
                      onClick={() => (addingHere ? setAddingSubtopic(null) : openSubtopicForm(cat))}
                    >
                      <DashboardAddIcon aria-hidden="true" />
                      <Typography variant="14/regular" className="text-inherit">
                        زیرعنوان
                      </Typography>
                    </Button>
                  </div>

                  {addingHere && <div className="border-t border-neutral-200 p-3">{subtopicForm(cat)}</div>}

                  {catSubtopics.length === 0 ? (
                    !addingHere && (
                      <Typography variant="14/regular" color="muted" className="border-t border-neutral-200 px-4 py-4">
                        زیرعنوانی در این دسته موجود نیست.
                      </Typography>
                    )
                  ) : (
                    <ul className="divide-y divide-neutral-100 border-t border-neutral-200">
                      {catSubtopics.map((sub) => {
                        const employer = people.find((p) => String(p.id) === sub.employerId)
                        const open = activeRfpSubtopic?.id === sub.id
                        return (
                          <li key={sub.id} className="flex flex-col">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                              <div className="flex min-w-0 flex-col gap-1">
                                <Typography variant="14/semibold" color="neutral-700">
                                  {sub.title}
                                </Typography>
                                <div className="flex min-w-0 items-center gap-1.5 text-neutral-400">
                                  <DashboardUserTagIcon aria-hidden="true" className="size-4 shrink-0" />
                                  <Typography as="span" variant="12/regular" color="muted" className="truncate">
                                    <span className="sr-only">کارفرمای مسئول: </span>
                                    {employer ? `${employer.name || 'بدون نام'} (${employer.phone || employer.id})` : sub.employerId}
                                  </Typography>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {sub.currentRfpVersionId ? (
                                  <Badge variant="success" size="sm">
                                    RFP بارگذاری شده
                                  </Badge>
                                ) : (
                                  <Badge variant="warning" size="sm">
                                    بدون RFP
                                  </Badge>
                                )}
                                <Button
                                  type="button"
                                  variant="outline-gray"
                                  size="32"
                                  aria-label={`مدیریت فایل RFP ${sub.title}`}
                                  aria-expanded={open}
                                  onClick={() => {
                                    setSuccessMessage(null)
                                    setActiveRfpSubtopic(open ? null : sub)
                                  }}
                                >
                                  <DocumentTextIcon aria-hidden="true" />
                                  <Typography variant="12/regular" className="text-inherit">
                                    فایل RFP
                                  </Typography>
                                </Button>
                              </div>
                            </div>
                            {open && (
                              <div className="px-3 pb-3">
                                <RfpManager
                                  key={sub.id}
                                  eventId={event.id}
                                  subtopic={sub}
                                  onUpdated={(versionId) => {
                                    setSubtopics((prev) =>
                                      prev.map((s) => (s.id === sub.id ? { ...s, currentRfpVersionId: versionId } : s)),
                                    )
                                  }}
                                  onClose={() => setActiveRfpSubtopic(null)}
                                />
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

/**
 * The owner's categories, subtopics and RFP page for one event (FE10), reached
 * from the events and exhibitions list (S5).
 */
export function OwnerEventSubtopics({ eventId, embedded = false }: { eventId: string; embedded?: boolean }) {
  const router = useRouter()
  const [loaded, setLoaded] = useState<{ event: Event; people: Person[] } | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    Promise.all([adminRequest(`/api/dashboard/admin/events/${encodeURIComponent(eventId)}`), loadPeople()])
      .then(([result, people]) => {
        if (!result.event?.id) throw new Error('invalid_event_response')
        if (current) setLoaded({ event: result.event, people })
      })
      .catch((error) => {
        if (current) setFailure(error)
      })
    return () => {
      current = false
    }
  }, [eventId, attempt])
  const Shell = embedded ? 'section' : 'main'
  return (
    <Shell dir="rtl" className={embedded ? 'flex min-w-0 flex-col gap-5 px-4 pb-10' : 'flex min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10'}>
      {failure !== null ? (
        <RequestError
          error={failure}
          returnTo={embedded ? `/dashboard/events/${eventId}/edit` : `/dashboard/events/${eventId}/subtopics`}
          retry={() => {
            setFailure(null)
            setAttempt((value) => value + 1)
          }}
        />
      ) : loaded === null ? (
        <Typography role="status" variant="16/regular">
          در حال دریافت اطلاعات...
        </Typography>
      ) : (
        <EventSubtopicsManager
          event={loaded.event}
          people={loaded.people}
          embedded={embedded}
          onBack={() => router.push('/dashboard/events?type=event')}
        />
      )}
    </Shell>
  )
}
