'use client'

import { useEffect, useRef, useState } from 'react'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { DashboardAddIcon, DashboardTrashIcon } from '@/components/icons/generated'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  fetchProfileDossier,
  updateProfileDossier,
  type AbsenceField,
  type CertificateLicenceDto,
  type CompanyDossierDto,
  type DossierResponseDto,
  type KeyMemberDto,
  type PastProjectCustomerDto,
} from '@/utilities/dashboard-api'
import { hasStaleDossierSlice } from '@/utilities/dossier-edits'
import { ProfileDialog } from './profile-dialog'

const emptyDossier: CompanyDossierDto = {
  legalEntityType: '',
  knowledgeBasedStatus: '',
  classification: '',
  foundingYear: '',
  activityDomain: '',
  website: '',
  centerEstablishment: '',
  insuredEmployeeCount: null,
  productsServices: [],
  keyMembers: [],
  pastProjectsCustomers: [],
  requestedServices: [],
  certificatesLicenses: [],
  notAvailable: [],
}

interface ResumeProfileViewProps {
  initialDossier?: DossierResponseDto
  companyId?: string | null
}

export function ResumeProfileView({ initialDossier, companyId }: ResumeProfileViewProps) {
  const [dossier, setDossier] = useState<CompanyDossierDto>(initialDossier?.dossier ?? emptyDossier)
  const [isLoading, setIsLoading] = useState(!initialDossier)
  const [isSaving, setIsSaving] = useState(false)
  const saveLock = useRef(false)
  const [loaded, setLoaded] = useState(Boolean(initialDossier))
  const [pendingDocuments, setPendingDocuments] = useState<Record<string, boolean>>({})
  const documentsPending = Object.values(pendingDocuments).some(Boolean)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Products dialog state
  const [productDialog, setProductDialog] = useState(false)
  const [newProduct, setNewProduct] = useState('')

  // Key Member dialog state
  const [memberDialog, setMemberDialog] = useState(false)
  const [memberForm, setMemberForm] = useState<KeyMemberDto>({ name: '', role: '' })

  // Past project dialog state
  const [projectDialog, setProjectDialog] = useState(false)
  const [projectForm, setProjectForm] = useState<PastProjectCustomerDto>({
    project: '',
    customer: '',
    summary: '',
  })

  // Requested service dialog state
  const [requestedDialog, setRequestedDialog] = useState(false)
  const [newRequestedService, setNewRequestedService] = useState('')

  // Certificate dialog state
  const [certDialog, setCertDialog] = useState(false)
  const [certForm, setCertForm] = useState<CertificateLicenceDto>({
    title: '',
    issuer: '',
    reference: '',
  })

  useEffect(() => {
    if (initialDossier) return
    let active = true
    fetchProfileDossier()
      .then((res) => {
        if (!res?.dossier) throw new Error('dossier_load_failed')
        if (!active) return
        setDossier(res.dossier)
        setLoaded(true)
      })
      .catch(() => {
        if (active) setError('دریافت اطلاعات رزومه انجام نشد.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [initialDossier])

  const saveDossierSlice = async (update: Partial<CompanyDossierDto>): Promise<boolean> => {
    if (!loaded || saveLock.current || documentsPending) return false
    saveLock.current = true
    setIsSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const latest = await fetchProfileDossier()
      if (!latest) throw new Error('dossier_load_failed')
      // Array endpoints replace a slice. Refuse to overwrite a slice changed since it was shown.
      if (hasStaleDossierSlice(dossier, latest.dossier, update)) {
        setDossier(latest.dossier)
        setError('اطلاعات این بخش تغییر کرده است. نسخه تازه را بررسی و دوباره تلاش کنید.')
        return false
      }
      const res = await updateProfileDossier(update)
      if (!res?.dossier) throw new Error('update_failed')
      setDossier(res.dossier)
      setSuccess('تغییرات با موفقیت ذخیره شد.')
      return true
    } catch {
      setError('ذخیره تغییرات انجام نشد. ورودی‌ها را بررسی کنید.')
      return false
    } finally {
      saveLock.current = false
      setIsSaving(false)
    }
  }

  const toggleAbsence = async (field: AbsenceField) => {
    const isCurrentlyAbsent = dossier.notAvailable.includes(field)
    let nextAbsence: AbsenceField[]
    if (isCurrentlyAbsent) {
      nextAbsence = dossier.notAvailable.filter((f) => f !== field)
    } else {
      nextAbsence = [...dossier.notAvailable, field]
    }

    const payload: Partial<CompanyDossierDto> = { notAvailable: nextAbsence }
    if (!isCurrentlyAbsent) {
      if (field === 'pastProjectsCustomers') payload.pastProjectsCustomers = []
      if (field === 'requestedServices') payload.requestedServices = []
      if (field === 'certificatesLicenses') payload.certificatesLicenses = []
    }
    await saveDossierSlice(payload)
  }

  // 1. Products / Services
  const addProduct = async () => {
    const val = newProduct.trim()
    if (!val) {
      setError('عنوان محصول یا خدمت الزامی است.')
      return
    }
    const updated = [...dossier.productsServices, val]
    const ok = await saveDossierSlice({ productsServices: updated })
    if (ok) {
      setNewProduct('')
      setProductDialog(false)
    }
  }

  const removeProduct = async (index: number) => {
    const updated = dossier.productsServices.filter((_, i) => i !== index)
    await saveDossierSlice({ productsServices: updated })
  }

  // 2. Key members
  const addMember = async () => {
    if (!memberForm.name.trim() || !memberForm.role.trim()) {
      setError('نام و سمت عضو کلیدی الزامی است.')
      return
    }
    const updated = [
      ...dossier.keyMembers,
      { name: memberForm.name.trim(), role: memberForm.role.trim() },
    ]
    const ok = await saveDossierSlice({ keyMembers: updated })
    if (ok) {
      setMemberDialog(false)
      setMemberForm({ name: '', role: '' })
    }
  }

  const removeMember = async (index: number) => {
    const updated = dossier.keyMembers.filter((_, i) => i !== index)
    await saveDossierSlice({ keyMembers: updated })
  }

  // 3. Past projects
  const addProject = async () => {
    if (!projectForm.project.trim()) {
      setError('عنوان پروژه الزامی است.')
      return
    }
    const item: PastProjectCustomerDto = {
      project: projectForm.project.trim(),
      ...(projectForm.customer?.trim() ? { customer: projectForm.customer.trim() } : {}),
      ...(projectForm.summary?.trim() ? { summary: projectForm.summary.trim() } : {}),
    }
    const updated = [...dossier.pastProjectsCustomers, item]
    const ok = await saveDossierSlice({ pastProjectsCustomers: updated })
    if (ok) {
      setProjectDialog(false)
      setProjectForm({ project: '', customer: '', summary: '' })
    }
  }

  const removeProject = async (index: number) => {
    const updated = dossier.pastProjectsCustomers.filter((_, i) => i !== index)
    await saveDossierSlice({ pastProjectsCustomers: updated })
  }

  // 4. Requested services
  const addRequestedService = async () => {
    const val = newRequestedService.trim()
    if (!val) {
      setError('عنوان خدمت الزامی است.')
      return
    }
    const updated = [...dossier.requestedServices, val]
    const ok = await saveDossierSlice({ requestedServices: updated })
    if (ok) {
      setNewRequestedService('')
      setRequestedDialog(false)
    }
  }

  const removeRequestedService = async (index: number) => {
    const updated = dossier.requestedServices.filter((_, i) => i !== index)
    await saveDossierSlice({ requestedServices: updated })
  }

  // 5. Certificates
  const addCertificate = async () => {
    if (!certForm.title.trim()) {
      setError('عنوان گواهی یا مجوز الزامی است.')
      return
    }
    const item: CertificateLicenceDto = {
      title: certForm.title.trim(),
      ...(certForm.issuer?.trim() ? { issuer: certForm.issuer.trim() } : {}),
      ...(certForm.reference?.trim() ? { reference: certForm.reference.trim() } : {}),
    }
    const updated = [...dossier.certificatesLicenses, item]
    const ok = await saveDossierSlice({ certificatesLicenses: updated })
    if (ok) {
      setCertDialog(false)
      setCertForm({ title: '', issuer: '', reference: '' })
    }
  }

  const removeCertificate = async (index: number) => {
    const updated = dossier.certificatesLicenses.filter((_, i) => i !== index)
    await saveDossierSlice({ certificatesLicenses: updated })
  }

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6" dir="rtl">
        <div className="flex flex-col gap-2">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            رزومه و سوابق شرکت
          </Typography>
          <Typography variant="14/regular" color="neutral-400">
            اطلاعات تکمیلی، محصولات، اعضای کلیدی و سوابق کاری جهت ارائه به داوران و دبیرخانه.
          </Typography>
        </div>
        <div className="flex w-full flex-col gap-5" role="status">
          <Typography as="span" className="sr-only">
            در حال بارگذاری رزومه…
          </Typography>
          <div className="h-48 w-full rounded-2xl bg-neutral-100" />
          <div className="h-48 w-full rounded-2xl bg-neutral-100" />
          <div className="h-48 w-full rounded-2xl bg-neutral-100" />
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4" dir="rtl">
        <Typography role="alert" color="error">
          {error ?? 'دریافت اطلاعات رزومه انجام نشد.'}
        </Typography>
        <Button type="button" onClick={() => window.location.reload()}>
          <Typography>تلاش دوباره</Typography>
        </Button>
      </div>
    )
  }

  const isProjectsAbsent = dossier.notAvailable.includes('pastProjectsCustomers')
  const isRequestedAbsent = dossier.notAvailable.includes('requestedServices')
  const isCertsAbsent = dossier.notAvailable.includes('certificatesLicenses')
  const isCataloguesAbsent = dossier.notAvailable.includes('catalogues')

  return (
    <fieldset
      disabled={isSaving || documentsPending}
      className="flex w-full min-w-0 flex-col gap-6"
      dir="rtl"
    >
      <div className="flex flex-col gap-2">
        <Typography as="h2" variant="20/bold" color="neutral-600">
          رزومه و سوابق شرکت
        </Typography>
        <Typography variant="14/regular" color="neutral-400">
          اطلاعات تکمیلی، محصولات، اعضای کلیدی و سوابق کاری جهت ارائه به داوران و دبیرخانه.
        </Typography>
      </div>

      {error && (
        <Typography
          role="alert"
          variant="14/regular"
          color="error"
          className="rounded-xl bg-error-50 p-4"
        >
          {error}
        </Typography>
      )}

      {success && (
        <Typography
          role="status"
          variant="14/regular"
          className="rounded-xl bg-success-50 p-4 text-success-700"
        >
          {success}
        </Typography>
      )}

      {/* 1. محصولات و خدمات */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              محصولات و خدمات
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              محصولات، خدمات یا دستاوردهای شاخص شرکت را وارد کنید (حداقل یک مورد الزامی است).
            </Typography>
          </div>
          <Button type="button" variant="gray" size="32" onClick={() => setProductDialog(true)}>
            <DashboardAddIcon className="size-4" />
            <Typography>محصول جدید</Typography>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {dossier.productsServices.length === 0 && (
            <Typography color="neutral-400" variant="14/regular">
              هنوز محصول یا خدمتی ثبت نشده است.
            </Typography>
          )}
          {dossier.productsServices.map((product, index) => (
            <div
              key={`${product}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5"
            >
              <Typography variant="14/semibold" color="neutral-700">
                {product}
              </Typography>
              <Button
                variant="text-gray"
                size="icon-32"
                type="button"
                aria-label={`حذف ${product}`}
                className="text-neutral-400 hover:text-error-500"
                onClick={() => removeProduct(index)}
                disabled={isSaving}
              >
                <DashboardTrashIcon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* 2. اعضای کلیدی */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              اعضای کلیدی
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              اعضای کلیدی، مدیران فنی و متخصصان شرکت را معرفی کنید (اختیاری).
            </Typography>
          </div>
          <Button type="button" variant="gray" size="32" onClick={() => setMemberDialog(true)}>
            <DashboardAddIcon className="size-4" />
            <Typography>عضو جدید</Typography>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {dossier.keyMembers.length === 0 && (
            <Typography color="neutral-400" variant="14/regular" className="col-span-full">
              عضو کلیدی ثبت نشده است.
            </Typography>
          )}
          {dossier.keyMembers.map((member, index) => (
            <div
              key={`${member.name}-${index}`}
              className="flex items-center justify-between rounded-xl border border-neutral-100 p-3"
            >
              <div className="flex flex-col gap-0.5">
                <Typography variant="16/semibold" color="neutral-700">
                  {member.name}
                </Typography>
                <Typography variant="12/regular" color="neutral-400">
                  {member.role}
                </Typography>
              </div>
              <Button
                type="button"
                variant="text-gray"
                size="icon-40"
                onClick={() => removeMember(index)}
                aria-label={`حذف ${member.name}`}
              >
                <DashboardTrashIcon className="size-5 text-neutral-400 hover:text-error-500" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* 3. سوابق پروژه‌ها و مشتریان */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              سوابق پروژه‌ها و مشتریان
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              پروژه‌ها و قراردادهای شاخص قبلی شرکت.
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Typography as="label" className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isProjectsAbsent}
                onChange={() => toggleAbsence('pastProjectsCustomers')}
                className="size-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              <Typography variant="14/regular" color="neutral-500">
                ندارم
              </Typography>
            </Typography>
            {!isProjectsAbsent && (
              <Button type="button" variant="gray" size="32" onClick={() => setProjectDialog(true)}>
                <DashboardAddIcon className="size-4" />
                <Typography>پروژه جدید</Typography>
              </Button>
            )}
          </div>
        </div>

        {isProjectsAbsent ? (
          <Typography
            variant="14/regular"
            color="neutral-400"
            className="rounded-xl bg-neutral-50 p-4"
          >
            ثبت شده است که شرکت سابقه پروژه یا مشتری قبلی ندارد.
          </Typography>
        ) : (
          <div className="flex flex-col gap-3">
            {dossier.pastProjectsCustomers.length === 0 && (
              <Typography color="neutral-400" variant="14/regular">
                پروژه‌ای ثبت نشده است. در صورت نداشتن، گزینه «ندارم» را علامت بزنید.
              </Typography>
            )}
            {dossier.pastProjectsCustomers.map((project, index) => (
              <div
                key={`${project.project}-${index}`}
                className="flex items-start justify-between rounded-xl border border-neutral-100 p-4"
              >
                <div className="flex flex-col gap-1">
                  <Typography variant="16/bold" color="neutral-700">
                    {project.project}
                  </Typography>
                  {project.customer && (
                    <Typography variant="14/regular" color="neutral-500">
                      کارفرما / مشتری: {project.customer}
                    </Typography>
                  )}
                  {project.summary && (
                    <Typography variant="12/regular" color="neutral-400">
                      {project.summary}
                    </Typography>
                  )}
                </div>
                <Button
                  type="button"
                  variant="text-gray"
                  size="icon-40"
                  onClick={() => removeProject(index)}
                  aria-label={`حذف ${project.project}`}
                >
                  <DashboardTrashIcon className="size-5 text-neutral-400 hover:text-error-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. خدمات مورد تقاضا */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              خدمات مورد تقاضا
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              خدمات یا حمایت‌های مورد نیاز شرکت از رویداد یا سرمایه‌گذاران.
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Typography as="label" className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isRequestedAbsent}
                onChange={() => toggleAbsence('requestedServices')}
                className="size-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              <Typography variant="14/regular" color="neutral-500">
                ندارم
              </Typography>
            </Typography>
            {!isRequestedAbsent && (
              <Button
                type="button"
                variant="gray"
                size="32"
                onClick={() => setRequestedDialog(true)}
              >
                <DashboardAddIcon className="size-4" />
                <Typography>خدمت جدید</Typography>
              </Button>
            )}
          </div>
        </div>

        {isRequestedAbsent ? (
          <Typography
            variant="14/regular"
            color="neutral-400"
            className="rounded-xl bg-neutral-50 p-4"
          >
            ثبت شده است که شرکت خدمات مورد تقاضایی ندارد.
          </Typography>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dossier.requestedServices.length === 0 && (
              <Typography color="neutral-400" variant="14/regular">
                خدمات مورد تقاضایی ثبت نشده است. در صورت نیاز موارد را اضافه کنید یا گزینه «ندارم»
                را بزنید.
              </Typography>
            )}
            {dossier.requestedServices.map((service, index) => (
              <div
                key={`${service}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5"
              >
                <Typography variant="14/semibold" color="neutral-700">
                  {service}
                </Typography>
                <button
                  type="button"
                  aria-label={`حذف ${service}`}
                  className="text-neutral-400 hover:text-error-500"
                  onClick={() => removeRequestedService(index)}
                  disabled={isSaving}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. گواهی‌ها و مجوزها */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              گواهی‌ها و مجوزها
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              مجوزهای فعالیت، رتبه‌بندی، اختراعات یا گواهینامه‌های رسمی شرکت.
            </Typography>
          </div>
          <div className="flex items-center gap-3">
            <Typography as="label" className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isCertsAbsent}
                onChange={() => toggleAbsence('certificatesLicenses')}
                className="size-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              <Typography variant="14/regular" color="neutral-500">
                ندارم
              </Typography>
            </Typography>
            {!isCertsAbsent && (
              <Button type="button" variant="gray" size="32" onClick={() => setCertDialog(true)}>
                <DashboardAddIcon className="size-4" />
                مجوز جدید
              </Button>
            )}
          </div>
        </div>

        {isCertsAbsent ? (
          <Typography
            variant="14/regular"
            color="neutral-400"
            className="rounded-xl bg-neutral-50 p-4"
          >
            ثبت شده است که شرکت گواهی یا مجوزی ندارد.
          </Typography>
        ) : (
          <div className="flex flex-col gap-4">
            {dossier.certificatesLicenses.length === 0 && (
              <Typography color="neutral-400" variant="14/regular">
                مجوزی ثبت نشده است. در صورت نداشتن گزینه «ندارم» را انتخاب کنید.
              </Typography>
            )}
            {dossier.certificatesLicenses.map((cert, index) => (
              <div
                key={`${cert.title}-${index}`}
                className="flex items-center justify-between rounded-xl border border-neutral-100 p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <Typography variant="16/semibold" color="neutral-700">
                    {cert.title}
                  </Typography>
                  <Typography variant="12/regular" color="neutral-400">
                    {[cert.issuer, cert.reference].filter(Boolean).join(' · ')}
                  </Typography>
                </div>
                <Button
                  type="button"
                  variant="text-gray"
                  size="icon-40"
                  onClick={() => removeCertificate(index)}
                  aria-label={`حذف ${cert.title}`}
                >
                  <DashboardTrashIcon className="size-5 text-neutral-400 hover:text-error-500" />
                </Button>
              </div>
            ))}

            {/* فایل مدارک گواهی‌ها */}
            <div className="pt-2">
              <PrivateDocumentField
                category="certificatesLicenses"
                label="فایل گواهی‌ها و مجوزها"
                companyId={companyId ?? undefined}
                canUpload={Boolean(companyId)}
                canDelete
                disabled={isSaving}
                onPendingChange={(pending) =>
                  setPendingDocuments((current) =>
                    current.certificatesLicenses === pending
                      ? current
                      : { ...current, certificatesLicenses: pending },
                  )
                }
              />
            </div>
          </div>
        )}
      </section>

      {/* 6. کاتالوگ شرکت */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              کاتالوگ و معرفی شرکت
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              فایل معرفی محصولات، خدمات یا کاتالوگ رسمی شرکت (Word یا PDF).
            </Typography>
          </div>
          <Typography as="label" className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isCataloguesAbsent}
              onChange={() => toggleAbsence('catalogues')}
              className="size-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
            <Typography variant="14/regular" color="neutral-500">
              ندارم
            </Typography>
          </Typography>
        </div>

        {isCataloguesAbsent ? (
          <Typography
            variant="14/regular"
            color="neutral-400"
            className="rounded-xl bg-neutral-50 p-4"
          >
            ثبت شده است که شرکت کاتالوگ ندارد.
          </Typography>
        ) : (
          <PrivateDocumentField
            category="catalogues"
            label="فایل کاتالوگ"
            companyId={companyId ?? undefined}
            canUpload={Boolean(companyId)}
            canDelete
            disabled={isSaving}
            onPendingChange={(pending) =>
              setPendingDocuments((current) =>
                current.catalogues === pending ? current : { ...current, catalogues: pending },
              )
            }
          />
        )}
      </section>

      {/* Dialog: Product */}
      {productDialog && (
        <ProfileDialog
          title="افزودن محصول یا خدمت جدید"
          onClose={() => {
            if (!saveLock.current) setProductDialog(false)
          }}
          actions={
            <>
              <Button
                type="button"
                variant="outline-gray"
                className="flex-1"
                onClick={() => setProductDialog(false)}
              >
                <Typography>انصراف</Typography>
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                loading={isSaving}
                onClick={addProduct}
              >
                <Typography>ثبت</Typography>
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Typography as="label" variant="14/semibold" color="neutral-500">
              عنوان محصول یا خدمت
              <Input
                value={newProduct}
                placeholder="عنوان محصول یا خدمت جدید…"
                onChange={(e) => setNewProduct(e.target.value)}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
          </div>
        </ProfileDialog>
      )}

      {/* Dialog: Requested Service */}
      {requestedDialog && (
        <ProfileDialog
          title="افزودن خدمت مورد تقاضا"
          onClose={() => {
            if (!saveLock.current) setRequestedDialog(false)
          }}
          actions={
            <>
              <Button
                type="button"
                variant="outline-gray"
                className="flex-1"
                onClick={() => setRequestedDialog(false)}
              >
                <Typography>انصراف</Typography>
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                loading={isSaving}
                onClick={addRequestedService}
              >
                <Typography>ثبت</Typography>
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Typography as="label" variant="14/semibold" color="neutral-500">
              عنوان خدمت مورد تقاضا
              <Input
                value={newRequestedService}
                placeholder="خدمت مورد تقاضای جدید…"
                onChange={(e) => setNewRequestedService(e.target.value)}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
          </div>
        </ProfileDialog>
      )}

      {/* Dialog: Key member */}
      {memberDialog && (
        <ProfileDialog
          title="افزودن عضو کلیدی"
          onClose={() => {
            if (!saveLock.current) setMemberDialog(false)
          }}
          actions={
            <>
              <Button
                type="button"
                variant="outline-gray"
                className="flex-1"
                onClick={() => setMemberDialog(false)}
              >
                <Typography>انصراف</Typography>
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                loading={isSaving}
                onClick={addMember}
              >
                <Typography>ثبت</Typography>
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Typography as="label" variant="14/semibold" color="neutral-500">
              نام و نام خانوادگی
              <Input
                value={memberForm.name}
                placeholder="مثال: علی احمدی"
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
            <Typography as="label" variant="14/semibold" color="neutral-500">
              سمت / نقش
              <Input
                value={memberForm.role}
                placeholder="مثال: مدیر فنی، سرپرست تحقیق و توسعه"
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
          </div>
        </ProfileDialog>
      )}

      {/* Dialog: Project */}
      {projectDialog && (
        <ProfileDialog
          title="افزودن پروژه یا مشتری قبلی"
          onClose={() => {
            if (!saveLock.current) setProjectDialog(false)
          }}
          actions={
            <>
              <Button
                type="button"
                variant="outline-gray"
                className="flex-1"
                onClick={() => setProjectDialog(false)}
              >
                <Typography>انصراف</Typography>
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                loading={isSaving}
                onClick={addProject}
              >
                <Typography>ثبت</Typography>
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Typography as="label" variant="14/semibold" color="neutral-500">
              عنوان پروژه
              <Input
                value={projectForm.project}
                placeholder="مثال: طراحی و ساخت سامانه هوشمند پایش"
                onChange={(e) => setProjectForm({ ...projectForm, project: e.target.value })}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
            <Typography as="label" variant="14/semibold" color="neutral-500">
              کارفرما / مشتری (اختیاری)
              <Input
                value={projectForm.customer ?? ''}
                placeholder="مثال: شرکت پتروشیمی پارس"
                onChange={(e) => setProjectForm({ ...projectForm, customer: e.target.value })}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
            <Typography as="label" variant="14/semibold" color="neutral-500">
              شرح خلاصه (اختیاری)
              <Textarea
                value={projectForm.summary ?? ''}
                placeholder="توضیح کوتاه درباره دستاورد یا محدوده پروژه…"
                onChange={(e) => setProjectForm({ ...projectForm, summary: e.target.value })}
                className="mt-1 bg-white"
              />
            </Typography>
          </div>
        </ProfileDialog>
      )}

      {/* Dialog: Certificate */}
      {certDialog && (
        <ProfileDialog
          title="افزودن گواهی یا مجوز"
          onClose={() => {
            if (!saveLock.current) setCertDialog(false)
          }}
          actions={
            <>
              <Button
                type="button"
                variant="outline-gray"
                className="flex-1"
                onClick={() => setCertDialog(false)}
              >
                <Typography>انصراف</Typography>
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                loading={isSaving}
                onClick={addCertificate}
              >
                <Typography>ثبت</Typography>
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Typography as="label" variant="14/semibold" color="neutral-500">
              عنوان گواهی یا مجوز
              <Input
                value={certForm.title}
                placeholder="مثال: پروانه بهره‌برداری، ایزو ۹۰۰۱"
                onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
            <Typography as="label" variant="14/semibold" color="neutral-500">
              مرجع صادرکننده (اختیاری)
              <Input
                value={certForm.issuer ?? ''}
                placeholder="مثال: وزارت صمت، سازمان استاندارد"
                onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
            <Typography as="label" variant="14/semibold" color="neutral-500">
              شماره مرجع / سریال (اختیاری)
              <Input
                value={certForm.reference ?? ''}
                placeholder="مثال: IR-1402-998"
                onChange={(e) => setCertForm({ ...certForm, reference: e.target.value })}
                containerClassName="mt-1 bg-white"
              />
            </Typography>
          </div>
        </ProfileDialog>
      )}
    </fieldset>
  )
}
