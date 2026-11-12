'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import { toEnglishDigits } from '@/utilities/dashboard-api'
import { AdminError, RequestError, adminRequest, resolver } from '../owner-admin'
import {
  AdminBreadcrumb,
  FormRow,
  FormSection,
  FormSkeleton,
  PublicFields,
  SaveFailure,
  applyServerErrors,
  checkPublicDates,
  fromUtcInput,
  publicDefaults,
  publicFieldsSchema,
  type PublicPage,
} from '../owner-events-form'

/** One exhibition as the owner's admin edits it: its public page and booth settings (S5). */
export type OwnerExhibition = PublicPage & {
  companyBoothLimit: number | null
  guideMapReference: string | null
  /** 0 until the exhibition has booth settings (made in the CMS before S5). */
  revision: number
  boothCount: number
}

const exhibitionSchema = publicFieldsSchema
  .extend({
    companyBoothLimit: z
      .string()
      .trim()
      .transform(toEnglishDigits)
      .refine((value) => /^[1-9]\d*$/.test(value), 'سقف غرفه هر شرکت را با عدد صحیح مثبت وارد کنید.'),
    guideMapReference: z.string().trim().max(2048, 'نشانی نقشه راهنما حداکثر ۲۰۴۸ نویسه است.'),
  })
  .superRefine(checkPublicDates)
type ExhibitionValues = z.input<typeof exhibitionSchema>
const EXHIBITION_FIELDS = [
  'title', 'description', 'location', 'startDate', 'endDate', 'status', 'companyBoothLimit', 'guideMapReference',
] as const

function defaults(exhibition?: OwnerExhibition): ExhibitionValues {
  return {
    ...publicDefaults(exhibition),
    companyBoothLimit: exhibition?.companyBoothLimit ? String(exhibition.companyBoothLimit) : '',
    guideMapReference: exhibition?.guideMapReference ?? '',
  }
}

/**
 * FE41 / T60: the owner creates or edits an exhibition, its public page and its
 * booth settings in one form; the booth catalogue stays on its own page.
 */
