'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import {
  DashboardAddIcon,
  DashboardEditIcon,
  DashboardTrashIcon,
} from '@/components/icons/generated'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  addAddress,
  deleteAddress,
  describeMutationFailure,
  fetchCompanyVerification,
  fetchProfileDossier,
  submitCompanyVerification,
  toEnglishDigits,
  type AbsenceField,
  type AddressDto,
  type CompanyDossierDto,
  type CompanyInfoDto,
  type CompanyVerificationDto,
  type DossierResponseDto,
  type MissingDossierItemsDto,
  type ProfileDto,
  updateAddress,
  updateProfile,
  updateProfileDossier,
} from '@/utilities/dashboard-api'
import { buildCompanyDossierPatch } from '@/utilities/dossier-edits'
import { CompanyVerificationCard, editWithdrawsVerification } from './company-verification-card'
import { InlineProfileField } from './inline-profile-field'
import { ProfileDialog } from './profile-dialog'
import { useReverificationConfirm } from './use-reverification-confirm'
import { toast } from 'sonner'

const emptyAddress: Omit<AddressDto, 'id'> = {
  title: '',
  province: '',
  city: '',
  postalCode: '',
  address: '',
}

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

const emptyMissing: MissingDossierItemsDto = {
  required: [],
  optional: [],
  canRequestVerification: false,
}

const unsubmittedVerification: CompanyVerificationDto = {
  status: 'unsubmitted',
  revision: 0,
  submittedAt: null,
  decidedAt: null,
  reason: null,
  canRequestVerification: false,
}

interface CompanyProfileViewProps {
  initialProfile: ProfileDto
  initialDossier?: DossierResponseDto
  initialVerification?: CompanyVerificationDto
}

