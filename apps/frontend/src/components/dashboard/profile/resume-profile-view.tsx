'use client'

import { useEffect, useRef, useState } from 'react'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { DashboardAddIcon, DashboardCloseCircle, DashboardTrashIcon } from '@/components/icons/generated'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  fetchProfileDossier,
  updateProfileDossier,
  type CertificateLicenceDto,
  type CompanyDossierDto,
  type DossierResponseDto,
  type KeyMemberDto,
  type PastProjectCustomerDto,
  type ProductServiceDto,
} from '@/utilities/dashboard-api'
import { deleteDocument } from '@/utilities/document-api'
import { DossierItemFileLink, DossierItemFilePicker, type DossierItemFileValue } from './dossier-item-file'
import { hasStaleDossierSlice } from '@/utilities/dossier-edits'
import { ProfileDialog } from './profile-dialog'
import { toast } from 'sonner'

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

  // Products dialog state
  const [productDialog, setProductDialog] = useState(false)
  const [newProduct, setNewProduct] = useState('')
  const [productFile, setProductFile] = useState<DossierItemFileValue | null>(null)
  // True while a dialog's file is still uploading; saving waits for it.
  const [itemFilePending, setItemFilePending] = useState(false)

  // Key Member dialog state
  const [memberDialog, setMemberDialog] = useState(false)
  const emptyMember: KeyMemberDto = { name: '', role: '', education: '', degreePlace: '' }
  const [memberForm, setMemberForm] = useState<KeyMemberDto>(emptyMember)

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
  const [certTitle, setCertTitle] = useState('')
  const [certFile, setCertFile] = useState<DossierItemFileValue | null>(null)

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
    try {
      const latest = await fetchProfileDossier()
      if (!latest) throw new Error('dossier_load_failed')
      // Array endpoints replace a slice. Refuse to overwrite a slice changed since it was shown.
      if (hasStaleDossierSlice(dossier, latest.dossier, update)) {
        setDossier(latest.dossier)
        toast.error('ذخیره نشد؛ این بخش تغییر کرده است.')
        setError('اطلاعات این بخش تغییر کرده است. نسخه تازه را بررسی و دوباره تلاش کنید.')
        return false
      }
      const res = await updateProfileDossier(update)
      if (!res?.dossier) throw new Error('update_failed')
      setDossier(res.dossier)
      toast.success('تغییرات با موفقیت ذخیره شد.')
      return true
    } catch {
      toast.error('ذخیره تغییرات انجام نشد.')
      setError('ذخیره تغییرات انجام نشد. ورودی‌ها را بررسی کنید.')
      return false
    } finally {
      saveLock.current = false
      setIsSaving(false)
    }
  }

  // 1. Products / Services
  const addProduct = async () => {
    const val = newProduct.trim()
    if (!val) {
      setError('عنوان محصول یا خدمت الزامی است.')
      return
    }
    if (itemFilePending) return
    const item: ProductServiceDto = { title: val, ...(productFile ? { documentId: productFile.documentId } : {}) }
    const ok = await saveDossierSlice({ productsServices: [...dossier.productsServices, item] })
    if (ok) {
      setNewProduct('')
      setProductFile(null)
      setProductDialog(false)
    }
  }

  /** Closing a dialog without saving removes the file it uploaded. */
  const discardItemFile = (file: DossierItemFileValue | null) => {
    if (file) void deleteDocument(file.documentId).catch(() => undefined)
  }

  const closeProductDialog = () => {
    if (saveLock.current || itemFilePending) return
    discardItemFile(productFile)
    setProductFile(null)
    setNewProduct('')
    setProductDialog(false)
  }

  const removeProduct = async (index: number) => {
    const removed = dossier.productsServices[index]
    const updated = dossier.productsServices.filter((_, i) => i !== index)
    if (await saveDossierSlice({ productsServices: updated }) && removed?.documentId) {
      void deleteDocument(removed.documentId).catch(() => undefined)
    }
  }

  // 2. Key members
  const addMember = async () => {
    if (!memberForm.name.trim() || !memberForm.role.trim()) {
      setError('نام و سمت عضو کلیدی الزامی است.')
      return
    }
    const education = memberForm.education?.trim()
    const degreePlace = memberForm.degreePlace?.trim()
    const updated = [
      ...dossier.keyMembers,
      {
        name: memberForm.name.trim(),
        role: memberForm.role.trim(),
        ...(education ? { education } : {}),
        ...(degreePlace ? { degreePlace } : {}),
      },
    ]
    const ok = await saveDossierSlice({ keyMembers: updated })
    if (ok) {
      setMemberDialog(false)
      setMemberForm(emptyMember)
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
    if (!certTitle.trim()) {
      setError('عنوان گواهی یا مجوز الزامی است.')
      return
    }
    if (itemFilePending) return
    const item: CertificateLicenceDto = {
      title: certTitle.trim(),
      ...(certFile ? { documentId: certFile.documentId } : {}),
    }
    const updated = [...dossier.certificatesLicenses, item]
    const ok = await saveDossierSlice({ certificatesLicenses: updated })
    if (ok) {
      setCertDialog(false)
      setCertTitle('')
      setCertFile(null)
    }
  }

  const closeCertDialog = () => {
    if (saveLock.current || itemFilePending) return
    discardItemFile(certFile)
    setCertFile(null)
    setCertTitle('')
    setCertDialog(false)
  }

  const removeCertificate = async (index: number) => {
    const removed = dossier.certificatesLicenses[index]
    const updated = dossier.certificatesLicenses.filter((_, i) => i !== index)
    if (await saveDossierSlice({ certificatesLicenses: updated }) && removed?.documentId) {
      void deleteDocument(removed.documentId).catch(() => undefined)
    }
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
        <Button size="40" type="button" onClick={() => window.location.reload()}>
          <Typography>تلاش دوباره</Typography>
        </Button>
      </div>
    )
  }

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


      {/* 1. محصولات و خدمات */}
      <section id="resume-products" className="flex scroll-mt-6 flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
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
              key={`${product.title}-${index}`}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5"
            >
              <Typography variant="14/semibold" color="neutral-700">
                {product.title}
              </Typography>
              {product.documentId ? (
                <DossierItemFileLink documentId={product.documentId} label="فایل" />
              ) : null}
              <Button
                variant="text-destructive"
                size="icon-32"
                type="button"
                aria-label={`حذف ${product.title}`}
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
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
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
                {member.education || member.degreePlace ? (
                  <Typography variant="12/regular" color="neutral-500">
                    {[member.education, member.degreePlace].filter(Boolean).join(' · ')}
                  </Typography>
                ) : null}
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
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              سوابق پروژه‌ها و مشتریان
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              پروژه‌ها و قراردادهای شاخص قبلی شرکت.
            </Typography>
          </div>
          <Button type="button" variant="gray" size="32" onClick={() => setProjectDialog(true)}>
            <DashboardAddIcon className="size-4" />
            <Typography>پروژه جدید</Typography>
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {dossier.pastProjectsCustomers.length === 0 && (
            <Typography color="neutral-400" variant="14/regular">
              پروژه‌ای ثبت نشده است.
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
      </section>

      {/* 4. خدمات مورد تقاضا */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              خدمات مورد تقاضا
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              خدمات یا حمایت‌های مورد نیاز شرکت از رویداد یا سرمایه‌گذاران.
            </Typography>
          </div>
          <Button type="button" variant="gray" size="32" onClick={() => setRequestedDialog(true)}>
            <DashboardAddIcon className="size-4" />
            <Typography>خدمت جدید</Typography>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {dossier.requestedServices.length === 0 && (
            <Typography color="neutral-400" variant="14/regular">
              خدمات مورد تقاضایی ثبت نشده است.
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
              <Button
                type="button"
                variant="text-destructive"
                size="icon-32"
                aria-label={`حذف ${service}`}
                onClick={() => removeRequestedService(index)}
                disabled={isSaving}
              >
                <DashboardCloseCircle aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* 5. گواهی‌ها و مجوزها */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              گواهی‌ها و مجوزها
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              مجوزهای فعالیت، رتبه‌بندی، اختراعات یا گواهینامه‌های رسمی شرکت.
            </Typography>
          </div>
          <Button type="button" variant="gray" size="32" onClick={() => setCertDialog(true)}>
            <DashboardAddIcon className="size-4" />
            <Typography>افزودن</Typography>
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {dossier.certificatesLicenses.length === 0 && (
            <Typography color="neutral-400" variant="14/regular">
              مجوزی ثبت نشده است.
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
                {cert.documentId ? (
                  <DossierItemFileLink documentId={cert.documentId} label="دریافت فایل" />
                ) : null}
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
        </div>
      </section>

      {/* 6. کاتالوگ شرکت */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Typography as="h2" variant="20/bold" color="neutral-600">
              کاتالوگ و معرفی شرکت
            </Typography>
            <Typography variant="14/regular" color="neutral-400">
              فایل معرفی محصولات، خدمات یا کاتالوگ رسمی شرکت (Word یا PDF).
            </Typography>
          </div>
        </div>

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
      </section>

      {/* Dialogs: the primary action is first in the DOM, so it sits on the right in RTL. */}
      {productDialog && (
        <ProfileDialog
          title="افزودن محصول یا خدمت جدید"
          onClose={closeProductDialog}
          primary={
            <Button size="40" type="button" variant="primary" className="flex-1" loading={isSaving} disabled={itemFilePending} onClick={addProduct}>
              ثبت
            </Button>
          }
          secondary={
            <Button size="40" type="button" variant="outline-gray" className="flex-1" disabled={itemFilePending} onClick={closeProductDialog}>
              انصراف
            </Button>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Input
              label="عنوان محصول یا خدمت" aria-required="true"
              value={newProduct}
              placeholder="عنوان محصول یا خدمت جدید…"
              onChange={(e) => setNewProduct(e.target.value)}
            />
            <DossierItemFilePicker
              category="productsServices"
              companyId={companyId}
              label="فایل یا عکس محصول (اختیاری)"
              value={productFile}
              disabled={isSaving}
              onChange={setProductFile}
              onPendingChange={setItemFilePending}
            />
          </div>
        </ProfileDialog>
      )}

      {requestedDialog && (
        <ProfileDialog
          title="افزودن خدمت مورد تقاضا"
          onClose={() => {
            if (!saveLock.current) setRequestedDialog(false)
          }}
          primary={
            <Button size="40" type="button" variant="primary" className="flex-1" loading={isSaving} onClick={addRequestedService}>
              ثبت
            </Button>
          }
          secondary={
            <Button size="40" type="button" variant="outline-gray" className="flex-1" onClick={() => setRequestedDialog(false)}>
              انصراف
            </Button>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Input
              label="عنوان خدمت مورد تقاضا" aria-required="true"
              value={newRequestedService}
              placeholder="خدمت مورد تقاضای جدید…"
              onChange={(e) => setNewRequestedService(e.target.value)}
            />
          </div>
        </ProfileDialog>
      )}

      {memberDialog && (
        <ProfileDialog
          title="افزودن عضو کلیدی"
          onClose={() => {
            if (!saveLock.current) setMemberDialog(false)
          }}
          primary={
            <Button size="40" type="button" variant="primary" className="flex-1" loading={isSaving} onClick={addMember}>
              ثبت
            </Button>
          }
          secondary={
            <Button size="40" type="button" variant="outline-gray" className="flex-1" onClick={() => setMemberDialog(false)}>
              انصراف
            </Button>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Input
              label="نام و نام خانوادگی" aria-required="true"
              value={memberForm.name}
              placeholder="مثال: علی احمدی"
              onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
            />
            <Input
              label="سمت / نقش" aria-required="true"
              value={memberForm.role}
              placeholder="مثال: مدیر فنی، سرپرست تحقیق و توسعه"
              onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
            />
            <Input
              label="تحصیلات (اختیاری)"
              value={memberForm.education ?? ''}
              placeholder="مثال: کارشناسی ارشد مهندسی برق"
              onChange={(e) => setMemberForm({ ...memberForm, education: e.target.value })}
            />
            <Input
              label="محل اخذ مدرک (اختیاری)"
              value={memberForm.degreePlace ?? ''}
              placeholder="مثال: دانشگاه صنعتی شریف"
              onChange={(e) => setMemberForm({ ...memberForm, degreePlace: e.target.value })}
            />
          </div>
        </ProfileDialog>
      )}

      {projectDialog && (
        <ProfileDialog
          title="افزودن پروژه یا مشتری قبلی"
          onClose={() => {
            if (!saveLock.current) setProjectDialog(false)
          }}
          primary={
            <Button size="40" type="button" variant="primary" className="flex-1" loading={isSaving} onClick={addProject}>
              ثبت
            </Button>
          }
          secondary={
            <Button size="40" type="button" variant="outline-gray" className="flex-1" onClick={() => setProjectDialog(false)}>
              انصراف
            </Button>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Input
              label="عنوان پروژه" aria-required="true"
              value={projectForm.project}
              placeholder="مثال: طراحی و ساخت سامانه هوشمند پایش"
              onChange={(e) => setProjectForm({ ...projectForm, project: e.target.value })}
            />
            <Input
              label="کارفرما / مشتری (اختیاری)"
              value={projectForm.customer ?? ''}
              placeholder="مثال: شرکت پتروشیمی پارس"
              onChange={(e) => setProjectForm({ ...projectForm, customer: e.target.value })}
            />
            <Field>
              <FieldLabel htmlFor="resume-project-summary" className="text-base">
                شرح خلاصه (اختیاری)
              </FieldLabel>
              <Textarea
                id="resume-project-summary"
                value={projectForm.summary ?? ''}
                placeholder="توضیح کوتاه درباره دستاورد یا محدوده پروژه…"
                onChange={(e) => setProjectForm({ ...projectForm, summary: e.target.value })}
              />
            </Field>
          </div>
        </ProfileDialog>
      )}

      {certDialog && (
        <ProfileDialog
          title="افزودن گواهی یا مجوز"
          onClose={closeCertDialog}
          primary={
            <Button size="40" type="button" variant="primary" className="flex-1" loading={isSaving} disabled={itemFilePending} onClick={addCertificate}>
              ثبت
            </Button>
          }
          secondary={
            <Button size="40" type="button" variant="outline-gray" className="flex-1" disabled={itemFilePending} onClick={closeCertDialog}>
              انصراف
            </Button>
          }
        >
          <div className="flex flex-col gap-3 text-start">
            <Input
              label="عنوان گواهی یا مجوز" aria-required="true"
              value={certTitle}
              placeholder="مثال: پروانه بهره‌برداری، ایزو ۹۰۰۱"
              onChange={(e) => setCertTitle(e.target.value)}
            />
            <DossierItemFilePicker
              category="certificatesLicenses"
              companyId={companyId}
              label="فایل یا عکس گواهی (اختیاری)"
              value={certFile}
              disabled={isSaving}
              onChange={setCertFile}
              onPendingChange={setItemFilePending}
            />
          </div>
        </ProfileDialog>
      )}
    </fieldset>
  )
}
