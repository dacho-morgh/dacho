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
import { Checkbox } from '@/components/ui/checkbox'
import { ComboboxField } from '@/components/ui/combobox-field'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { JalaliDatePicker } from '@/components/ui/jalali-date-picker'
import { SelectField } from '@/components/ui/select-field'
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
  type AddressDto,
  type CompanyDossierDto,
  type CompanyInfoDto,
  type CompanyVerificationDto,
  type DossierResponseDto,
  type MissingDossierItemsDto,
  type ProfileDto,
  updateAddress,
  updateProfile,
} from '@/utilities/dashboard-api'
import { citiesOfProvince, IRAN_PROVINCES } from '@/data/iran-locations'
import {
  CENTER_ESTABLISHED,
  CITY_NEEDS_PROVINCE_PLACEHOLDER,
  CLASSIFICATION_OPTIONS,
  KNOWLEDGE_BASED_STATUS_OPTIONS,
  COMPANY_BASIC_LABELS,
  COMPANY_BASIC_PLACEHOLDERS,
  COMPANY_TYPES,
  companyBasicErrors,
  PROVINCE_NAMES,
  type CompanyBasicField,
} from '@/utilities/company-basic-rules'
import { buildCompanyDossierPatch } from '@/utilities/dossier-edits'
import { CompanyVerificationCard, editWithdrawsVerification } from './company-verification-card'
import { InlineProfileField } from './inline-profile-field'
import { ProfileDialog } from './profile-dialog'
import { useReverificationConfirm } from './use-reverification-confirm'
import { toast } from 'sonner'

/** A value saved before the dropdowns existed (free text) stays selectable until changed. */
function withCurrent(options: readonly string[], current: string): readonly string[] {
  return current && !options.includes(current) ? [current, ...options] : options
}

/** Where each registration field's input lives, so a failed save can focus it. */
const basicFieldId: Record<CompanyBasicField, string> = {
  name: 'company-basic-name',
  activityDomain: 'company-basic-activityDomain',
  registrationNumber: 'company-basic-registrationNumber',
  type: 'company-basic-type',
  province: 'company-basic-province',
  city: 'company-basic-city',
  establishmentDate: 'company-basic-establishmentDate',
  economicCode: 'company-basic-economicCode',
}

/** The registration-form order, used to focus the first field with an error. */
const basicFieldOrder = Object.keys(basicFieldId) as CompanyBasicField[]

/** The picker and date controls share the profile cell's label style. */
const profileControlClassName =
  'gap-2 [&>label]:text-sm [&>label]:leading-6 [&>label]:font-semibold [&>label]:text-neutral-400'

