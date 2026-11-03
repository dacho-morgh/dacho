'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
  cardClass,
  loadPeople,
  resolver,
  type Person,
} from './owner-admin'
import { NativeSelect } from '@/components/ui/native-select'
import { Input } from '@/components/ui/input'
import { FileInput } from '@/components/ui/file-input'
import { toast } from 'sonner'
import { AdminBreadcrumb } from './owner-events-form'

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
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
    >
      <Typography variant="16/semibold">افزودن دسته فناوری</Typography>
      <Field name="title" label="عنوان دسته فناوری" error={errors.title?.message}>
        <Input
          id="title"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          {...register('title')}
        />
      </Field>
      {failure !== null && <RequestError error={failure} returnTo="/dashboard/events" />}
      <div className="flex flex-wrap gap-3">
        <Button size="40" type="submit" disabled={isSubmitting}>
          <Typography variant="14/regular" color="white">
            {isSubmitting ? 'در حال ذخیره...' : 'ذخیره دسته'}
          </Typography>
        </Button>
        <Button size="40" type="button" variant="outline-gray" disabled={isSubmitting} onClick={onCancel}>
          <Typography variant="14/regular">انصراف</Typography>
        </Button>
      </div>
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
  onSaved,
  onCancel,
}: {
  eventId: string
  categories: EventCategoryDto[]
  people: Person[]
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
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubtopicValues>({
    resolver: resolver(schema),
    defaultValues: {
      title: '',
      categoryId: categories.length === 1 ? categories[0].id : '',
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
      className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
    >
      <Typography variant="16/semibold">افزودن زیرعنوان جدید</Typography>
      <Field name="categoryId" label="دسته فناوری" error={errors.categoryId?.message}>
        <NativeSelect
          id="categoryId"
          aria-invalid={!!errors.categoryId}
          aria-describedby={errors.categoryId ? 'categoryId-error' : undefined}
          {...register('categoryId')}
        >
          <option value="">انتخاب دسته</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field name="title" label="عنوان زیرعنوان" error={errors.title?.message}>
        <Input
          id="title"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          {...register('title')}
        />
      </Field>

      <Field name="employerId" label="کارفرمای مسئول" error={errors.employerId?.message}>
        <NativeSelect
          id="employerId"
          aria-invalid={!!errors.employerId}
          aria-describedby={errors.employerId ? 'employerId-error' : undefined}
          {...register('employerId')}
        >
          <option value="">انتخاب کارفرما</option>
          {eligibleEmployers.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name || 'بدون نام'} — {p.phone || p.id}
            </option>
          ))}
        </NativeSelect>
        {eligibleEmployers.length === 0 && (
          <Typography variant="14/regular" color="warning">
            شخص کارفرمای واجد شرایط وجود ندارد؛ ابتدا در بخش پرسنل حساب فعال با نقش کارفرما بسازید.
          </Typography>
        )}
      </Field>

      {failure !== null && <RequestError error={failure} returnTo="/dashboard/events" />}

      <div className="flex flex-wrap gap-3">
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
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <Typography variant="16/semibold">مدیریت RFP: {subtopic.title}</Typography>
        <Button size="40" type="button" variant="outline-gray" onClick={onClose}>
          <Typography variant="14/regular">بستن پنل RFP</Typography>
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
          <Typography variant="14/semibold">وضعیت نسخه فعال:</Typography>
          {version ? (
            <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <Typography variant="14/regular">
                شناسه نسخه: {version.id}
              </Typography>
              <Typography variant="14/regular">
                توضیحات نسخه: {version.reason}
              </Typography>
              <Typography variant="14/regular" color="muted">
                تاریخ ایجاد: {new Date(version.createdAt).toLocaleString('fa-IR')}
              </Typography>
              <div className="mt-2 flex flex-col gap-2">
                <Typography variant="14/semibold">فایل‌های مستندات RFP:</Typography>
                {version.files.map((file) => (
                  <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-200 bg-white p-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Typography as="span" variant="14/regular" className="break-all">
                        {file.filename}
                      </Typography>
                      <Typography as="span" variant="12/regular" color="muted">
                        ({formatFileSize(file.sizeBytes)})
                      </Typography>
                    </div>
                    <Button size="40" asChild variant="outline-gray" className="max-w-full">
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
            <label htmlFor="rfp-reason">توضیحات و دلیل نسخه جدید</label>
          </Typography>
          <Input
            id="rfp-reason"
            aria-label="توضیحات و دلیل نسخه جدید"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Typography asChild variant="16/semibold">
            <label htmlFor="rfp-files">انتخاب فایل‌های RFP</label>
          </Typography>
          <FileInput
            key={fileInputKey}
            id="rfp-files"
            aria-label="انتخاب فایل‌های RFP"
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
            disabled={isSubmitting || loading || stale || loadError !== null}
          >
            <Typography variant="14/regular" color="white">
              {isSubmitting ? 'در حال بارگذاری...' : 'بارگذاری نسخه جدید RFP'}
            </Typography>
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
}: {
  event: Event
  people: Person[]
  onBack: () => void
}) {
  const [categories, setCategories] = useState<EventCategoryDto[]>([])
  const [subtopics, setSubtopics] = useState<EventSubtopicDto[]>([])
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<unknown>(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [addingSubtopic, setAddingSubtopic] = useState(false)
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

  return (
    <section className="flex flex-col gap-5">
      <AdminBreadcrumb
        title={`عناوین، زیرعنوان‌ها و RFP رویداد: ${event.title}`}
        actions={
          <Button size="40" type="button" variant="outline-gray" onClick={onBack}>
            <Typography variant="14/regular">بازگشت به فهرست رویدادها</Typography>
          </Button>
        }
      />

      {successMessage && (
        <Typography role="status" variant="14/regular" color="success">
          {successMessage}
        </Typography>
      )}

      {failure !== null && (
        <RequestError error={failure} returnTo="/dashboard/events" retry={loadData} />
      )}

      <div className="flex flex-wrap gap-3">
        <Button size="40"
          type="button"
          onClick={() => {
            setSuccessMessage(null)
            setAddingCategory(true)
            setAddingSubtopic(false)
          }}
        >
          <Typography variant="14/regular" color="white">
            دسته جدید
          </Typography>
        </Button>
        <Button size="40"
          type="button"
          variant="outline-gray"
          disabled={loading || failure !== null || categories.length === 0}
          onClick={() => {
            setSuccessMessage(null)
            setAddingSubtopic(true)
            setAddingCategory(false)
          }}
        >
          <Typography variant="14/regular">زیرعنوان جدید</Typography>
        </Button>
      </div>

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

      {addingSubtopic && (
        <SubtopicForm
          eventId={event.id}
          categories={categories}
          people={people}
          onSaved={() => {
            setAddingSubtopic(false)
            setSuccessMessage('زیرعنوان با موفقیت ایجاد شد.')
            void loadData()
          }}
          onCancel={() => setAddingSubtopic(false)}
        />
      )}

      {activeRfpSubtopic && (
        <RfpManager
          key={activeRfpSubtopic.id}
          eventId={event.id}
          subtopic={activeRfpSubtopic}
          onUpdated={(versionId) => {
            setSubtopics((prev) =>
              prev.map((s) =>
                s.id === activeRfpSubtopic.id ? { ...s, currentRfpVersionId: versionId } : s,
              ),
            )
          }}
          onClose={() => setActiveRfpSubtopic(null)}
        />
      )}

      {loading ? (
        <Typography variant="16/regular">در حال بارگذاری عناوین و زیرعنوان‌ها...</Typography>
      ) : failure !== null ? null : categories.length === 0 ? (
        <div className={`${cardClass} py-8 text-center`}>
          <Typography variant="14/regular" color="muted">
            هنوز دسته‌ای برای این رویداد تعریف نشده است.
          </Typography>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((cat) => {
            const catSubtopics = subtopics.filter((s) => s.categoryId === cat.id)
            return (
              <article key={cat.id} className={`${cardClass} flex flex-col gap-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                  <Typography variant="16/semibold">{cat.title}</Typography>
                  <Typography variant="12/regular" color="muted">
                    {catSubtopics.length} زیرعنوان
                  </Typography>
                </div>

                {catSubtopics.length === 0 ? (
                  <Typography variant="14/regular" color="muted">
                    زیرعنوانی در این دسته موجود نیست.
                  </Typography>
                ) : (
                  <div className="flex flex-col divide-y divide-neutral-100">
                    {catSubtopics.map((sub) => {
                      const employer = people.find((p) => String(p.id) === sub.employerId)
                      return (
                        <div key={sub.id} className="flex flex-col gap-2 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Typography variant="14/semibold">{sub.title}</Typography>
                            <Button
                              type="button"
                              variant="outline-gray"
                              size="40"
                              aria-label={`مدیریت فایل RFP ${sub.title}`}
                              onClick={() => {
                                setSuccessMessage(null)
                                setActiveRfpSubtopic(sub)
                              }}
                            >
                              <Typography variant="12/regular">مدیریت فایل RFP</Typography>
                            </Button>
                          </div>
                          <Typography variant="14/regular" color="muted">
                            کارفرمای مسئول:{' '}
                            {employer ? `${employer.name || 'بدون نام'} (${employer.phone || employer.id})` : sub.employerId}
                          </Typography>
                          <Typography variant="12/regular" color="muted">
                            {sub.currentRfpVersionId
                              ? `نسخه فعلی RFP: ${sub.currentRfpVersionId}`
                              : 'فایل RFP هنوز بارگذاری نشده است.'}
                          </Typography>
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * The owner's categories, subtopics and RFP page for one event (FE10), reached
 * from the events and exhibitions list (S5).
 */
export function OwnerEventSubtopics({ eventId }: { eventId: string }) {
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
  return (
    <main dir="rtl" className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      {failure !== null ? (
        <RequestError
          error={failure}
          returnTo={`/dashboard/events/${eventId}/subtopics`}
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
          onBack={() => router.push('/dashboard/events?type=event')}
        />
      )}
    </main>
  )
}