export function ExhibitionForm({ mode, id }: { mode: 'create' | 'edit'; id?: string }) {
  const [exhibition, setExhibition] = useState<OwnerExhibition | undefined>()
  const [loading, setLoading] = useState(mode === 'edit')
  const [loadError, setLoadError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    let current = true
    adminRequest(`/api/dashboard/admin/exhibitions/${encodeURIComponent(id)}`)
      .then((result) => {
        if (!result.exhibition?.id) throw new Error('invalid_exhibition_response')
        if (current) setExhibition(result.exhibition)
      })
      .catch((error) => {
        if (current) setLoadError(error)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [mode, id, attempt])

  const title = mode === 'create' ? 'نمایشگاه جدید' : exhibition ? `ویرایش ${exhibition.title}` : 'ویرایش نمایشگاه'
  const returnTo = mode === 'create' ? '/dashboard/events/new?type=exhibition' : `/dashboard/exhibitions/${id ?? ''}/edit`

  return (
    <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      {loadError !== null ? (
        <>
          <AdminBreadcrumb title={title} />
          <RequestError
            error={loadError}
            returnTo={returnTo}
            retry={() => {
              setLoading(true)
              setLoadError(null)
              setAttempt((value) => value + 1)
            }}
          />
        </>
      ) : loading ? (
        <>
          <AdminBreadcrumb title={title} />
          <FormSkeleton sections={[6, 2]} />
        </>
      ) : (
        <ExhibitionEditor
          key={exhibition ? `${exhibition.id}:${exhibition.revision}` : 'new'}
          title={title}
          exhibition={exhibition}
          returnTo={returnTo}
          onReloaded={setExhibition}
        />
      )}
    </main>
  )
}

function ExhibitionEditor({
  title,
  exhibition,
  returnTo,
  onReloaded,
}: {
  title: string
  exhibition?: OwnerExhibition
  returnTo: string
  onReloaded: (exhibition: OwnerExhibition) => void
}) {
  const router = useRouter()
  const formId = useId()
  const busy = useRef(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExhibitionValues>({ resolver: resolver(exhibitionSchema), defaultValues: defaults(exhibition) })

  async function save(values: ExhibitionValues) {
    setFailure(null)
    const parsed = exhibitionSchema.parse(values)
    try {
      const result = await adminRequest(
        exhibition ? `/api/dashboard/admin/exhibitions/${encodeURIComponent(exhibition.id)}` : '/api/dashboard/admin/exhibitions',
        {
          method: exhibition ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...parsed,
            startDate: fromUtcInput(parsed.startDate),
            endDate: fromUtcInput(parsed.endDate),
            companyBoothLimit: Number(parsed.companyBoothLimit),
            guideMapReference: parsed.guideMapReference || null,
            ...(exhibition ? { revision: exhibition.revision } : {}),
          }),
        },
      )
      if (!result.exhibition?.id) throw new Error('invalid_exhibition_response')
      toast.success(exhibition ? 'تغییرات نمایشگاه ذخیره شد.' : 'نمایشگاه ساخته شد.')
      router.push(`/dashboard/events?type=exhibition&saved=${exhibition ? 'exhibition-updated' : 'exhibition-created'}`)
    } catch (error) {
      toast.error('ذخیره نمایشگاه انجام نشد.')
      setFailure(error)
      if (error instanceof AdminError && error.status === 409 && error.data.error === 'stale_exhibition') setStale(true)
      applyServerErrors(error, EXHIBITION_FIELDS, setError)
    }
  }

  async function reload() {
    if (!exhibition || reloading) return
    setReloading(true)
    try {
      const result = await adminRequest(`/api/dashboard/admin/exhibitions/${encodeURIComponent(exhibition.id)}`)
      if (!result.exhibition?.id) throw new Error('invalid_exhibition_response')
      onReloaded(result.exhibition)
    } catch (error) {
      setFailure(error)
    } finally {
      setReloading(false)
    }
  }

  return (
    <>
      <AdminBreadcrumb
        title={title}
        actions={
          <>
            <Button asChild variant="outline-gray" size="48">
              <Link href="/dashboard/events?type=exhibition">
                <Typography as="span" variant="20/regular" className="text-inherit">
                  انصراف
                </Typography>
              </Link>
            </Button>
            <Button type="submit" form={formId} size="48" disabled={isSubmitting || stale || reloading}>
              <Typography as="span" variant="20/regular" className="text-inherit">
                {isSubmitting ? 'در حال ثبت...' : exhibition ? 'ذخیره نمایشگاه' : 'ثبت نمایشگاه'}
              </Typography>
            </Button>
          </>
        }
      />
      <form
        id={formId}
        aria-label="اطلاعات نمایشگاه"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (busy.current || stale || reloading) return
          busy.current = true
          void handleSubmit(save)(event).finally(() => {
            busy.current = false
          })
        }}
        className="flex flex-col gap-5"
      >
        {failure !== null && (
          <SaveFailure error={failure} returnTo={returnTo}>
            {stale && (
              <div className="flex flex-wrap items-center gap-3">
                <Typography variant="14/regular" color="neutral-700">
                  نمایشگاه در این فاصله تغییر کرده است (نسخه فعلی سرور: {String((failure as AdminError).data.revision ?? '—')}). بررسی نسخه جدید، فرم را با اطلاعات سرور جایگزین می‌کند.
                </Typography>
                <Button size="40" type="button" variant="outline-gray" disabled={reloading} onClick={reload}>
                  <Typography as="span" variant="14/regular" className="text-inherit">
                    بررسی نسخه جدید
                  </Typography>
                </Button>
              </div>
            )}
          </SaveFailure>
        )}
        {exhibition && exhibition.revision === 0 && (
          <Typography role="status" variant="14/regular" color="neutral-700" className="rounded-xl bg-brand-50 p-3">
            این نمایشگاه هنوز تنظیمات غرفه ندارد. با ذخیره این فرم، سقف غرفه هر شرکت هم ثبت می‌شود.
          </Typography>
        )}
        <fieldset disabled={isSubmitting || reloading} className="flex min-w-0 flex-col gap-5">
          <FormSection title="اطلاعات عمومی">
            <PublicFields<ExhibitionValues> register={register} control={control} errors={errors} titleLabel="عنوان نمایشگاه" />
          </FormSection>
          <FormSection title="تنظیمات غرفه">
            <FormRow id="companyBoothLimit" label="سقف غرفه برای هر شرکت" error={errors.companyBoothLimit?.message}>
              <Input
                id="companyBoothLimit"
                inputMode="numeric"
                dir="ltr"
                aria-required
                placeholder="مثلا: ۲"
                variant={errors.companyBoothLimit ? 'error' : 'default'}
                {...register('companyBoothLimit')}
              />
            </FormRow>
            <FormRow id="guideMapReference" label="نشانی نقشه راهنما (اختیاری)" error={errors.guideMapReference?.message}>
              <Input
                id="guideMapReference"
                dir="ltr"
                placeholder="https://"
                variant={errors.guideMapReference ? 'error' : 'default'}
                {...register('guideMapReference')}
              />
            </FormRow>
            {exhibition && (
              <Typography variant="14/regular" color="neutral-500" className="md:col-span-2">
                غرفه‌ها، مشخصات و قیمت‌ها در صفحه{' '}
                <Link href={`/dashboard/exhibitions/${encodeURIComponent(exhibition.id)}`} className="text-brand-600 underline">
                  غرفه‌ها و کاتالوگ
                </Link>{' '}
                مدیریت می‌شوند ({exhibition.boothCount.toLocaleString('fa-IR')} غرفه).
              </Typography>
            )}
          </FormSection>
        </fieldset>
      </form>
    </>
  )
}