export function CompanyProfileView({ initialProfile, initialDossier, initialVerification }: CompanyProfileViewProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [verification, setVerification] = useState<CompanyVerificationDto>(
    initialVerification ?? unsubmittedVerification,
  )
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false)
  const { confirm: confirmReverification, dialog: reverificationDialog } = useReverificationConfirm(
    verification.status,
  )
  const [basicForm, setBasicForm] = useState<CompanyInfoDto>(initialProfile.company)
  const [isEditingBasic, setIsEditingBasic] = useState(false)
  const [isSavingBasic, setIsSavingBasic] = useState(false)
  const basicSaveLock = useRef(false)
  const dossierAtEdit = useRef(initialDossier?.dossier ?? emptyDossier)
  const refreshSequence = useRef(0)
  const [dossierLoaded, setDossierLoaded] = useState(Boolean(initialDossier))
  const [pendingDocuments, setPendingDocuments] = useState<Record<string, boolean>>({})
  const documentsPending = Object.values(pendingDocuments).some(Boolean)

  const [dossier, setDossier] = useState<CompanyDossierDto>(initialDossier?.dossier ?? emptyDossier)
  const [missing, setMissing] = useState<MissingDossierItemsDto>(
    initialDossier?.missing ?? emptyMissing,
  )
  const [dossierForm, setDossierForm] = useState<CompanyDossierDto>(
    initialDossier?.dossier ?? emptyDossier,
  )

  const [addressForm, setAddressForm] = useState(emptyAddress)
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [isSavingAddress, setIsSavingAddress] = useState(false)

  const [executiveForm, setExecutiveForm] = useState({ name: '', role: '' })
  const [editingExecutiveIndex, setEditingExecutiveIndex] = useState<number | null>(null)
  const [isSavingExecutive, setIsSavingExecutive] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialDossier) return
    let active = true
    fetchProfileDossier()
      .then((res) => {
        if (!res) throw new Error('dossier_load_failed')
        if (!active) return
        setDossierLoaded(true)
        setDossier(res.dossier)
        setDossierForm(res.dossier)
        setMissing(res.missing)
      })
      .catch(() => {
        if (active) setError('دریافت اطلاعات پرونده انجام نشد. دوباره تلاش کنید.')
      })
    return () => {
      active = false
    }
  }, [initialDossier])

  // T59: every company edit may withdraw the approval, so the state is re-read after each save.
  const refreshVerification = async () => {
    try {
      setVerification(await fetchCompanyVerification())
    } catch {
      // The card keeps the last known state; the next save or reload refreshes it.
    }
  }

  useEffect(() => {
    if (initialVerification) return
    void fetchCompanyVerification().then(setVerification).catch(() => undefined)
  }, [initialVerification])

  const submitVerification = async () => {
    setIsSubmittingVerification(true)
    setError(null)
    try {
      await submitCompanyVerification()
      toast.success('پرونده برای احراز هویت ارسال شد.')
      await refreshVerification()
    } catch (cause) {
      toast.error('ارسال برای احراز هویت انجام نشد.')
      setError(describeMutationFailure(cause, 'ارسال برای احراز هویت انجام نشد. موارد الزامی پرونده را بررسی کنید.'))
      await Promise.all([refreshVerification(), refreshDossier()])
    } finally {
      setIsSubmittingVerification(false)
    }
  }

  const refreshDossier = async () => {
    const sequence = ++refreshSequence.current
    try {
      const response = await fetchProfileDossier()
      if (!response) throw new Error('dossier_load_failed')
      if (sequence !== refreshSequence.current) return response
      setDossier(response.dossier)
      setMissing(response.missing)
      // Do not replace unsaved form input during a document-list refresh.
      return response
    } catch {
      if (sequence !== refreshSequence.current) return undefined
      setDossierLoaded(false)
      setError('دریافت اطلاعات پرونده انجام نشد. دوباره تلاش کنید.')
      return undefined
    }
  }

  const startBasicEdit = () => {
    if (!dossierLoaded || basicSaveLock.current || documentsPending) return
    setBasicForm({ ...profile.company })
    setDossierForm({ ...dossier })
    dossierAtEdit.current = dossier
    setError(null)
    setIsEditingBasic(true)
  }

  /**
   * Website, growth-centre and insured-staff fields are simply left empty when the
   * company has none. An absence answer saved earlier stays until a value is typed.
   */
  const setOptionalDossierValue = (
    field: 'website' | 'centerEstablishment' | 'insuredEmployeeCount',
    value: string | number | null,
  ) => {
    const filled = value !== null && value !== ''
    const wasAbsent = dossierAtEdit.current.notAvailable.includes(field)
    const withoutField = dossierForm.notAvailable.filter((item) => item !== field)
    setDossierForm({
      ...dossierForm,
      [field]: value,
      notAvailable: !filled && wasAbsent ? [...withoutField, field] : withoutField,
    } as CompanyDossierDto)
  }

  const saveBasic = async () => {
    if (!dossierLoaded || basicSaveLock.current || documentsPending) return
    basicSaveLock.current = true
    setError(null)
    setIsSavingBasic(true)

    // Validate foundingYear if provided
    let foundingYearVal = dossierForm.foundingYear.trim()
    if (foundingYearVal) {
      foundingYearVal = toEnglishDigits(foundingYearVal)
      const yearNum = Number(foundingYearVal)
      if (!/^\d{4}$/.test(foundingYearVal) || yearNum < 1200 || yearNum > 2100) {
        setError('سال تأسیس باید یک عدد چهاررقمی معتبر (مثلاً ۱۳۸۵) باشد.')
        setIsSavingBasic(false)
        basicSaveLock.current = false
        return
      }
    }

    try {
      const latest = await fetchProfileDossier()
      if (!latest) throw new Error('dossier_load_failed')
      const count = dossierForm.insuredEmployeeCount
      if (
        !dossierForm.notAvailable.includes('insuredEmployeeCount') &&
        count !== null &&
        (!Number.isSafeInteger(count) || count < 0)
      ) {
        setError('تعداد کارکنان باید عدد صحیح نامنفی و معتبر باشد.')
        return
      }
      const dossierPatch = buildCompanyDossierPatch(
        dossierAtEdit.current,
        { ...dossierForm, foundingYear: foundingYearVal },
        latest.dossier,
      )
      const companyPatch: Partial<CompanyInfoDto> = {}
      for (const field of Object.keys(basicForm) as (keyof CompanyInfoDto)[]) {
        if (basicForm[field] !== profile.company[field]) companyPatch[field] = basicForm[field]
      }
      if (
        (Object.keys(companyPatch).length > 0 || Object.keys(dossierPatch).length > 0) &&
        !(await confirmReverification())
      ) return

      const updatedProfile = await updateProfile({
        company: companyPatch,
        dossier: dossierPatch,
      })
      if (!updatedProfile) throw new Error('profile_update_failed')
      setProfile(updatedProfile)
      setBasicForm(updatedProfile.company)
      setIsEditingBasic(false)
      toast.success('اطلاعات شرکت ذخیره شد.')
      void refreshVerification()

      const updatedDossier = await refreshDossier()
      if (updatedDossier) setDossierForm(updatedDossier.dossier)
    } catch (cause) {
      toast.error('ذخیره اطلاعات شرکت انجام نشد.')
      setError(describeMutationFailure(cause, 'ذخیره اطلاعات انجام نشد. ورودی‌ها را بررسی کنید.'))
    } finally {
      basicSaveLock.current = false
      setIsSavingBasic(false)
    }
  }

  const openNewAddress = () => {
    setAddressForm(emptyAddress)
    setEditingAddressId(null)
    setError(null)
    setAddressDialogOpen(true)
  }

  const openAddressEdit = (address: AddressDto) => {
    setAddressForm({
      title: address.title,
      province: address.province,
      city: address.city,
      postalCode: address.postalCode,
      address: address.address,
    })
    setEditingAddressId(address.id)
    setError(null)
    setAddressDialogOpen(true)
  }

  const saveAddress = async () => {
    if (!addressForm.title.trim() || !addressForm.address.trim()) {
      setError('نام و متن آدرس الزامی است.')
      return
    }

    if (!(await confirmReverification())) return
    setError(null)
    setIsSavingAddress(true)
    try {
      const result = editingAddressId
        ? await updateAddress(editingAddressId, addressForm)
        : await addAddress(addressForm)
      if (!result?.address) throw new Error('address_update_failed')

      setProfile((current) => ({
        ...current,
        addresses: editingAddressId
          ? current.addresses.map((address) =>
              address.id === editingAddressId ? result.address : address,
            )
          : [...current.addresses, result.address],
      }))
      setAddressDialogOpen(false)
      toast.success(editingAddressId ? 'آدرس ویرایش شد.' : 'آدرس اضافه شد.')
      await Promise.all([refreshDossier(), refreshVerification()])
    } catch {
      toast.error(editingAddressId ? 'ویرایش آدرس انجام نشد.' : 'افزودن آدرس انجام نشد.')
      setError(editingAddressId ? 'ویرایش آدرس انجام نشد.' : 'افزودن آدرس انجام نشد.')
    } finally {
      setIsSavingAddress(false)
    }
  }

  const removeAddress = async (id: string) => {
    if (!(await confirmReverification())) return
    setError(null)
    try {
      await deleteAddress(id)
      setProfile((current) => ({
        ...current,
        addresses: current.addresses.filter((address) => address.id !== id),
      }))
      toast.success('آدرس حذف شد.')
      await Promise.all([refreshDossier(), refreshVerification()])
    } catch {
      toast.error('حذف آدرس انجام نشد.')
      setError('حذف آدرس انجام نشد.')
    }
  }

  const openExecutive = (index?: number) => {
    setExecutiveForm(
      index === undefined ? { name: '', role: '' } : { ...profile.executives[index] },
    )
    setEditingExecutiveIndex(index ?? -1)
    setError(null)
  }

  const saveExecutive = async () => {
    if (!executiveForm.name.trim() || !executiveForm.role.trim()) {
      setError('نام و سمت شخص الزامی است.')
      return
    }

    const executives = [...profile.executives]
    if (editingExecutiveIndex === -1) executives.push(executiveForm)
    else if (editingExecutiveIndex !== null) executives[editingExecutiveIndex] = executiveForm

    if (!(await confirmReverification())) return
    setError(null)
    setIsSavingExecutive(true)
    try {
      const updated = await updateProfile({ executives })
      if (!updated) throw new Error('executive_update_failed')
      setProfile(updated)
      setEditingExecutiveIndex(null)
      toast.success('اطلاعات شخص ذخیره شد.')
      await refreshVerification()
    } catch {
      toast.error('ذخیره شخص انجام نشد.')
      setError('ذخیره شخص انجام نشد.')
    } finally {
      setIsSavingExecutive(false)
    }
  }

  const removeExecutive = async (index: number) => {
    if (!(await confirmReverification())) return
    setError(null)
    try {
      const updated = await updateProfile({
        executives: profile.executives.filter((_, itemIndex) => itemIndex !== index),
      })
      if (!updated) throw new Error('executive_delete_failed')
      setProfile(updated)
      toast.success('شخص حذف شد.')
      await refreshVerification()
    } catch {
      toast.error('حذف شخص انجام نشد.')
      setError('حذف شخص انجام نشد.')
    }
  }

  const displayedDossier = isEditingBasic ? dossierForm : dossier
  const isWebsiteAbsent = !isEditingBasic && displayedDossier.notAvailable.includes('website')
  const isCenterAbsent = !isEditingBasic && displayedDossier.notAvailable.includes('centerEstablishment')
  const isInsuredAbsent = !isEditingBasic && displayedDossier.notAvailable.includes('insuredEmployeeCount')

  if (!dossierLoaded) {
    return (
      <div className="flex flex-col gap-4" dir="rtl">
        <Typography role={error ? 'alert' : 'status'} color={error ? 'error' : 'neutral-500'}>
          {error ?? 'در حال دریافت اطلاعات پرونده…'}
        </Typography>
        {error && (
          <Button size="40" type="button" onClick={() => window.location.reload()}>
            <Typography>تلاش دوباره</Typography>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {error && (
        <Typography role="alert" color="error" className="rounded-xl bg-error-50 p-4">
          {error}
        </Typography>
      )}

      <CompanyVerificationCard
        verification={verification}
        missing={missing}
        companyName={profile.company.name}
        nationalId={profile.company.nationalId}
        submitting={isSubmittingVerification}
        onSubmit={() => void submitVerification()}
      />

      <div className="relative size-20 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100 shadow-2xs">
        <Image
          src="/figma/dashboard/profile-avatar.png"
          alt="Company Profile Avatar"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* اطلاعات پایه و دوسیه شرکت */}
      <fieldset
        id="company-basic"
        disabled={isSavingBasic}
        className="flex scroll-mt-6 flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6"
      >
        <div className="flex items-center justify-between">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            اطلاعات پایه
          </Typography>
          <Button
            type="button"
            variant={isEditingBasic ? 'primary' : 'gray'}
            size="32"
            loading={isSavingBasic}
            disabled={documentsPending}
            onClick={isEditingBasic ? saveBasic : startBasicEdit}
          >
            {!isEditingBasic && <DashboardEditIcon className="size-5" />}
            <Typography>{isEditingBasic ? 'ذخیره' : 'ویرایش'}</Typography>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <InlineProfileField
              label="نام شرکت"
              required
              placeholder="نام شرکت را وارد کنید"
              value={basicForm.name}
              editing={isEditingBasic}
              onChange={(name) => setBasicForm({ ...basicForm, name })}
            />
            <InlineProfileField
              label="شناسه ملی"
              value={basicForm.nationalId}
              editing={false}
              dir="ltr"
              onChange={() => {}}
            />
            <InlineProfileField
              label="شماره ثبت"
              required
              placeholder="شماره ثبت شرکت"
              value={basicForm.registrationNumber}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(registrationNumber) => setBasicForm({ ...basicForm, registrationNumber })}
            />
            <InlineProfileField
              label="کد اقتصادی"
              placeholder="کد اقتصادی ۱۲ رقمی"
              value={basicForm.economicCode}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(economicCode) => setBasicForm({ ...basicForm, economicCode })}
            />
            <InlineProfileField
              label="وضعیت شرکت"
              required
              placeholder="مثال: فعال"
              value={basicForm.status}
              editing={isEditingBasic}
              onChange={(status) => setBasicForm({ ...basicForm, status })}
            />
            <InlineProfileField
              label="نوع شرکت (مرحله اول)"
              placeholder="نوع شرکت"
              value={basicForm.type}
              editing={isEditingBasic}
              onChange={(type) => setBasicForm({ ...basicForm, type })}
            />
            <InlineProfileField
              label="تاریخ تاسیس"
              placeholder="مثال: ۱۳۸۵/۰۱/۱۵"
              value={basicForm.establishmentDate}
              editing={isEditingBasic}
              dir="auto"
              onChange={(establishmentDate) => setBasicForm({ ...basicForm, establishmentDate })}
            />
          </div>

          <div className="flex flex-col gap-4">
            <InlineProfileField
              label="نوع شخصیت حقوقی (سهامی خاص / عام / با مسئولیت محدود / ...)"
              required
              placeholder="مثال: سهامی خاص"
              value={
                isEditingBasic ? dossierForm.legalEntityType : dossier.legalEntityType || 'ثبت نشده'
              }
              editing={isEditingBasic}
              onChange={(legalEntityType) => setDossierForm({ ...dossierForm, legalEntityType })}
            />
            <InlineProfileField
              label="وضعیت دانش‌بنیانی (دانش‌بنیان نوع یک / دو / نوپا / غیر دانش‌بنیان)"
              required
              placeholder="مثال: دانش‌بنیان نوع یک"
              value={
                isEditingBasic
                  ? dossierForm.knowledgeBasedStatus
                  : dossier.knowledgeBasedStatus || 'ثبت نشده'
              }
              editing={isEditingBasic}
              onChange={(knowledgeBasedStatus) =>
                setDossierForm({ ...dossierForm, knowledgeBasedStatus })
              }
            />
            <InlineProfileField
              label="طبقه‌بندی شرکت (نوپا / فناور / صنعتی / ...)"
              required
              placeholder="مثال: فناور"
              value={
                isEditingBasic ? dossierForm.classification : dossier.classification || 'ثبت نشده'
              }
              editing={isEditingBasic}
              onChange={(classification) => setDossierForm({ ...dossierForm, classification })}
            />
            <InlineProfileField
              label="سال تأسیس (عدد ۴ رقمی مثلاً ۱۳۸۵)"
              required
              placeholder="مثال: ۱۳۸۵"
              value={isEditingBasic ? dossierForm.foundingYear : dossier.foundingYear || 'ثبت نشده'}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(foundingYear) => setDossierForm({ ...dossierForm, foundingYear })}
            />
            <InlineProfileField
              label="حوزه فعالیت اصلی"
              required
              placeholder="مثال: هوش مصنوعی"
              value={
                isEditingBasic ? dossierForm.activityDomain : dossier.activityDomain || 'ثبت نشده'
              }
              editing={isEditingBasic}
              onChange={(activityDomain) => setDossierForm({ ...dossierForm, activityDomain })}
            />

            {/* وبسایت (اختیاری؛ در صورت نداشتن خالی بماند) */}
            <div className="flex flex-col gap-1 rounded-lg border border-neutral-100 p-2">
              <div className="flex items-center justify-between">
                <Typography variant="14/semibold" color="neutral-500">
                  وب‌سایت رسمی
                </Typography>
              </div>
              {isWebsiteAbsent ? (
                <Typography variant="14/regular" color="neutral-400" className="py-2">
                  ندارد
                </Typography>
              ) : (
                <Input
                  dir="ltr"
                  value={isEditingBasic ? dossierForm.website : dossier.website}
                  readOnly={!isEditingBasic}
                  placeholder="https://example.com"
                  onChange={(e) => setOptionalDossierValue('website', e.target.value)}
                  containerClassName={
                    isEditingBasic
                      ? 'bg-background'
                      : 'border-transparent bg-transparent p-0 hover:border-transparent'
                  }
                />
              )}
            </div>

            {/* استقرار در پارک/مرکز رشد */}
            <div className="flex flex-col gap-1 rounded-lg border border-neutral-100 p-2">
              <div className="flex items-center justify-between">
                <Typography variant="14/semibold" color="neutral-500">
                  استقرار در مرکز رشد / پارک علم و فناوری
                </Typography>
              </div>
              {isCenterAbsent ? (
                <Typography variant="14/regular" color="neutral-400" className="py-2">
                  ندارد
                </Typography>
              ) : (
                <Input
                  value={
                    isEditingBasic ? dossierForm.centerEstablishment : dossier.centerEstablishment
                  }
                  readOnly={!isEditingBasic}
                  placeholder="نام پارک یا مرکز رشد…"
                  onChange={(e) => setOptionalDossierValue('centerEstablishment', e.target.value)}
                  containerClassName={
                    isEditingBasic
                      ? 'bg-background'
                      : 'border-transparent bg-transparent p-0 hover:border-transparent'
                  }
                />
              )}
            </div>

            {/* تعداد پرسنل بیمه‌شده */}
            <div className="flex flex-col gap-1 rounded-lg border border-neutral-100 p-2">
              <div className="flex items-center justify-between">
                <Typography variant="14/semibold" color="neutral-500">
                  تعداد کارکنان بیمه‌شده
                </Typography>
              </div>
              {isInsuredAbsent ? (
                <Typography variant="14/regular" color="neutral-400" className="py-2">
                  ندارد
                </Typography>
              ) : (
                <Input
                  type="number"
                  min={0}
                  step={1}
                  dir="ltr"
                  value={
                    isEditingBasic
                      ? (dossierForm.insuredEmployeeCount ?? '')
                      : (dossier.insuredEmployeeCount ?? '')
                  }
                  readOnly={!isEditingBasic}
                  placeholder="مثال: ۱۰"
                  onChange={(e) => {
                    const parsed =
                      e.target.value === '' ? null : Number(toEnglishDigits(e.target.value))
                    setOptionalDossierValue('insuredEmployeeCount', parsed)
                  }}
                  containerClassName={
                    isEditingBasic
                      ? 'bg-background'
                      : 'border-transparent bg-transparent p-0 hover:border-transparent'
                  }
                />
              )}
            </div>
          </div>
        </div>
      </fieldset>

      {/* مدارک رسمی شرکت */}
      <section id="company-documents" className="flex scroll-mt-6 flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            مدارک رسمی شرکت
          </Typography>
          <Typography variant="12/regular" color="neutral-500">
            فایل‌ها به‌صورت امن ذخیره می‌شوند و فقط با مجوز همین شرکت یا دبیرخانه/صاحب سیستم قابل
            دریافت هستند (Word یا PDF، حداکثر ۱۰ مگابایت).
          </Typography>
          {editWithdrawsVerification(verification.status) && (
            <Typography role="note" variant="12/regular" className="rounded-lg bg-warning-50 p-2 text-warning-700">
              بارگذاری مدرک جدید، احراز هویت فعلی شرکت را باطل می‌کند و پرونده باید دوباره برای احراز ارسال شود.
            </Typography>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {(
            [
              ['articlesOfAssociation', 'اساس‌نامه (اجباری)', true],
              ['establishmentNotices', 'آگهی تأسیس (اجباری)', true],
              ['amendmentNotices', 'آگهی‌های آخرین تغییرات', false],
            ] as const
          ).map(([category, label, isRequired]) => (
            <div key={category} className="flex flex-col gap-3">
                <PrivateDocumentField
                  category={category}
                  label={label}
                  required={isRequired}
                  companyId={profile.companyId ?? undefined}
                  canUpload={Boolean(profile.companyId)}
                  canDelete
                  disabled={isSavingBasic}
                  onPendingChange={(pending) =>
                    setPendingDocuments((current) =>
                      current[category] === pending ? current : { ...current, [category]: pending },
                    )
                  }
                  onDocumentsChange={() => {
                    void refreshDossier()
                    void refreshVerification()
                  }}
                />
            </div>
          ))}
        </div>
      </section>

      {/* آدرس‌ها */}
      <section id="company-addresses" className="flex scroll-mt-6 flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            آدرس ها
          </Typography>
          <Button type="button" variant="gray" size="32" onClick={openNewAddress}>
            <DashboardAddIcon className="size-5" />
            آدرس جدید
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          {profile.addresses.length === 0 && (
            <Typography color="neutral-400">آدرسی ثبت نشده است.</Typography>
          )}
          {profile.addresses.map((address) => (
            <article
              key={address.id}
              className="flex flex-col items-start gap-3 rounded-lg border border-neutral-100 p-4 text-start"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <Typography variant="16/semibold" color="neutral-600">
                  {address.title}
                </Typography>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="text-gray"
                    size="icon-32"
                    title="حذف آدرس"
                    onClick={() => removeAddress(address.id)}
                  >
                    <DashboardTrashIcon className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="text-gray"
                    size="icon-32"
                    title="ویرایش آدرس"
                    onClick={() => openAddressEdit(address)}
                  >
                    <DashboardEditIcon className="size-5" />
                  </Button>
                </div>
              </div>
              <Typography variant="16/semibold" color="neutral-400">
                {address.address}
              </Typography>
              <Typography variant="16/semibold" color="neutral-400">
                کد پستی: <bdi dir="ltr">{address.postalCode}</bdi>
              </Typography>
            </article>
          ))}
        </div>
      </section>

      {/* اشخاص و مدیران */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-background p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            اشخاص
          </Typography>
          <Button type="button" variant="gray" size="32" onClick={() => openExecutive()}>
            <DashboardAddIcon className="size-5" />
            سمت جدید
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {profile.executives.length === 0 && (
            <Typography color="neutral-400">شخصی ثبت نشده است.</Typography>
          )}
          {profile.executives.map((executive, index) => (
            <article
              key={`${executive.name}-${index}`}
              className="flex flex-col items-start gap-3 rounded-lg border border-neutral-100 p-3 text-start"
            >
              <Typography variant="14/semibold" color="neutral-400">
                {executive.role}
              </Typography>
              <div className="flex w-full items-center justify-between gap-2">
                <Typography variant="16/semibold" color="neutral-600">
                  {executive.name}
                </Typography>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="text-gray"
                    size="icon-32"
                    title="ویرایش شخص"
                    onClick={() => openExecutive(index)}
                  >
                    <DashboardEditIcon className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="text-gray"
                    size="icon-32"
                    title="حذف شخص"
                    onClick={() => removeExecutive(index)}
                  >
                    <DashboardTrashIcon className="size-5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Dialogs: the primary action is first in the DOM, so it sits on the right in RTL. */}
      {addressDialogOpen && (
        <ProfileDialog
          title={editingAddressId ? 'ویرایش آدرس' : 'اضافه کردن آدرس جدید'}
          onClose={() => setAddressDialogOpen(false)}
          primary={
            <Button size="40" type="button" variant="primary" className="flex-1" loading={isSavingAddress} onClick={saveAddress}>
              ذخیره
            </Button>
          }
          secondary={
            <Button size="40" type="button" variant="outline-gray" className="flex-1" onClick={() => setAddressDialogOpen(false)}>
              لغو
            </Button>
          }
        >
          <Input
            label="نام آدرس"
            aria-required="true"
            placeholder="مثال: دفتر مرکزی"
            value={addressForm.title}
            onChange={(event) => setAddressForm({ ...addressForm, title: event.target.value })}
          />
          <Input
            label="استان"
            placeholder="مثال: تهران"
            value={addressForm.province}
            onChange={(event) => setAddressForm({ ...addressForm, province: event.target.value })}
          />
          <Input
            label="شهر"
            placeholder="مثال: تهران"
            value={addressForm.city}
            onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })}
          />
          <Input
            label="کد پستی"
            dir="ltr"
            placeholder="مثال: 1234567890"
            value={addressForm.postalCode}
            onChange={(event) => setAddressForm({ ...addressForm, postalCode: event.target.value })}
          />
          <Field>
            <FieldLabel htmlFor="company-address-text" required className="text-base">
              آدرس
            </FieldLabel>
            <Textarea
              id="company-address-text"
              rows={4}
              aria-required="true"
              placeholder="نشانی کامل را وارد کنید…"
              value={addressForm.address}
              onChange={(event) => setAddressForm({ ...addressForm, address: event.target.value })}
              className="resize-none text-start"
            />
          </Field>
        </ProfileDialog>
      )}

      {editingExecutiveIndex !== null && (
        <ProfileDialog
          title={editingExecutiveIndex === -1 ? 'افزودن شخص' : 'ویرایش شخص'}
          onClose={() => setEditingExecutiveIndex(null)}
          primary={
            <Button size="40" type="button" variant="primary" className="flex-1" loading={isSavingExecutive} onClick={saveExecutive}>
              ذخیره
            </Button>
          }
          secondary={
            <Button size="40" type="button" variant="outline-gray" className="flex-1" onClick={() => setEditingExecutiveIndex(null)}>
              انصراف
            </Button>
          }
        >
          <Input
            label="نام و نام خانوادگی"
            aria-required="true"
            placeholder="مثال: علی احمدی"
            value={executiveForm.name}
            onChange={(event) => setExecutiveForm({ ...executiveForm, name: event.target.value })}
          />
          <Input
            label="سمت"
            aria-required="true"
            placeholder="مثال: مدیرعامل"
            value={executiveForm.role}
            onChange={(event) => setExecutiveForm({ ...executiveForm, role: event.target.value })}
          />
        </ProfileDialog>
      )}
      {reverificationDialog}
    </div>
  )
}
