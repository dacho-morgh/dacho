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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  addAddress,
  deleteAddress,
  dossierFieldLabel,
  fetchProfileDossier,
  toEnglishDigits,
  type AbsenceField,
  type AddressDto,
  type CompanyDossierDto,
  type CompanyInfoDto,
  type DossierResponseDto,
  type MissingDossierItemsDto,
  type ProfileDto,
  updateAddress,
  updateProfile,
  updateProfileDossier,
} from '@/utilities/dashboard-api'
import { buildCompanyDossierPatch } from '@/utilities/dossier-edits'
import { InlineProfileField } from './inline-profile-field'
import { ProfileDialog } from './profile-dialog'

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

interface CompanyProfileViewProps {
  initialProfile: ProfileDto
  initialDossier?: DossierResponseDto
}

export function CompanyProfileView({ initialProfile, initialDossier }: CompanyProfileViewProps) {
  const [profile, setProfile] = useState(initialProfile)
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

  const setAmendmentsAbsent = async (absent: boolean) => {
    if (basicSaveLock.current || documentsPending || !dossierLoaded) return
    basicSaveLock.current = true
    setIsSavingBasic(true)
    setError(null)
    try {
      const latest = await fetchProfileDossier()
      if (!latest) throw new Error('dossier_load_failed')
      const notAvailable: AbsenceField[] = latest.dossier.notAvailable.filter(
        (field) => field !== 'amendmentNotices',
      )
      if (absent) notAvailable.push('amendmentNotices')
      const result = await updateProfileDossier({ notAvailable })
      if (!result) throw new Error('dossier_update_failed')
      setDossier(result.dossier)
      setDossierForm(result.dossier)
      setMissing(result.missing)
    } catch {
      setError(
        'ثبت وضعیت آگهی تغییرات انجام نشد. ابتدا فایل‌های این بخش را حذف کنید یا دوباره تلاش کنید.',
      )
    } finally {
      basicSaveLock.current = false
      setIsSavingBasic(false)
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

  const toggleDossierAbsence = (field: AbsenceField) => {
    const isCurrentlyAbsent = dossierForm.notAvailable.includes(field)
    let nextAbsence: AbsenceField[]
    if (isCurrentlyAbsent) {
      nextAbsence = dossierForm.notAvailable.filter((f) => f !== field)
    } else {
      nextAbsence = [...dossierForm.notAvailable, field]
    }

    setDossierForm({
      ...dossierForm,
      notAvailable: nextAbsence,
      ...(isCurrentlyAbsent
        ? {}
        : {
            ...(field === 'website' ? { website: '' } : {}),
            ...(field === 'centerEstablishment' ? { centerEstablishment: '' } : {}),
            ...(field === 'insuredEmployeeCount' ? { insuredEmployeeCount: null } : {}),
          }),
    })
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

      const updatedProfile = await updateProfile({
        company: companyPatch,
        dossier: dossierPatch,
      })
      if (!updatedProfile) throw new Error('profile_update_failed')
      setProfile(updatedProfile)
      setBasicForm(updatedProfile.company)
      setIsEditingBasic(false)

      const updatedDossier = await refreshDossier()
      if (updatedDossier) setDossierForm(updatedDossier.dossier)
    } catch {
      setError('ذخیره اطلاعات انجام نشد. ورودی‌ها را بررسی کنید.')
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
      await refreshDossier()
    } catch {
      setError(editingAddressId ? 'ویرایش آدرس انجام نشد.' : 'افزودن آدرس انجام نشد.')
    } finally {
      setIsSavingAddress(false)
    }
  }

  const removeAddress = async (id: string) => {
    setError(null)
    try {
      await deleteAddress(id)
      setProfile((current) => ({
        ...current,
        addresses: current.addresses.filter((address) => address.id !== id),
      }))
      await refreshDossier()
    } catch {
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

    setError(null)
    setIsSavingExecutive(true)
    try {
      const updated = await updateProfile({ executives })
      if (!updated) throw new Error('executive_update_failed')
      setProfile(updated)
      setEditingExecutiveIndex(null)
    } catch {
      setError('ذخیره شخص انجام نشد.')
    } finally {
      setIsSavingExecutive(false)
    }
  }

  const removeExecutive = async (index: number) => {
    setError(null)
    try {
      const updated = await updateProfile({
        executives: profile.executives.filter((_, itemIndex) => itemIndex !== index),
      })
      if (!updated) throw new Error('executive_delete_failed')
      setProfile(updated)
    } catch {
      setError('حذف شخص انجام نشد.')
    }
  }

  const displayedDossier = isEditingBasic ? dossierForm : dossier
  const isWebsiteAbsent = displayedDossier.notAvailable.includes('website')
  const isCenterAbsent = displayedDossier.notAvailable.includes('centerEstablishment')
  const isInsuredAbsent = displayedDossier.notAvailable.includes('insuredEmployeeCount')

  if (!dossierLoaded) {
    return (
      <div className="flex flex-col gap-4" dir="rtl">
        <Typography role={error ? 'alert' : 'status'} color={error ? 'error' : 'neutral-500'}>
          {error ?? 'در حال دریافت اطلاعات پرونده…'}
        </Typography>
        {error && (
          <Button type="button" onClick={() => window.location.reload()}>
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

      {/* وضعیت احراز هویت و تکمیل پرونده */}
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            وضعیت تکمیل پرونده برای احراز هویت
          </Typography>
          {missing.canRequestVerification ? (
            <Typography
              as="span"
              className="rounded-full bg-success-50 px-3 py-1 text-sm font-semibold text-success-700"
            >
              اطلاعات الزامی کامل است
            </Typography>
          ) : (
            <Typography
              as="span"
              className="rounded-full bg-warning-50 px-3 py-1 text-sm font-semibold text-warning-700"
            >
              در حال تکمیل ({missing.required.length.toLocaleString('fa-IR')} مورد الزامی باقی‌مانده)
            </Typography>
          )}
        </div>

        {missing.canRequestVerification ? (
          <Typography variant="14/regular" className="text-success-700">
            تمامی فیلدها و مدارک الزامی ثبت شده است؛ درخواست احراز هویت هنوز ارسال نشده است.
          </Typography>
        ) : (
          <div className="flex flex-col gap-3">
            {missing.required.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Typography variant="14/semibold" color="neutral-600">
                  اطلاعات یا مدارک الزامی ناقص:
                </Typography>
                <div className="flex flex-wrap gap-2">
                  {missing.required.map((key) => (
                    <Typography
                      as="span"
                      key={key}
                      className="rounded-lg border border-error-200 bg-error-50 px-2.5 py-1 text-xs font-medium text-error-700"
                    >
                      {dossierFieldLabel(key)}
                    </Typography>
                  ))}
                </div>
              </div>
            )}
            {missing.optional.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <Typography variant="12/regular" color="neutral-500">
                  موارد اختیاری بدون پاسخ (می‌توانید تکمیل کنید یا گزینه «ندارم» را علامت بزنید):
                </Typography>
                <div className="flex flex-wrap gap-1.5">
                  {missing.optional.map((key) => (
                    <Typography
                      as="span"
                      key={key}
                      className="rounded-lg border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                    >
                      {dossierFieldLabel(key)}
                    </Typography>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

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
        disabled={isSavingBasic}
        className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6"
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
              value={basicForm.registrationNumber}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(registrationNumber) => setBasicForm({ ...basicForm, registrationNumber })}
            />
            <InlineProfileField
              label="کد اقتصادی"
              value={basicForm.economicCode}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(economicCode) => setBasicForm({ ...basicForm, economicCode })}
            />
            <InlineProfileField
              label="وضعیت شرکت"
              value={basicForm.status}
              editing={isEditingBasic}
              onChange={(status) => setBasicForm({ ...basicForm, status })}
            />
            <InlineProfileField
              label="نوع شرکت (مرحله اول)"
              value={basicForm.type}
              editing={isEditingBasic}
              onChange={(type) => setBasicForm({ ...basicForm, type })}
            />
            <InlineProfileField
              label="تاریخ تاسیس"
              value={basicForm.establishmentDate}
              editing={isEditingBasic}
              dir="auto"
              onChange={(establishmentDate) => setBasicForm({ ...basicForm, establishmentDate })}
            />
          </div>

          <div className="flex flex-col gap-4">
            <InlineProfileField
              label="نوع شخصیت حقوقی (سهامی خاص / عام / با مسئولیت محدود / ...)"
              value={
                isEditingBasic ? dossierForm.legalEntityType : dossier.legalEntityType || 'ثبت نشده'
              }
              editing={isEditingBasic}
              onChange={(legalEntityType) => setDossierForm({ ...dossierForm, legalEntityType })}
            />
            <InlineProfileField
              label="وضعیت دانش‌بنیانی (دانش‌بنیان نوع یک / دو / نوپا / غیر دانش‌بنیان)"
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
              value={
                isEditingBasic ? dossierForm.classification : dossier.classification || 'ثبت نشده'
              }
              editing={isEditingBasic}
              onChange={(classification) => setDossierForm({ ...dossierForm, classification })}
            />
            <InlineProfileField
              label="سال تأسیس (عدد ۴ رقمی مثلاً ۱۳۸۵)"
              value={isEditingBasic ? dossierForm.foundingYear : dossier.foundingYear || 'ثبت نشده'}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(foundingYear) => setDossierForm({ ...dossierForm, foundingYear })}
            />
            <InlineProfileField
              label="حوزه فعالیت اصلی"
              value={
                isEditingBasic ? dossierForm.activityDomain : dossier.activityDomain || 'ثبت نشده'
              }
              editing={isEditingBasic}
              onChange={(activityDomain) => setDossierForm({ ...dossierForm, activityDomain })}
            />

            {/* وبسایت با چک‌باکس ندارم */}
            <div className="flex flex-col gap-1 rounded-lg border border-neutral-100 p-2">
              <div className="flex items-center justify-between">
                <Typography variant="14/semibold" color="neutral-500">
                  وب‌سایت رسمی
                </Typography>
                {isEditingBasic && (
                  <Typography
                    as="label"
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500"
                  >
                    <input
                      type="checkbox"
                      checked={isWebsiteAbsent}
                      onChange={() => toggleDossierAbsence('website')}
                      className="size-3.5 rounded border-neutral-300 text-brand-600"
                    />
                    ندارم
                  </Typography>
                )}
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
                  onChange={(e) => setDossierForm({ ...dossierForm, website: e.target.value })}
                  containerClassName={
                    isEditingBasic
                      ? 'bg-white'
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
                {isEditingBasic && (
                  <Typography
                    as="label"
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500"
                  >
                    <input
                      type="checkbox"
                      checked={isCenterAbsent}
                      onChange={() => toggleDossierAbsence('centerEstablishment')}
                      className="size-3.5 rounded border-neutral-300 text-brand-600"
                    />
                    ندارم
                  </Typography>
                )}
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
                  onChange={(e) =>
                    setDossierForm({ ...dossierForm, centerEstablishment: e.target.value })
                  }
                  containerClassName={
                    isEditingBasic
                      ? 'bg-white'
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
                {isEditingBasic && (
                  <Typography
                    as="label"
                    className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500"
                  >
                    <input
                      type="checkbox"
                      checked={isInsuredAbsent}
                      onChange={() => toggleDossierAbsence('insuredEmployeeCount')}
                      className="size-3.5 rounded border-neutral-300 text-brand-600"
                    />
                    ندارم
                  </Typography>
                )}
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
                    setDossierForm({ ...dossierForm, insuredEmployeeCount: parsed })
                  }}
                  containerClassName={
                    isEditingBasic
                      ? 'bg-white'
                      : 'border-transparent bg-transparent p-0 hover:border-transparent'
                  }
                />
              )}
            </div>
          </div>
        </div>
      </fieldset>

      {/* مدارک رسمی شرکت */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            مدارک رسمی شرکت
          </Typography>
          <Typography variant="12/regular" color="neutral-500">
            فایل‌ها به‌صورت امن ذخیره می‌شوند و فقط با مجوز همین شرکت یا دبیرخانه/صاحب سیستم قابل
            دریافت هستند (Word یا PDF، حداکثر ۱۰ مگابایت).
          </Typography>
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
              {category === 'amendmentNotices' && (
                <Typography as="label" className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dossier.notAvailable.includes('amendmentNotices')}
                    disabled={isSavingBasic || isEditingBasic || documentsPending}
                    onChange={(event) => void setAmendmentsAbsent(event.target.checked)}
                  />
                  آگهی تغییرات ندارم
                </Typography>
              )}
              {category === 'amendmentNotices' && dossier.notAvailable.includes(category) ? (
                <Typography color="neutral-400">ثبت شده است که شرکت آگهی تغییرات ندارد.</Typography>
              ) : (
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
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* آدرس‌ها */}
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
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
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
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

      {addressDialogOpen && (
        <ProfileDialog
          title={editingAddressId ? 'ویرایش آدرس' : 'اضافه کردن آدرس جدید'}
          onClose={() => setAddressDialogOpen(false)}
          actions={
            <>
              <Button
                type="button"
                variant="outline-primary"
                className="flex-1"
                onClick={() => setAddressDialogOpen(false)}
              >
                لغو
              </Button>
              <Button
                type="button"
                className="flex-1"
                loading={isSavingAddress}
                onClick={saveAddress}
              >
                ذخیره
              </Button>
            </>
          }
        >
          <Input
            label="نام آدرس"
            value={addressForm.title}
            onChange={(event) => setAddressForm({ ...addressForm, title: event.target.value })}
          />
          <Input
            label="استان"
            value={addressForm.province}
            onChange={(event) => setAddressForm({ ...addressForm, province: event.target.value })}
          />
          <Input
            label="شهر"
            value={addressForm.city}
            onChange={(event) => setAddressForm({ ...addressForm, city: event.target.value })}
          />
          <Input
            label="کد پستی"
            dir="ltr"
            value={addressForm.postalCode}
            onChange={(event) => setAddressForm({ ...addressForm, postalCode: event.target.value })}
          />
          <Typography as="label" variant="16/regular" color="neutral-600">
            آدرس
            <Textarea
              rows={4}
              value={addressForm.address}
              onChange={(event) => setAddressForm({ ...addressForm, address: event.target.value })}
              className="mt-2 resize-none text-start"
            />
          </Typography>
        </ProfileDialog>
      )}

      {editingExecutiveIndex !== null && (
        <ProfileDialog
          title={editingExecutiveIndex === -1 ? 'افزودن شخص' : 'ویرایش شخص'}
          onClose={() => setEditingExecutiveIndex(null)}
          actions={
            <>
              <Button
                type="button"
                variant="outline-gray"
                className="flex-1"
                onClick={() => setEditingExecutiveIndex(null)}
              >
                انصراف
              </Button>
              <Button
                type="button"
                className="flex-1"
                loading={isSavingExecutive}
                onClick={saveExecutive}
              >
                ذخیره
              </Button>
            </>
          }
        >
          <Input
            label="نام و نام خانوادگی"
            value={executiveForm.name}
            onChange={(event) => setExecutiveForm({ ...executiveForm, name: event.target.value })}
          />
          <Input
            label="سمت"
            value={executiveForm.role}
            onChange={(event) => setExecutiveForm({ ...executiveForm, role: event.target.value })}
          />
        </ProfileDialog>
      )}
    </div>
  )
}
