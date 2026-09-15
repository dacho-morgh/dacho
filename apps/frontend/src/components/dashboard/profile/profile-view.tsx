'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import {
  DashboardAddIcon,
  DashboardCloseCircle,
  DashboardEditIcon,
  DashboardTrashIcon,
} from '@/components/icons'
import {
  type AddressDto,
  type CompanyInfoDto,
  type ContactInfoDto,
  type ProfileDto,
  updateProfile as apiUpdateProfile,
  addAddress as apiAddAddress,
  updateAddress as apiUpdateAddress,
  deleteAddress as apiDeleteAddress,
} from '@/utilities/dashboard-api'

const emptyProfile: ProfileDto = {
  company: {
    name: '', establishmentDate: '', status: '', type: '', registrationNumber: '', economicCode: '', nationalId: '',
  },
  contacts: {
    phone: '', email: '',
  },
  executives: [],
  addresses: [],
}

type TabType = 'company' | 'resume' | 'account'

interface ProfileViewProps {
  initialProfile?: ProfileDto
}

export function ProfileView({ initialProfile = emptyProfile }: ProfileViewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('company')
  const [profile, setProfile] = useState<ProfileDto>(initialProfile)

  // Modals state
  const [isEditBasicOpen, setIsEditBasicOpen] = useState(false)
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<AddressDto | null>(null)
  const [isEditContactOpen, setIsEditContactOpen] = useState(false)
  const [isLogoutOpen, setIsLogoutOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingExecutiveIndex, setEditingExecutiveIndex] = useState<number | null>(null)

  // Form states for modals
  const [basicForm, setBasicForm] = useState<CompanyInfoDto>(profile.company)
  const [addressForm, setAddressForm] = useState<Omit<AddressDto, 'id'>>({
    title: '',
    province: '',
    city: '',
    postalCode: '',
    address: '',
  })
  const [contactForm, setContactForm] = useState<ContactInfoDto>(profile.contacts)
  const [executiveForm, setExecutiveForm] = useState({ role: '', name: '' })

  // Open Edit Basic Info modal
  const handleOpenEditBasic = () => {
    setBasicForm({ ...profile.company })
    setIsEditBasicOpen(true)
  }

  // Save Edit Basic Info
  const handleSaveBasic = async () => {
    setActionError(null)
    try {
      const updated = await apiUpdateProfile({ company: basicForm })
      if (!updated) throw new Error('profile_update_failed')
      setProfile(updated)
      setIsEditBasicOpen(false)
    } catch {
      setActionError('ذخیره اطلاعات پایه انجام نشد.')
    }
  }

  // Open Add Address modal
  const handleOpenAddAddress = () => {
    setAddressForm({
      title: '',
      province: '',
      city: '',
      postalCode: '',
      address: '',
    })
    setIsAddAddressOpen(true)
  }

  // Save New Address
  const handleSaveAddAddress = async () => {
    if (!addressForm.title || !addressForm.address) return
    setActionError(null)
    try {
      const result = await apiAddAddress(addressForm)
      if (!result?.address) throw new Error('address_create_failed')
      setProfile((current) => ({ ...current, addresses: [...current.addresses, result.address] }))
      setIsAddAddressOpen(false)
    } catch {
      setActionError('افزودن آدرس انجام نشد.')
    }
  }

  // Open Edit Address modal
  const handleOpenEditAddress = (addr: AddressDto) => {
    setEditingAddress(addr)
    setAddressForm({
      title: addr.title,
      province: addr.province,
      city: addr.city,
      postalCode: addr.postalCode,
      address: addr.address,
    })
  }

  // Save Edit Address
  const handleSaveEditAddress = async () => {
    if (!editingAddress) return
    const targetId = editingAddress.id
    setActionError(null)
    try {
      const result = await apiUpdateAddress(targetId, addressForm)
      if (!result?.address) throw new Error('address_update_failed')
      setProfile((current) => ({ ...current, addresses: current.addresses.map((a) => a.id === targetId ? result.address : a) }))
      setEditingAddress(null)
    } catch {
      setActionError('ویرایش آدرس انجام نشد.')
    }
  }

  // Delete Address
  const handleDeleteAddress = async (id: string) => {
    setActionError(null)
    try {
      await apiDeleteAddress(id)
      setProfile((current) => ({ ...current, addresses: current.addresses.filter((a) => a.id !== id) }))
    } catch {
      setActionError('حذف آدرس انجام نشد.')
    }
  }

  // Open Edit Contact Info modal
  const handleOpenEditContact = () => {
    setContactForm({ ...profile.contacts })
    setIsEditContactOpen(true)
  }

  // Save Contact Info
  const handleSaveContact = async () => {
    setActionError(null)
    try {
      const updated = await apiUpdateProfile({ contacts: contactForm })
      if (!updated) throw new Error('contact_update_failed')
      setProfile(updated)
      setIsEditContactOpen(false)
    } catch {
      setActionError('ذخیره اطلاعات تماس انجام نشد.')
    }
  }

  const handleOpenExecutive = (index?: number) => {
    setActionError(null)
    setEditingExecutiveIndex(index ?? -1)
    setExecutiveForm(index === undefined ? { role: '', name: '' } : { ...profile.executives[index] })
  }

  const handleSaveExecutive = async () => {
    if (!executiveForm.name.trim() || !executiveForm.role.trim()) return
    setActionError(null)
    const executives = [...profile.executives]
    if (editingExecutiveIndex === -1) executives.push({ ...executiveForm })
    else if (editingExecutiveIndex !== null) executives[editingExecutiveIndex] = { ...executiveForm }
    try {
      const updated = await apiUpdateProfile({ executives })
      if (!updated) throw new Error('executive_update_failed')
      setProfile(updated)
      setEditingExecutiveIndex(null)
    } catch {
      setActionError('ذخیره شخص انجام نشد.')
    }
  }

  const handleDeleteExecutive = async (index: number) => {
    setActionError(null)
    try {
      const updated = await apiUpdateProfile({ executives: profile.executives.filter((_, itemIndex) => itemIndex !== index) })
      if (!updated) throw new Error('executive_delete_failed')
      setProfile(updated)
    } catch {
      setActionError('حذف شخص انجام نشد.')
    }
  }

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    router.push('/login')
  }

  return (
    <div className="flex w-full flex-col gap-6 p-4 font-sans sm:p-6 lg:p-10" dir="rtl">
      {/* Page Title: "صفحه پروفایل" (Figma node 238:4215) */}
      <h1 className="text-2xl leading-9 font-bold text-[#404040] sm:text-[24px]">صفحه پروفایل</h1>
      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

      {/* Main Container Card: (Figma node 238:4479) */}
      <div className="flex min-h-[880px] flex-col items-stretch gap-6 rounded-[16px] border border-[#e5e5e5] bg-white p-4 shadow-xs sm:p-6 lg:flex-row lg:gap-8">
        {/* Right Column (in RTL): Internal Sidebar Navigation (Figma node 30508:8651) */}
        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-[#e5e5e5] pb-4 sm:grid-cols-4 lg:flex lg:w-[200px] lg:flex-col lg:gap-4 lg:border-e lg:border-b-0 lg:pe-3 lg:pb-0">
          {/* 1. "پروفایل شرکت" tab */}
          <div className="relative flex w-full items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('company')}
              className={`flex min-h-10 w-full flex-1 cursor-pointer items-center justify-between rounded-[12px] px-3 py-2 text-sm leading-6 transition-colors sm:text-base sm:leading-7 ${
                activeTab === 'company'
                  ? 'bg-[#eef2ff] font-normal text-[#2563eb]'
                  : 'bg-transparent text-[#525252] hover:bg-neutral-100'
              }`}
            >
              <span className="w-full text-center">پروفایل شرکت</span>
              {activeTab === 'company' && (
                <span
                  className="hidden h-7 w-1 shrink-0 rounded-full bg-[#3b82f6] lg:block"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {/* 2. "رزومه" tab */}
          <div className="relative flex w-full items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('resume')}
              className={`flex min-h-10 w-full flex-1 cursor-pointer items-center justify-between rounded-[12px] px-3 py-2 text-sm leading-6 transition-colors sm:text-base sm:leading-7 ${
                activeTab === 'resume'
                  ? 'bg-[#eef2ff] font-normal text-[#2563eb]'
                  : 'bg-transparent text-[#525252] hover:bg-neutral-100'
              }`}
            >
              <span className="w-full text-center">رزومه</span>
              {activeTab === 'resume' && (
                <span
                  className="hidden h-7 w-1 shrink-0 rounded-full bg-[#3b82f6] lg:block"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {/* 3. "اطلاعات حساب" tab */}
          <div className="relative flex w-full items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`flex min-h-10 w-full flex-1 cursor-pointer items-center justify-between rounded-[12px] px-3 py-2 text-sm leading-6 transition-colors sm:text-base sm:leading-7 ${
                activeTab === 'account'
                  ? 'bg-[#eef2ff] font-normal text-[#2563eb]'
                  : 'bg-transparent text-[#525252] hover:bg-neutral-100'
              }`}
            >
              <span className="w-full text-center">اطلاعات حساب</span>
              {activeTab === 'account' && (
                <span
                  className="hidden h-7 w-1 shrink-0 rounded-full bg-[#3b82f6] lg:block"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>

          {/* 4. "خروج از حساب کاربری" tab */}
          <div className="relative flex w-full items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLogoutOpen(true)}
              className="flex min-h-10 w-full flex-1 cursor-pointer items-center justify-center rounded-[12px] px-3 py-2 text-sm leading-6 text-[#dc2626] transition-colors hover:bg-red-50 sm:text-base sm:leading-7"
            >
              <span className="w-full text-center">خروج از حساب کاربری</span>
            </button>
          </div>
        </div>

        {/* Left Column (in RTL): Tab Contents Panel */}
        <div className="flex flex-1 flex-col gap-6">
          {/* TAB 1: Company Profile (پروفایل شرکت) */}
          {activeTab === 'company' && (
            <div className="flex flex-col gap-6">
              {/* Header Avatar & Action Buttons (Figma node 30508:8764) */}
              <div className="flex flex-col items-start justify-start gap-4 sm:flex-row sm:items-center">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-[16px] border border-[#e5e5e5] bg-neutral-100 shadow-2xs">
                  <Image
                    src="/figma/dashboard/profile-avatar.png"
                    alt="Company Profile Avatar"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              </div>

              {/* 1. Card "اطلاعات پایه" (Basic Info) (Figma node 30510:9773) */}
              <div className="flex flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4">
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl leading-8 font-bold text-[#525252]">اطلاعات پایه</h2>
                  <button
                    type="button"
                    onClick={handleOpenEditBasic}
                    className="flex h-8 cursor-pointer items-center gap-2 rounded-[10px] bg-[#f5f5f5] px-3 py-2 text-sm leading-6 text-[#525252] transition-colors hover:bg-neutral-200"
                  >
                    <DashboardEditIcon className="size-5 text-[#525252]" />
                    <span>ویرایش</span>
                  </button>
                </div>

                {/* 2-Column Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Right Column (in RTL) */}
                  <div className="flex flex-col gap-4">
                    {/* نام شرکت */}
                    <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        نام شرکت
                      </span>
                      <span className="text-base leading-7 font-semibold text-[#525252]">
                        {profile.company.name}
                      </span>
                    </div>

                    {/* وضعیت شرکت */}
                    <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        وضعیت شرکت
                      </span>
                      <span className="text-base leading-7 font-semibold text-[#525252]">
                        {profile.company.status}
                      </span>
                    </div>

                    {/* شماره ثبت */}
                    <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        شماره ثبت
                      </span>
                      <span dir="ltr" className="text-base leading-7 font-semibold text-[#525252]">
                        {profile.company.registrationNumber}
                      </span>
                    </div>

                    {/* شناسه ملی */}
                    <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        شناسه ملی
                      </span>
                      <span dir="ltr" className="text-base leading-7 font-semibold text-[#525252]">
                        {profile.company.nationalId}
                      </span>
                    </div>
                  </div>

                  {/* Left Column (in RTL) */}
                  <div className="flex flex-col gap-4">
                    {/* تاریخ تاسیس */}
                    <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        تاریخ تاسیس
                      </span>
                      <span dir="auto" className="text-base leading-7 font-semibold text-[#525252]">
                        {profile.company.establishmentDate}
                      </span>
                    </div>

                    {/* نوع شرکت */}
                    <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        نوع شرکت
                      </span>
                      <span className="text-base leading-7 font-semibold text-[#525252]">
                        {profile.company.type}
                      </span>
                    </div>

                    {/* کد اقتصادی */}
                    <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        کد اقتصادی
                      </span>
                      <span dir="ltr" className="text-base leading-7 font-semibold text-[#525252]">
                        {profile.company.economicCode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Card "آدرس ها" (Addresses) (Figma node 30510:9808) */}
              <div className="flex flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4">
                {/* Card Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl leading-8 font-bold text-[#525252]">آدرس ها</h2>
                  <button
                    type="button"
                    onClick={handleOpenAddAddress}
                    className="flex h-8 cursor-pointer items-center gap-2 rounded-[10px] bg-[#f5f5f5] px-3 py-2 text-sm leading-6 text-[#525252] transition-colors hover:bg-neutral-200"
                  >
                    <DashboardAddIcon className="size-5 text-[#525252]" />
                    <span>آدرس جدید</span>
                  </button>
                </div>

                {/* Addresses List */}
                <div className="flex flex-col gap-4">
                  {profile.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-4 text-start"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-base leading-7 font-bold text-[#525252]">
                          {addr.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-red-50 hover:text-red-500"
                            title="حذف آدرس"
                          >
                            <DashboardTrashIcon className="size-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditAddress(addr)}
                            className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-neutral-100"
                            title="ویرایش آدرس"
                          >
                            <DashboardEditIcon className="size-5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-base leading-7 font-semibold text-[#a3a3a3]">
                        {addr.address}
                      </p>
                      <p className="text-base leading-7 font-semibold text-[#a3a3a3]">
                        کد پستی: <bdi dir="ltr">{addr.postalCode}</bdi>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Card "اشخاص" (Executives) (Figma node 30510:9945) */}
              <div className="flex flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl leading-8 font-bold text-[#525252]">اشخاص</h2>
                  <button
                    type="button"
                    onClick={() => handleOpenExecutive()}
                    className="flex h-8 cursor-pointer items-center gap-2 rounded-[10px] bg-[#f5f5f5] px-3 py-2 text-sm leading-6 text-[#525252] transition-colors hover:bg-neutral-200"
                  >
                    <DashboardAddIcon className="size-5 text-[#525252]" />
                    <span>سمت جدید</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {profile.executives.length === 0 && <p className="text-sm text-neutral-400">شخصی ثبت نشده است.</p>}
                  {profile.executives.map((exec, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-3 text-start"
                    >
                      <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                        {exec.role}
                      </span>
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-base leading-7 font-semibold text-[#525252]">{exec.name}</span>
                          <span className="flex gap-1">
                            <button type="button" onClick={() => handleOpenExecutive(idx)} className="flex size-8 items-center justify-center rounded-lg hover:bg-neutral-100" title="ویرایش شخص"><DashboardEditIcon className="size-5" /></button>
                            <button type="button" onClick={() => handleDeleteExecutive(idx)} className="flex size-8 items-center justify-center rounded-lg hover:bg-red-50" title="حذف شخص"><DashboardTrashIcon className="size-5" /></button>
                          </span>
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Resume (رزومه) */}
          {activeTab === 'resume' && (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-[16px] border border-[#e5e5e5] bg-white p-8 text-center">
              <span className="text-xl font-bold text-[#525252]">رزومه و سوابق شرکت</span>
              <p className="max-w-md text-sm text-[#a3a3a3]">
                هنوز رزومه یا سابقه‌ای برای این شرکت ثبت نشده است.
              </p>
            </div>
          )}

          {/* TAB 3: Account Information (اطلاعات حساب) (Figma node 30510:12193) */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-6">
              {/* Card "اطلاعات تماس" */}
              <div className="flex flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl leading-8 font-bold text-[#525252]">اطلاعات تماس</h2>
                  <button
                    type="button"
                    onClick={handleOpenEditContact}
                    className="flex h-8 cursor-pointer items-center gap-2 rounded-[10px] bg-[#f5f5f5] px-3 py-2 text-sm leading-6 text-[#525252] transition-colors hover:bg-neutral-200"
                  >
                    <DashboardEditIcon className="size-5 text-[#525252]" />
                    <span>ویرایش</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* شماره تلفن همراه */}
                  <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                    <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                      شماره تلفن همراه
                    </span>
                    <span dir="ltr" className="text-base leading-7 font-semibold text-[#525252]">
                      {profile.contacts.phone}
                    </span>
                  </div>

                  {/* آدرس ایمیل */}
                  <div className="flex flex-col items-start gap-3 rounded-[8px] border border-[#f5f5f5] p-2 text-start">
                    <span className="text-sm leading-6 font-semibold text-[#a3a3a3]">
                      آدرس ایمیل
                    </span>
                    <span dir="ltr" className="text-base leading-7 font-semibold text-[#525252]">
                      {profile.contacts.email}
                    </span>
                  </div>
                </div>
              </div>

              {/* Button "تغییر رمز عبور" (Figma node 30510:12491) */}
              <div className="flex justify-start">
                <button
                  type="button"
                  disabled
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-[#f5f5f5] px-4 py-2 text-base font-semibold text-[#525252] transition-colors hover:bg-neutral-200"
                >
                  <DashboardEditIcon className="size-5 text-[#525252]" />
                  <span>تغییر رمز عبور</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingExecutiveIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl leading-8 font-bold text-[#525252]">{editingExecutiveIndex === -1 ? 'افزودن شخص' : 'ویرایش شخص'}</h3>
              <button type="button" onClick={() => setEditingExecutiveIndex(null)} className="flex size-10 items-center justify-center rounded-[10px] text-[#525252] hover:bg-neutral-100" aria-label="بستن پنجره"><DashboardCloseCircle className="size-6" /></button>
            </div>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[#404040]">نام و نام خانوادگی<input value={executiveForm.name} onChange={(event) => setExecutiveForm({ ...executiveForm, name: event.target.value })} className="h-10 rounded-lg border border-neutral-200 px-3 font-normal" required /></label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-[#404040]">سمت<input value={executiveForm.role} onChange={(event) => setExecutiveForm({ ...executiveForm, role: event.target.value })} className="h-10 rounded-lg border border-neutral-200 px-3 font-normal" required /></label>
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setEditingExecutiveIndex(null)} className="h-10 rounded-lg border border-neutral-200 px-4 text-sm">انصراف</button><button type="button" onClick={handleSaveExecutive} className="h-10 rounded-lg bg-brand-600 px-4 text-sm text-white">ذخیره</button></div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ویرایش اطلاعات پایه (Figma node 30510:11062) */}
      {/* ========================================================================= */}
      {isEditBasicOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative flex w-full max-w-[420px] flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl leading-8 font-bold text-[#525252]">ویرایش اطلاعات پایه</h3>
              <button
                type="button"
                onClick={() => setIsEditBasicOpen(false)}
                className="flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-neutral-100"
              >
                <DashboardCloseCircle className="size-6" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pe-1">
              {/* نام شرکت */}
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">نام شرکت</label>
                <div className="relative flex h-10 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3">
                  <input
                    type="text"
                    value={basicForm.name}
                    onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                    className="w-full pe-7 text-start text-base text-[#525252] outline-none"
                  />
                  {basicForm.name && (
                    <button
                      type="button"
                      onClick={() => setBasicForm({ ...basicForm, name: '' })}
                      className="absolute end-2 text-[#a3a3a3] hover:text-[#525252]"
                    >
                      <DashboardCloseCircle className="size-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* تاریخ تاسیس */}
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">تاریخ تاسیس</label>
                <div className="relative flex h-10 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3">
                  <input
                    type="text"
                    dir="auto"
                    value={basicForm.establishmentDate}
                    onChange={(e) =>
                      setBasicForm({ ...basicForm, establishmentDate: e.target.value })
                    }
                    className="w-full pe-7 text-start text-base text-[#525252] outline-none"
                  />
                  {basicForm.establishmentDate && (
                    <button
                      type="button"
                      onClick={() => setBasicForm({ ...basicForm, establishmentDate: '' })}
                      className="absolute end-2 text-[#a3a3a3] hover:text-[#525252]"
                    >
                      <DashboardCloseCircle className="size-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* وضعیت شرکت */}
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">وضعیت شرکت</label>
                <div className="relative flex h-10 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3">
                  <input
                    type="text"
                    value={basicForm.status}
                    onChange={(e) => setBasicForm({ ...basicForm, status: e.target.value })}
                    className="w-full pe-7 text-start text-base text-[#525252] outline-none"
                  />
                  {basicForm.status && (
                    <button
                      type="button"
                      onClick={() => setBasicForm({ ...basicForm, status: '' })}
                      className="absolute end-2 text-[#a3a3a3] hover:text-[#525252]"
                    >
                      <DashboardCloseCircle className="size-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* نوع شرکت */}
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">نوع شرکت</label>
                <div className="relative flex h-10 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3">
                  <input
                    type="text"
                    value={basicForm.type}
                    onChange={(e) => setBasicForm({ ...basicForm, type: e.target.value })}
                    className="w-full pe-7 text-start text-base text-[#525252] outline-none"
                  />
                  {basicForm.type && (
                    <button
                      type="button"
                      onClick={() => setBasicForm({ ...basicForm, type: '' })}
                      className="absolute end-2 text-[#a3a3a3] hover:text-[#525252]"
                    >
                      <DashboardCloseCircle className="size-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* شماره ثبت */}
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">شماره ثبت</label>
                <div className="relative flex h-10 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3">
                  <input
                    type="text"
                    dir="ltr"
                    value={basicForm.registrationNumber}
                    onChange={(e) =>
                      setBasicForm({ ...basicForm, registrationNumber: e.target.value })
                    }
                    className="w-full ps-7 text-end text-base text-[#525252] outline-none"
                  />
                  {basicForm.registrationNumber && (
                    <button
                      type="button"
                      onClick={() => setBasicForm({ ...basicForm, registrationNumber: '' })}
                      className="absolute end-2 text-[#a3a3a3] hover:text-[#525252]"
                    >
                      <DashboardCloseCircle className="size-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* کد اقتصادی */}
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">کد اقتصادی</label>
                <div className="relative flex h-10 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3">
                  <input
                    type="text"
                    dir="ltr"
                    value={basicForm.economicCode}
                    onChange={(e) => setBasicForm({ ...basicForm, economicCode: e.target.value })}
                    className="w-full ps-7 text-end text-base text-[#525252] outline-none"
                  />
                  {basicForm.economicCode && (
                    <button
                      type="button"
                      onClick={() => setBasicForm({ ...basicForm, economicCode: '' })}
                      className="absolute end-2 text-[#a3a3a3] hover:text-[#525252]"
                    >
                      <DashboardCloseCircle className="size-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* شناسه ملی */}
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">شناسه ملی</label>
                <div className="relative flex h-10 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3">
                  <input
                    type="text"
                    dir="ltr"
                    value={basicForm.nationalId}
                    onChange={(e) => setBasicForm({ ...basicForm, nationalId: e.target.value })}
                    className="w-full ps-7 text-end text-base text-[#525252] outline-none"
                  />
                  {basicForm.nationalId && (
                    <button
                      type="button"
                      onClick={() => setBasicForm({ ...basicForm, nationalId: '' })}
                      className="absolute end-2 text-[#a3a3a3] hover:text-[#525252]"
                    >
                      <DashboardCloseCircle className="size-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditBasicOpen(false)}
                className="h-10 flex-1 cursor-pointer rounded-[10px] border border-[#3b82f6] text-base font-semibold text-[#3b82f6] transition-colors hover:bg-blue-50"
              >
                لغو
              </button>
              <button
                type="button"
                onClick={handleSaveBasic}
                className="h-10 flex-1 cursor-pointer rounded-[10px] bg-[#3b82f6] text-base font-semibold text-white transition-colors hover:bg-blue-600"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: اضافه کردن آدرس جدید (Figma node 30510:11398) */}
      {/* ========================================================================= */}
      {isAddAddressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative flex w-full max-w-[420px] flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl leading-8 font-bold text-[#525252]">اضافه کردن آدرس جدید</h3>
              <button
                type="button"
                onClick={() => setIsAddAddressOpen(false)}
                className="flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-neutral-100"
              >
                <DashboardCloseCircle className="size-6" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pe-1">
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">نام آدرس</label>
                <input
                  type="text"
                  placeholder="متن پلیس هولدر"
                  value={addressForm.title}
                  onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-start text-base text-[#525252] outline-none placeholder:text-[#a3a3a3]"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">استان</label>
                <input
                  type="text"
                  placeholder="متن پلیس هولدر"
                  value={addressForm.province}
                  onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-start text-base text-[#525252] outline-none placeholder:text-[#a3a3a3]"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">شهر</label>
                <input
                  type="text"
                  placeholder="متن پلیس هولدر"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-start text-base text-[#525252] outline-none placeholder:text-[#a3a3a3]"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">کد پستی</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="متن پلیس هولدر"
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-end text-base text-[#525252] outline-none placeholder:text-[#a3a3a3]"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">آدرس</label>
                <textarea
                  rows={4}
                  placeholder="متن پلیس هولدر"
                  value={addressForm.address}
                  onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                  className="resize-none rounded-[8px] border border-[#e5e5e5] p-3 text-start text-base text-[#525252] outline-none placeholder:text-[#a3a3a3]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddAddressOpen(false)}
                className="h-10 flex-1 cursor-pointer rounded-[10px] border border-[#3b82f6] text-base font-semibold text-[#3b82f6] transition-colors hover:bg-blue-50"
              >
                لغو
              </button>
              <button
                type="button"
                onClick={handleSaveAddAddress}
                className="h-10 flex-1 cursor-pointer rounded-[10px] bg-[#3b82f6] text-base font-semibold text-white transition-colors hover:bg-blue-600"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ویرایش آدرس (Figma node 30510:11849) */}
      {/* ========================================================================= */}
      {editingAddress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative flex w-full max-w-[420px] flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl leading-8 font-bold text-[#525252]">ویرایش آدرس</h3>
              <button
                type="button"
                onClick={() => setEditingAddress(null)}
                className="flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-neutral-100"
              >
                <DashboardCloseCircle className="size-6" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pe-1">
              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">نام آدرس</label>
                <input
                  type="text"
                  value={addressForm.title}
                  onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-start text-base text-[#525252] outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">استان</label>
                <input
                  type="text"
                  value={addressForm.province}
                  onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-start text-base text-[#525252] outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">شهر</label>
                <input
                  type="text"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-start text-base text-[#525252] outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">کد پستی</label>
                <input
                  type="text"
                  dir="ltr"
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-end text-base text-[#525252] outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 text-start">
                <label className="text-base font-semibold text-[#404040]">آدرس</label>
                <textarea
                  rows={4}
                  value={addressForm.address}
                  onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                  className="resize-none rounded-[8px] border border-[#e5e5e5] p-3 text-start text-base text-[#525252] outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAddress(null)}
                className="h-10 flex-1 cursor-pointer rounded-[10px] border border-[#3b82f6] text-base font-semibold text-[#3b82f6] transition-colors hover:bg-blue-50"
              >
                لغو
              </button>
              <button
                type="button"
                onClick={handleSaveEditAddress}
                className="h-10 flex-1 cursor-pointer rounded-[10px] bg-[#3b82f6] text-base font-semibold text-white transition-colors hover:bg-blue-600"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ویرایش اطلاعات تماس (Contact Info Edit Modal) */}
      {/* ========================================================================= */}
      {isEditContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative flex w-full max-w-[420px] flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl leading-8 font-bold text-[#525252]">ویرایش اطلاعات تماس</h3>
              <button
                type="button"
                onClick={() => setIsEditContactOpen(false)}
                className="flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-neutral-100"
              >
                <DashboardCloseCircle className="size-6" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-start">
              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-[#404040]">شماره تلفن همراه</label>
                <input
                  type="text"
                  dir="ltr"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-end text-base text-[#525252] outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-[#404040]">آدرس ایمیل</label>
                <input
                  type="email"
                  dir="ltr"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="h-10 rounded-[8px] border border-[#e5e5e5] px-3 text-end text-base text-[#525252] outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditContactOpen(false)}
                className="h-10 flex-1 cursor-pointer rounded-[10px] border border-[#3b82f6] text-base font-semibold text-[#3b82f6] transition-colors hover:bg-blue-50"
              >
                لغو
              </button>
              <button
                type="button"
                onClick={handleSaveContact}
                className="h-10 flex-1 cursor-pointer rounded-[10px] bg-[#3b82f6] text-base font-semibold text-white transition-colors hover:bg-blue-600"
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: خروج از حساب کاربری (Figma node 30510:12902) */}
      {/* ========================================================================= */}
      {isLogoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative flex w-full max-w-[400px] flex-col gap-5 rounded-[16px] border border-[#e5e5e5] bg-white p-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl leading-8 font-bold text-[#525252]">خروج از حساب کاربری</h3>
              <button
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                className="flex size-10 cursor-pointer items-center justify-center rounded-[10px] text-[#525252] transition-colors hover:bg-neutral-100"
              >
                <DashboardCloseCircle className="size-6" />
              </button>
            </div>

            {/* Message Body */}
            <div className="flex items-center justify-start text-start">
              <p className="text-base leading-7 font-semibold text-[#737373]">
                آیا می‌خواهید از حساب کاربری خود خارج شوید؟
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutOpen(false)}
                className="h-10 flex-1 cursor-pointer rounded-[10px] border border-[#e5e5e5] text-base font-semibold text-[#525252] transition-colors hover:bg-neutral-100"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="h-10 flex-1 cursor-pointer rounded-[10px] bg-[#ef4444] text-base font-semibold text-white transition-colors hover:bg-red-600"
              >
                خروج از حساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