/** Numeric registration fields are stored with ASCII digits, as signup stores them. */
function normalizeCompanyInfo(company: CompanyInfoDto): CompanyInfoDto {
  const digits = (value: string) => toEnglishDigits(value.trim())
  return {
    ...company,
    name: company.name.trim(),
    registrationNumber: digits(company.registrationNumber),
    economicCode: digits(company.economicCode),
    establishmentDate: digits(company.establishmentDate),
  }
}

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
  const [basicErrors, setBasicErrors] = useState<Partial<Record<CompanyBasicField, string>>>({})
  const [dossierErrors, setDossierErrors] = useState<
    Partial<Record<'knowledgeBasedStatus' | 'classification', string>>
  >({})
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
    setBasicErrors({})
    setDossierErrors({})
    setError(null)
    setIsEditingBasic(true)
  }

  const setBasicValue = <Field extends keyof CompanyInfoDto>(field: Field, value: CompanyInfoDto[Field]) => {
    setBasicForm((current) => ({ ...current, [field]: value }))
    if (field in basicFieldId) clearBasicError(field as CompanyBasicField)
  }

  const clearDossierError = (field: 'knowledgeBasedStatus' | 'classification') =>
    setDossierErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })

  /**
   * The checkbox always gives an answer: ticked keeps an earlier description or
   * stores the standard one; unticked records that the company is not established.
   */
  const setCenterEstablished = (established: boolean) => {
    const withoutCenter = dossierForm.notAvailable.filter((item) => item !== 'centerEstablishment')
    setDossierForm({
      ...dossierForm,
      centerEstablishment: established
        ? dossierAtEdit.current.centerEstablishment.trim() || CENTER_ESTABLISHED
        : '',
      notAvailable: established ? withoutCenter : [...withoutCenter, 'centerEstablishment'],
    })
  }

  const clearBasicError = (field: CompanyBasicField) =>
    setBasicErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })

  const cancelBasicEdit = () => {
    if (basicSaveLock.current) return
    setBasicForm({ ...profile.company })
    setDossierForm({ ...dossier })
    setBasicErrors({})
    setDossierErrors({})
    setError(null)
    setIsEditingBasic(false)
  }

  /**
   * Website, growth-centre and insured-staff fields are simply left empty when the
   * company has none. An absence answer saved earlier stays until a value is typed.
   */
  const setOptionalDossierValue = (
    field: 'website' | 'insuredEmployeeCount',
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

    // The registration rules: the same fields are checked as on the register page.
    const fieldErrors = companyBasicErrors(
      {
        name: basicForm.name,
        activityDomain: dossierForm.activityDomain,
        registrationNumber: basicForm.registrationNumber,
        type: basicForm.type,
        province: basicForm.province ?? '',
        city: basicForm.city ?? '',
        establishmentDate: basicForm.establishmentDate,
        economicCode: basicForm.economicCode,
      },
      profile.company.type,
    )
    setBasicErrors(fieldErrors)
    const choiceErrors: Partial<Record<'knowledgeBasedStatus' | 'classification', string>> = {}
    if (!dossierForm.knowledgeBasedStatus.trim()) choiceErrors.knowledgeBasedStatus = 'وضعیت دانش‌بنیانی را انتخاب کنید.'
    if (!dossierForm.classification.trim()) choiceErrors.classification = 'طبقه‌بندی شرکت را انتخاب کنید.'
    setDossierErrors(choiceErrors)
    const firstInvalid =
      basicFieldOrder.map((field) => (fieldErrors[field] ? basicFieldId[field] : undefined)).find(Boolean) ??
      (Object.keys(choiceErrors) as Array<keyof typeof choiceErrors>).map((field) => `company-basic-${field}`)[0]
    if (firstInvalid) {
      setError('لطفاً موارد مشخص‌شده را اصلاح کنید.')
      requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus())
      return
    }

    basicSaveLock.current = true
    setError(null)
    setIsSavingBasic(true)

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
        dossierForm,
        latest.dossier,
      )
      const normalizedBasic = normalizeCompanyInfo(basicForm)
      const companyPatch: Partial<CompanyInfoDto> = {}
      for (const field of Object.keys(normalizedBasic) as (keyof CompanyInfoDto)[]) {
        if ((normalizedBasic[field] ?? '') !== (profile.company[field] ?? ''))
          (companyPatch as Record<string, unknown>)[field] = normalizedBasic[field]
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

  const provinceOptions = withCurrent(
    IRAN_PROVINCES.map((province) => province.name),
    addressForm.province,
  )
  const cityOptions = withCurrent(citiesOfProvince(addressForm.province), addressForm.city)
  const displayedDossier = isEditingBasic ? dossierForm : dossier
  const isWebsiteAbsent = !isEditingBasic && displayedDossier.notAvailable.includes('website')
  const centerEstablished = Boolean((isEditingBasic ? dossierForm : dossier).centerEstablishment.trim())
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
          {!isEditingBasic && (
            <Button
              type="button"
              variant="gray"
              size="32"
              disabled={documentsPending}
              onClick={startBasicEdit}
            >
              <DashboardEditIcon className="size-5" />
              <Typography>ویرایش</Typography>
            </Button>
          )}
        </div>

        {/* One grid: every field is a cell, and the cells of a row share the row's height. */}
        <div
          data-slot="basic-info-grid"
          className="grid grid-cols-1 items-stretch gap-x-4 gap-y-5 md:grid-cols-2"
        >
          {/* Figma 238:4213 order; the registration fields use the register form's controls and rules. */}
          <InlineProfileField
            id={basicFieldId.name}
            label={COMPANY_BASIC_LABELS.name}
            required
            placeholder={COMPANY_BASIC_PLACEHOLDERS.name}
            value={basicForm.name}
            editing={isEditingBasic}
            error={basicErrors.name}
            onChange={(name) => setBasicValue('name', name)}
          />
          {isEditingBasic ? (
            <div data-slot="profile-field" className="flex h-full min-w-0 flex-col rounded-lg border border-neutral-100 p-2">
              <JalaliDatePicker
                id={basicFieldId.establishmentDate}
                label="تاریخ تاسیس"
                required
                wrapperClassName={profileControlClassName}
                error={basicErrors.establishmentDate}
                placeholder={COMPANY_BASIC_PLACEHOLDERS.establishmentDate}
                value={basicForm.establishmentDate}
                onChange={(establishmentDate) => setBasicValue('establishmentDate', establishmentDate)}
              />
            </div>
          ) : (
            <InlineProfileField
              label="تاریخ تاسیس"
              value={basicForm.establishmentDate}
              editing={false}
              dir="auto"
              onChange={() => {}}
            />
          )}
          {isEditingBasic ? (
            <div data-slot="profile-field" className="flex h-full min-w-0 flex-col rounded-lg border border-neutral-100 p-2">
              <ComboboxField
                id={basicFieldId.type}
                label={COMPANY_BASIC_LABELS.type}
                required
                wrapperClassName={profileControlClassName}
                error={basicErrors.type}
                options={withCurrent(COMPANY_TYPES, profile.company.type)}
                placeholder={COMPANY_BASIC_PLACEHOLDERS.type}
                value={basicForm.type}
                onChange={(type) => setBasicValue('type', type)}
              />
            </div>
          ) : (
            <InlineProfileField label={COMPANY_BASIC_LABELS.type} value={basicForm.type} editing={false} onChange={() => {}} />
          )}
          <InlineProfileField
            id={basicFieldId.registrationNumber}
            label={COMPANY_BASIC_LABELS.registrationNumber}
            required
            placeholder={COMPANY_BASIC_PLACEHOLDERS.registrationNumber}
            value={basicForm.registrationNumber}
            editing={isEditingBasic}
            error={basicErrors.registrationNumber}
            inputMode="numeric"
            dir="ltr"
            onChange={(registrationNumber) => setBasicValue('registrationNumber', registrationNumber)}
          />
          <InlineProfileField
            id={basicFieldId.economicCode}
            label={COMPANY_BASIC_LABELS.economicCode}
            required
            placeholder={COMPANY_BASIC_PLACEHOLDERS.economicCode}
            value={basicForm.economicCode}
            editing={isEditingBasic}
            error={basicErrors.economicCode}
            inputMode="numeric"
            dir="ltr"
            onChange={(economicCode) => setBasicValue('economicCode', economicCode)}
          />
          <InlineProfileField
            label="شناسه ملی"
            value={basicForm.nationalId}
            editing={false}
            dir="ltr"
            onChange={() => {}}
          />
          {isEditingBasic ? (
            <div data-slot="profile-field" className="flex h-full min-w-0 flex-col rounded-lg border border-neutral-100 p-2">
              <ComboboxField
                id={basicFieldId.province}
                label={COMPANY_BASIC_LABELS.province}
                required
                wrapperClassName={profileControlClassName}
                error={basicErrors.province}
                options={withCurrent(PROVINCE_NAMES, profile.company.province ?? '')}
                placeholder={COMPANY_BASIC_PLACEHOLDERS.province}
                value={basicForm.province ?? ''}
                onChange={(province) => {
                  // The city list depends on the province, as on the register form.
                  if (province !== (basicForm.province ?? '')) {
                    setBasicForm((current) => ({ ...current, province, city: '' }))
                    clearBasicError('city')
                  }
                  clearBasicError('province')
                }}
              />
            </div>
          ) : (
            <InlineProfileField label={COMPANY_BASIC_LABELS.province} value={basicForm.province ?? ''} editing={false} onChange={() => {}} />
          )}
          {isEditingBasic ? (
            <div data-slot="profile-field" className="flex h-full min-w-0 flex-col rounded-lg border border-neutral-100 p-2">
              <ComboboxField
                id={basicFieldId.city}
                label={COMPANY_BASIC_LABELS.city}
                required
                disabled={!basicForm.province}
                wrapperClassName={profileControlClassName}
                error={basicErrors.city}
                options={citiesOfProvince(basicForm.province ?? '')}
                placeholder={basicForm.province ? COMPANY_BASIC_PLACEHOLDERS.city : CITY_NEEDS_PROVINCE_PLACEHOLDER}
                value={basicForm.city ?? ''}
                onChange={(city) => setBasicValue('city', city)}
              />
            </div>
          ) : (
            <InlineProfileField label={COMPANY_BASIC_LABELS.city} value={basicForm.city ?? ''} editing={false} onChange={() => {}} />
          )}
          {isEditingBasic ? (
            <div data-slot="profile-field" className="flex h-full min-w-0 flex-col rounded-lg border border-neutral-100 p-2">
              <ComboboxField
                id="company-basic-knowledgeBasedStatus"
                label="وضعیت دانش‌بنیانی"
                required
                wrapperClassName={profileControlClassName}
                error={dossierErrors.knowledgeBasedStatus}
                options={withCurrent(KNOWLEDGE_BASED_STATUS_OPTIONS, dossier.knowledgeBasedStatus)}
                placeholder="وضعیت دانش‌بنیانی را جستجو یا انتخاب کنید"
                value={dossierForm.knowledgeBasedStatus}
                onChange={(knowledgeBasedStatus) => {
                  setDossierForm({ ...dossierForm, knowledgeBasedStatus })
                  clearDossierError('knowledgeBasedStatus')
                }}
              />
            </div>
          ) : (
            <InlineProfileField
              label="وضعیت دانش‌بنیانی"
              value={dossier.knowledgeBasedStatus || 'ثبت نشده'}
              editing={false}
              onChange={() => {}}
            />
          )}
          {isEditingBasic ? (
            <div data-slot="profile-field" className="flex h-full min-w-0 flex-col rounded-lg border border-neutral-100 p-2">
              <ComboboxField
                id="company-basic-classification"
                label="طبقه‌بندی شرکت"
                required
                wrapperClassName={profileControlClassName}
                error={dossierErrors.classification}
                options={withCurrent(CLASSIFICATION_OPTIONS, dossier.classification)}
                placeholder="طبقه‌بندی شرکت را جستجو یا انتخاب کنید"
                value={dossierForm.classification}
                onChange={(classification) => {
                  setDossierForm({ ...dossierForm, classification })
                  clearDossierError('classification')
                }}
              />
            </div>
          ) : (
            <InlineProfileField
              label="طبقه‌بندی شرکت"
              value={dossier.classification || 'ثبت نشده'}
              editing={false}
              onChange={() => {}}
            />
          )}
          <InlineProfileField
            id={basicFieldId.activityDomain}
            label={COMPANY_BASIC_LABELS.activityDomain}
            required
            placeholder={COMPANY_BASIC_PLACEHOLDERS.activityDomain}
            value={isEditingBasic ? dossierForm.activityDomain : dossier.activityDomain || 'ثبت نشده'}
            editing={isEditingBasic}
            error={basicErrors.activityDomain}
            onChange={(activityDomain) => {
              setDossierForm({ ...dossierForm, activityDomain })
              clearBasicError('activityDomain')
            }}
          />
          {/* Optional: left empty when the company has none. */}
          <InlineProfileField
            label="وب‌سایت رسمی"
            placeholder="https://example.com"
            value={isEditingBasic ? dossierForm.website : dossier.website}
            editing={isEditingBasic}
            absent={isWebsiteAbsent}
            dir="ltr"
            onChange={(website) => setOptionalDossierValue('website', website)}
          />
          {/* A yes/no answer: ticked stores the establishment, unticked records "not established". */}
          <div
            data-slot="profile-field"
            className="flex h-full min-w-0 items-center gap-3 rounded-lg border border-neutral-100 p-2 text-start"
          >
            <Checkbox
              id="company-basic-centerEstablishment"
              checked={centerEstablished}
              disabled={!isEditingBasic}
              onCheckedChange={(checked) => setCenterEstablished(checked === true)}
            />
            <Typography
              as="label"
              htmlFor="company-basic-centerEstablishment"
              variant="14/semibold"
              color="neutral-400"
              className={isEditingBasic ? 'cursor-pointer' : undefined}
            >
              استقرار در مرکز رشد / پارک علم و فناوری
            </Typography>
          </div>
          <InlineProfileField
            label="تعداد کارکنان بیمه‌شده"
            type="number"
            min={0}
            step={1}
            placeholder="مثال: ۱۰"
            value={String((isEditingBasic ? dossierForm.insuredEmployeeCount : dossier.insuredEmployeeCount) ?? '')}
            editing={isEditingBasic}
            absent={isInsuredAbsent}
            dir="ltr"
            onChange={(count) =>
              setOptionalDossierValue('insuredEmployeeCount', count === '' ? null : Number(toEnglishDigits(count)))
            }
          />
        </div>

        {isEditingBasic && (
          <div data-slot="basic-info-actions" className="flex items-center gap-2">
            {/* Primary first in the DOM: it sits on the right in RTL, as in the dialogs. */}
            <Button type="button" variant="primary" size="40" loading={isSavingBasic} onClick={saveBasic}>
              <Typography>ذخیره</Typography>
            </Button>
            <Button type="button" variant="outline-gray" size="40" onClick={cancelBasicEdit}>
              <Typography>انصراف</Typography>
            </Button>
          </div>
        )}
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
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
          {(
            [
              ['articlesOfAssociation', 'اساس‌نامه', true],
              ['establishmentNotices', 'آگهی تأسیس', true],
              ['amendmentNotices', 'آگهی‌های آخرین تغییرات', false],
            ] as const
          ).map(([category, label, isRequired]) => (
            <div key={category} className="flex h-full flex-col gap-3">
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
        <div data-slot="address-list" className="flex flex-col gap-5">
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
          <SelectField
            label="استان"
            placeholder="استان را انتخاب کنید"
            options={provinceOptions}
            value={addressForm.province}
            onChange={(event) =>
              // A city of the old province must not survive a change of province.
              setAddressForm({ ...addressForm, province: event.target.value, city: '' })
            }
          />
          <SelectField
            label="شهر"
            placeholder="شهر را انتخاب کنید"
            options={cityOptions}
            value={addressForm.city}
            disabled={!addressForm.province}
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
