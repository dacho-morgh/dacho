'use client'

import Image from 'next/image'
import { useState } from 'react'
import { DashboardAddIcon, DashboardEditIcon, DashboardTrashIcon } from '@/components/icons'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  addAddress,
  deleteAddress,
  type AddressDto,
  type CompanyInfoDto,
  type ProfileDto,
  updateAddress,
  updateProfile,
} from '@/utilities/dashboard-api'
import { InlineProfileField } from './inline-profile-field'
import { ProfileDialog } from './profile-dialog'

const emptyAddress: Omit<AddressDto, 'id'> = {
  title: '',
  province: '',
  city: '',
  postalCode: '',
  address: '',
}

export function CompanyProfileView({ initialProfile }: { initialProfile: ProfileDto }) {
  const [profile, setProfile] = useState(initialProfile)
  const [basicForm, setBasicForm] = useState<CompanyInfoDto>(initialProfile.company)
  const [isEditingBasic, setIsEditingBasic] = useState(false)
  const [isSavingBasic, setIsSavingBasic] = useState(false)
  const [addressForm, setAddressForm] = useState(emptyAddress)
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [isSavingAddress, setIsSavingAddress] = useState(false)
  const [executiveForm, setExecutiveForm] = useState({ name: '', role: '' })
  const [editingExecutiveIndex, setEditingExecutiveIndex] = useState<number | null>(null)
  const [isSavingExecutive, setIsSavingExecutive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startBasicEdit = () => {
    setBasicForm({ ...profile.company })
    setError(null)
    setIsEditingBasic(true)
  }

  const saveBasic = async () => {
    setError(null)
    setIsSavingBasic(true)
    try {
      const updated = await updateProfile({ company: basicForm })
      if (!updated) throw new Error('profile_update_failed')
      setProfile(updated)
      setBasicForm(updated.company)
      setIsEditingBasic(false)
    } catch {
      setError('ذخیره اطلاعات پایه انجام نشد.')
    } finally {
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

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {error && (
        <Typography role="alert" color="error" className="rounded-lg bg-error-50 p-3">
          {error}
        </Typography>
      )}

      <div className="relative size-20 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-100 shadow-2xs">
        <Image
          src="/figma/dashboard/profile-avatar.png"
          alt="Company Profile Avatar"
          fill
          className="object-cover"
          priority
        />
      </div>

      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4">
        <div className="flex items-center justify-between">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            اطلاعات پایه
          </Typography>
          <Button
            type="button"
            variant={isEditingBasic ? 'primary' : 'gray'}
            size="32"
            loading={isSavingBasic}
            onClick={isEditingBasic ? saveBasic : startBasicEdit}
          >
            {!isEditingBasic && <DashboardEditIcon className="size-5" />}
            {isEditingBasic ? 'ذخیره' : 'ویرایش'}
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
              label="وضعیت شرکت"
              value={basicForm.status}
              editing={isEditingBasic}
              onChange={(status) => setBasicForm({ ...basicForm, status })}
            />
            <InlineProfileField
              label="شماره ثبت"
              value={basicForm.registrationNumber}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(registrationNumber) => setBasicForm({ ...basicForm, registrationNumber })}
            />
            <InlineProfileField
              label="شناسه ملی"
              value={basicForm.nationalId}
              editing={false}
              dir="ltr"
              onChange={() => {}}
            />
          </div>
          <div className="flex flex-col gap-4">
            <InlineProfileField
              label="تاریخ تاسیس"
              value={basicForm.establishmentDate}
              editing={isEditingBasic}
              dir="auto"
              onChange={(establishmentDate) => setBasicForm({ ...basicForm, establishmentDate })}
            />
            <InlineProfileField
              label="نوع شرکت"
              value={basicForm.type}
              editing={isEditingBasic}
              onChange={(type) => setBasicForm({ ...basicForm, type })}
            />
            <InlineProfileField
              label="کد اقتصادی"
              value={basicForm.economicCode}
              editing={isEditingBasic}
              dir="ltr"
              onChange={(economicCode) => setBasicForm({ ...basicForm, economicCode })}
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4">
        <div className="flex flex-col gap-1">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            مدارک شرکت
          </Typography>
          <Typography variant="12/regular" color="neutral-500">
            فایل‌ها به‌صورت خصوصی ذخیره می‌شوند و فقط با مجوز همین شرکت یا دبیرخانه/صاحب سیستم قابل دانلود هستند.
          </Typography>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {([
            ['articlesOfAssociation', 'اساس‌نامه'],
            ['establishmentNotices', 'آگهی تأسیس'],
            ['amendmentNotices', 'آگهی تغییرات'],
            ['catalogues', 'کاتالوگ محصولات'],
            ['certificatesLicenses', 'گواهی‌ها و مجوزها'],
          ] as const).map(([category, label]) => (
            <PrivateDocumentField
              key={category}
              category={category}
              label={label}
              companyId={profile.companyId ?? undefined}
              canUpload
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4">
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

      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4">
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
