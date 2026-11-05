'use client'

import {
  OPERATIONAL_ROLES,
  OPERATIONAL_ROLE_LABELS,
  PERSONNEL_GENDERS,
  PERSONNEL_GENDER_LABELS,
  PERSONNEL_MAX_AGE,
  PERSONNEL_MIN_AGE,
} from '@cms-core/access/roles'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { DashboardAddIcon, DashboardEditIcon, DashboardTrashIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { FileInput } from '@/components/ui/file-input'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import { AdminError, RequestError, adminRequest, resolver } from '../owner-admin'
import {
  discardPersonnelFiles,
  fileRef,
  loadEmployee,
  uploadPersonnelFile,
  type Employee,
  type PersonnelFileRef,
} from './employee-data'
import { toast } from 'sonner'

/** docs/system/document-policy.json — Word/PDF, 10 MB (decimal) per file. */
const RESUME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}
const RESUME_MAX_BYTES = 10_000_000
const STAFF_ROLES = OPERATIONAL_ROLES.filter((role) => role !== 'representative')

const toLatinDigits = (value: string) =>
  value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(
      '۰۱۲۳۴۵۶۷۸۹'.includes(digit) ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit) : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit),
    ),
  )

const employeeSchema = z.object({
  name: z.string().trim().min(1, 'نام و نام خانوادگی را وارد کنید.'),
  phone: z.string().trim().min(1, 'شماره تلفن همراه را وارد کنید.').transform(toLatinDigits),
  email: z.union([z.literal(''), z.string().trim().email('آدرس ایمیل معتبر وارد کنید.')]),
  password: z.string(),
  operationalRole: z.enum(STAFF_ROLES as [string, ...string[]], {
    message: 'نقش در سیستم را انتخاب کنید.',
  }),
  age: z
    .string()
    .trim()
    .transform(toLatinDigits)
    .refine(
      (value) =>
        value === '' ||
        (/^\d+$/.test(value) && +value >= PERSONNEL_MIN_AGE && +value <= PERSONNEL_MAX_AGE),
      `سن باید عددی بین ${PERSONNEL_MIN_AGE.toLocaleString('fa-IR')} و ${PERSONNEL_MAX_AGE.toLocaleString('fa-IR')} باشد.`,
    ),
  gender: z.union([z.literal(''), z.enum(PERSONNEL_GENDERS)]),
  degree: z.string().trim(),
  activityField: z.string().trim(),
  personnelAddresses: z.array(z.object({ address: z.string().trim() })),
})
type EmployeeValues = z.infer<typeof employeeSchema>
type EmployeeInput = z.input<typeof employeeSchema>

const valuesOf = (employee?: Employee): EmployeeInput => ({
  name: employee?.name ?? '',
  phone: employee?.phone ?? '',
  email: employee?.email ?? '',
  password: '',
  operationalRole: employee?.operationalRole ?? '',
  age: employee?.age != null ? String(employee.age) : '',
  gender: employee?.gender ?? '',
  degree: employee?.degree ?? '',
  activityField: employee?.activityField ?? '',
  personnelAddresses: (employee?.personnelAddresses ?? []).map(({ address }) => ({ address })),
})

const formatBytes = (bytes?: number | null) =>
  bytes
    ? `${(bytes / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`
    : ''

/* Figma "Text field" (32:10126): 16/SemiBold grey-700 label, 8px gap, 40px control. */
function FormField({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <Typography as="label" htmlFor={id} variant="16/semibold" color="neutral-700">
        {label}
      </Typography>
      <div className="flex flex-col gap-1">
        {children}
        {error && (
          <Typography id={`${id}-error`} role="alert" variant="12/light" color="error">
            {error}
          </Typography>
        )}
      </div>
    </div>
  )
}

/* Figma card (31070:16605): white, grey-200 border, 16px radius/padding, 20×32 grid gaps. */
function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="grid grid-cols-1 gap-x-5 gap-y-8 rounded-2xl border border-neutral-200 bg-background p-4 md:grid-cols-2">
      <div className="flex items-center justify-between gap-3 md:col-span-2">
        <Typography as="h2" variant="20/bold" color="neutral-600">
          {title}
        </Typography>
        {action}
      </div>
      {children}
    </section>
  )
}

export type EmployeeFormMode = 'create' | 'edit' | 'view'

export function EmployeeForm({
  mode,
  id,
  canManage = false,
}: {
  mode: EmployeeFormMode
  id?: string
  canManage?: boolean
}) {
  const [employee, setEmployee] = useState<Employee | undefined>()
  const [loading, setLoading] = useState(mode !== 'create')
  const [loadError, setLoadError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (mode === 'create' || !id) return
    let current = true
    loadEmployee(id)
      .then((doc) => {
        if (current) setEmployee(doc)
      })
      .catch((cause) => {
        if (current) setLoadError(cause)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [mode, id, attempt])

  const title =
    mode === 'create'
      ? 'اضافه کردن کارمند جدید'
      : loading || loadError !== null
        ? mode === 'edit'
          ? 'ویرایش کارمند'
          : 'مشاهده کارمند'
        : employee?.name || 'بدون نام'

  return (
    <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      {loading ? (
        <>
          <Breadcrumb title={title} />
          <div className="flex flex-col gap-5">
            {[3, 7].map((rows) => (
              <div
                key={rows}
                className="grid gap-4 rounded-2xl border border-neutral-200 bg-background p-4 md:grid-cols-2"
              >
                {Array.from({ length: rows }, (_, row) => (
                  <Skeleton
                    key={row}
                    className="h-10 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none"
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      ) : loadError !== null ? (
        <>
          <Breadcrumb title={title} />
          <RequestError
            error={loadError}
            returnTo={`/dashboard/employees/${id ?? ''}`}
            retry={() => {
              setLoading(true)
              setLoadError(null)
              setAttempt((value) => value + 1)
            }}
          />
        </>
      ) : mode === 'view' ? (
        <EmployeeDetails employee={employee!} canManage={canManage} title={title} />
      ) : (
        <EmployeeEditor
          key={employee?.updatedAt ?? 'new'}
          employee={employee}
          title={title}
          onReloaded={setEmployee}
        />
      )}
    </main>
  )
}

/* Breadcrumb — Figma 31070:14907: grey-500 parent, "/" and the 24/Bold grey-700 page. */
function Breadcrumb({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="مسیر صفحه" className="flex min-w-0 items-center gap-2">
        <Link
          href="/dashboard/employees"
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <Typography
            as="span"
            variant="16/regular"
            color="neutral-500"
            className="whitespace-nowrap"
          >
            کارکنان
          </Typography>
        </Link>
        <Typography as="span" variant="16/regular" color="neutral-500" aria-hidden="true">
          /
        </Typography>
        <Typography as="h1" variant="24/bold" color="neutral-700" className="truncate">
          {title}
        </Typography>
      </nav>
      {action}
    </div>
  )
}

function EmployeeDetails({
  employee,
  canManage,
  title,
}: {
  employee: Employee
  canManage: boolean
  title: string
}) {
  const value = (id: string, label: string, text?: string | null, className?: string) => (
    <FormField id={id} label={label} className={className}>
      <Input id={id} readOnly value={text || '—'} />
    </FormField>
  )
  const resume = (employee.resume ?? []).map(fileRef)
  const addresses = employee.personnelAddresses ?? []
  return (
    <>
      <Breadcrumb
        title={title}
        action={
          canManage && (
            <Button asChild size="48">
              <Link href={`/dashboard/employees/${encodeURIComponent(employee.id)}/edit`}>
                <Typography as="span" variant="20/regular" className="text-inherit">
                  ویرایش
                </Typography>
                <DashboardEditIcon className="size-[26px]" />
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-5">
        <Section title="اطلاعات حساب">
          {value('phone', 'شماره تلفن همراه', employee.phone)}
          {value('email', 'آدرس ایمیل', employee.email)}
          {value('status', 'وضعیت حساب', employee.isActive ? 'فعال' : 'غیرفعال')}
        </Section>
        <Section title="اطلاعات پایه">
          {value('name', 'نام و نام خانوادگی', employee.name)}
          {value(
            'operationalRole',
            'نقش در سیستم',
            employee.operationalRole ? OPERATIONAL_ROLE_LABELS[employee.operationalRole] : null,
          )}
          {value('age', 'سن', employee.age != null ? employee.age.toLocaleString('fa-IR') : null)}
          {value(
            'gender',
            'جنسیت',
            employee.gender ? PERSONNEL_GENDER_LABELS[employee.gender] : null,
          )}
          {value('degree', 'مدرک دانشگاهی', employee.degree)}
          {canManage ? (
            <FormField id="resume" label="فایل رزومه">
              <ResumeList id="resume" files={resume} />
            </FormField>
          ) : (
            <div className="hidden md:block" />
          )}
          {value('activityField', 'زمینه فعالیت', employee.activityField)}
        </Section>
        <Section title="آدرس ها">
          {addresses.length === 0 ? (
            <Typography variant="14/regular" color="neutral-500" className="md:col-span-2">
              آدرسی ثبت نشده است.
            </Typography>
          ) : (
            addresses.map((item, index) => (
              <div key={item.id ?? index} className="md:col-span-2">
                {value(
                  `address-${index}`,
                  `آدرس ${(index + 1).toLocaleString('fa-IR')}`,
                  item.address,
                )}
              </div>
            ))
          )}
        </Section>
      </div>
    </>
  )
}

function ResumeList({
  id,
  files,
  onRemove,
}: {
  id: string
  files: (PersonnelFileRef | File)[]
  onRemove?: (index: number) => void
}) {
  if (files.length === 0)
    return (
      <div
        id={id}
        className="flex h-10 items-center rounded-lg border border-neutral-100 bg-background px-2"
      >
        <Typography as="span" variant="16/light" color="neutral-400">
          فایلی بارگذاری نشده است
        </Typography>
      </div>
    )
  return (
    <ul id={id} className="flex flex-col gap-1">
      {files.map((file, index) => {
        const name = file instanceof File ? file.name : file.filename || `فایل ${file.id}`
        const size = file instanceof File ? file.size : file.filesize
        const href = file instanceof File ? null : file.url
        return (
          <li
            key={`${name}-${index}`}
            className="flex h-10 items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-background px-2"
          >
            {href ? (
              <a href={href} className="min-w-0 truncate text-brand-600 hover:underline" download>
                <Typography as="span" variant="14/regular" className="text-inherit">
                  {name}
                </Typography>
              </a>
            ) : (
              <Typography
                as="span"
                variant="14/regular"
                color="neutral-600"
                className="min-w-0 truncate"
              >
                {name}
              </Typography>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <Typography as="span" variant="12/regular" color="neutral-400">
                {formatBytes(size)}
              </Typography>
              {onRemove && (
                <Button
                  type="button"
                  variant="text-gray"
                  size="icon-32"
                  aria-label={`حذف فایل ${name}`}
                  onClick={() => onRemove(index)}
                >
                  <DashboardTrashIcon className="size-5" />
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function EmployeeEditor({
  employee,
  title,
  onReloaded,
}: {
  employee?: Employee
  title: string
  onReloaded: (employee: Employee) => void
}) {
  const router = useRouter()
  const formId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  // A field rule, not an object refine: zod skips object refines while any field is invalid.
  const schema = employee
    ? employeeSchema
    : employeeSchema.extend({ password: z.string().min(3, 'رمز عبور حداقل ۳ نویسه است.') })
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeInput, unknown, EmployeeValues>({
    resolver: resolver(schema) as never,
    defaultValues: valuesOf(employee),
  })
  const addresses = useFieldArray({ control, name: 'personnelAddresses' })
  const [keptFiles, setKeptFiles] = useState(() => (employee?.resume ?? []).map(fileRef))
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const busy = useRef(false)
  const stale = failure instanceof AdminError && failure.status === 409

  function addFiles(list: FileList | null) {
    setFileError(null)
    const accepted: File[] = []
    for (const file of Array.from(list ?? [])) {
      if (!RESUME_TYPES[file.type]) setFileError('فقط فایل‌های PDF و Word پذیرفته می‌شوند.')
      else if (file.size > RESUME_MAX_BYTES) setFileError('حجم هر فایل حداکثر ۱۰ مگابایت است.')
      else accepted.push(file)
    }
    setNewFiles((current) => [...current, ...accepted])
    if (fileInput.current) fileInput.current.value = ''
  }

  async function save(values: EmployeeValues) {
    setFailure(null)
    const uploaded: number[] = []
    try {
      for (const file of newFiles) uploaded.push(await uploadPersonnelFile(file))
      const profile = {
        age: values.age === '' ? null : Number(values.age),
        gender: values.gender || null,
        degree: values.degree || null,
        activityField: values.activityField || null,
        resume: [...keptFiles.map((file) => file.id), ...uploaded],
        personnelAddresses: values.personnelAddresses.filter((item) => item.address !== ''),
      }
      const body = employee
        ? {
            expectedUpdatedAt: employee.updatedAt,
            name: values.name,
            phone: values.phone,
            email: values.email || null,
            ...(values.password ? { password: values.password } : {}),
            operationalRole: values.operationalRole,
            ...profile,
          }
        : {
            name: values.name,
            phone: values.phone,
            username: values.phone,
            ...(values.email ? { email: values.email } : {}),
            password: values.password,
            operationalRole: values.operationalRole,
            isActive: true,
            ...Object.fromEntries(
              Object.entries(profile).filter(
                ([, value]) => value !== null && !(Array.isArray(value) && value.length === 0),
              ),
            ),
          }
      const result = await adminRequest(
        employee ? `/api/users/personnel/${encodeURIComponent(employee.id)}` : '/api/users',
        {
          method: employee ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!result.doc?.id || result.doc.operationalRole !== values.operationalRole)
        throw new AdminError(403, {})
      const removed = (employee?.resume ?? [])
        .map(fileRef)
        .filter((file) => !keptFiles.some((kept) => kept.id === file.id))
      if (removed.length) void discardPersonnelFiles(removed.map((file) => file.id))
      router.push(`/dashboard/employees?saved=${employee ? 'updated' : 'created'}`)
    } catch (error) {
      toast.error(employee ? 'ذخیره تغییرات کارمند انجام نشد.' : 'افزودن کارمند انجام نشد.')
      if (uploaded.length) void discardPersonnelFiles(uploaded)
      setFailure(error)
      if (error instanceof AdminError && Array.isArray(error.data.errors)) {
        for (const item of error.data.errors as { data?: { errors?: { path?: string }[] } }[]) {
          for (const field of item.data?.errors ?? []) {
            if (field.path && field.path in values)
              setError(
                field.path as keyof EmployeeValues,
                { message: 'این مقدار معتبر یا یکتا نیست.' },
                { shouldFocus: true },
              )
          }
        }
      }
    }
  }

  const field = (
    name: 'phone' | 'email' | 'password' | 'name' | 'age' | 'degree' | 'activityField',
    label: string,
    extra?: {
      type?: string
      placeholder: string
      autoComplete?: string
      inputMode?: 'numeric' | 'tel' | 'email'
    },
  ) => (
    <FormField id={name} label={label} error={errors[name]?.message}>
      <Input
        id={name}
        type={extra?.type ?? 'text'}
        placeholder={extra?.placeholder}
        autoComplete={extra?.autoComplete}
        inputMode={extra?.inputMode}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        variant={errors[name] ? 'error' : 'default'}
        {...register(name)}
      />
    </FormField>
  )

  return (
    <>
      <Breadcrumb
        title={title}
        action={
          <Button type="submit" form={formId} size="48" disabled={isSubmitting || stale}>
            <Typography as="span" variant="20/regular" className="text-inherit">
              {isSubmitting ? 'در حال ثبت...' : 'ثبت اطلاعات'}
            </Typography>
          </Button>
        }
      />
      <form
        id={formId}
        aria-label="اطلاعات کارمند"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (busy.current) return
          busy.current = true
          void handleSubmit(save)(event).finally(() => {
            busy.current = false
          })
        }}
        className="flex flex-col gap-5"
      >
        {failure !== null && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-error-50 bg-error-50 p-3">
            <RequestError
              error={failure}
              returnTo={`/dashboard/employees${employee ? `/${employee.id}/edit` : '/new'}`}
            />
            {employee && stale && (
              <Button
                size="40"
                type="button"
                variant="outline-gray"
                onClick={async () => {
                  try {
                    onReloaded(await loadEmployee(String(employee.id)))
                  } catch (error) {
                    setFailure(error)
                  }
                }}
              >
                <Typography as="span" variant="14/regular" className="text-inherit">
                  بررسی نسخه جدید
                </Typography>
              </Button>
            )}
          </div>
        )}
        <fieldset disabled={isSubmitting} className="flex min-w-0 flex-col gap-5">
          <Section title="اطلاعات حساب">
            {field('phone', 'شماره تلفن همراه', {
              placeholder: '۰۹۱۲۳۴۵۶۷۸۹',
              inputMode: 'tel',
              autoComplete: 'off',
            })}
            {field('email', 'آدرس ایمیل', {
              type: 'email',
              placeholder: 'example@mail.com',
              inputMode: 'email',
              autoComplete: 'off',
            })}
            {field('password', 'رمز عبور', {
              type: 'password',
              placeholder: employee ? 'برای تغییر، رمز جدید را وارد کنید' : 'حداقل ۳ نویسه',
              autoComplete: 'new-password',
            })}
          </Section>

          <Section title="اطلاعات پایه">
            {field('name', 'نام و نام خانوادگی', { placeholder: 'مثلا: علی محمدی' })}
            <FormField
              id="operationalRole"
              label="نقش در سیستم"
              error={errors.operationalRole?.message}
            >
              <NativeSelect
                id="operationalRole"
                aria-invalid={!!errors.operationalRole}
                aria-describedby={errors.operationalRole ? 'operationalRole-error' : undefined}
                {...register('operationalRole')}
              >
                <option value="" disabled>
                  نقش را انتخاب کنید
                </option>
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {OPERATIONAL_ROLE_LABELS[role]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {field('age', 'سن', { placeholder: 'مثلا: ۳۲', inputMode: 'numeric' })}
            <FormField id="gender" label="جنسیت" error={errors.gender?.message}>
              <NativeSelect id="gender" {...register('gender')}>
                <option value="">انتخاب نشده</option>
                {PERSONNEL_GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {PERSONNEL_GENDER_LABELS[gender]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {field('degree', 'مدرک دانشگاهی', {
              placeholder: 'مثلا: کارشناسی ارشد مدیریت بازرگانی',
            })}
            <FormField id="resume" label="فایل رزومه" error={fileError ?? undefined}>
              <ResumeList
                id="resume-files"
                files={[...keptFiles, ...newFiles]}
                onRemove={(index) =>
                  index < keptFiles.length
                    ? setKeptFiles((current) => current.filter((_, at) => at !== index))
                    : setNewFiles((current) =>
                        current.filter((_, at) => at !== index - keptFiles.length),
                      )
                }
              />
              <FileInput
                ref={fileInput}
                id="resume"
                multiple
                accept={Object.values(RESUME_TYPES).join(',')}
                className="sr-only"
                onChange={(event) => addFiles(event.target.files)}
              />
              <Button
                type="button"
                variant="gray"
                size="32"
                className="self-start"
                onClick={() => fileInput.current?.click()}
              >
                <Typography as="span" variant="14/regular" className="text-inherit">
                  افزودن فایل (PDF یا Word، حداکثر ۱۰ مگابایت)
                </Typography>
                <DashboardAddIcon className="size-5" />
              </Button>
            </FormField>
            {field('activityField', 'زمینه فعالیت', { placeholder: 'مثلا: فناوری اطلاعات' })}
          </Section>

          <Section
            title="آدرس ها"
            action={
              <Button
                type="button"
                variant="gray"
                size="32"
                onClick={() => addresses.append({ address: '' }, { shouldFocus: true })}
              >
                <Typography as="span" variant="14/regular" className="text-inherit">
                  آدرس جدید
                </Typography>
                <DashboardAddIcon className="size-5" />
              </Button>
            }
          >
            {addresses.fields.map((item, index) => (
              <div key={item.id} className="flex items-end gap-2 md:col-span-2">
                <FormField
                  id={`address-${index}`}
                  label={`آدرس ${(index + 1).toLocaleString('fa-IR')}`}
                  className="flex-1"
                >
                  <Input
                    id={`address-${index}`}
                    placeholder="استان، شهر، خیابان، پلاک"
                    {...register(`personnelAddresses.${index}.address`)}
                  />
                </FormField>
                <Button
                  type="button"
                  variant="text-gray"
                  size="icon-40"
                  aria-label={`حذف آدرس ${(index + 1).toLocaleString('fa-IR')}`}
                  onClick={() => addresses.remove(index)}
                >
                  <DashboardTrashIcon className="size-5" />
                </Button>
              </div>
            ))}
          </Section>
        </fieldset>
      </form>
    </>
  )
}
