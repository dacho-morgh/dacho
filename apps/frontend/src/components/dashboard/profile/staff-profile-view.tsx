'use client'

import { useState } from 'react'
import { DashboardEditIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { ContactInfoDto, ProfileDto } from '@/utilities/dashboard-api'
import { updateProfile } from '@/utilities/dashboard-api'
import { InlineProfileField } from './inline-profile-field'

export function StaffProfileView({
  initialProfile,
  name,
  position,
  accessLabel,
}: {
  initialProfile: ProfileDto
  name: string
  position: string
  accessLabel: string
}) {
  const [profile, setProfile] = useState(initialProfile)
  const [form, setForm] = useState<ContactInfoDto>(initialProfile.contacts)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const updated = await updateProfile({ contacts: form })
      if (!updated) throw new Error('contact_update_failed')
      setProfile(updated)
      setForm(updated.contacts)
      setIsEditing(false)
    } catch {
      setError('ذخیره اطلاعات تماس انجام نشد.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {error && (
        <Typography role="alert" color="error" className="rounded-lg bg-error-50 p-3">
          {error}
        </Typography>
      )}

      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div>
          <Typography as="h2" variant="20/bold" color="neutral-600">
            اطلاعات فردی
          </Typography>
          <Typography className="mt-1" color="neutral-400">
            مشخصات حساب کاربری شما در سامانه
          </Typography>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadOnlyProfileField label="نام و نام خانوادگی" value={name} />
          <ReadOnlyProfileField label="سمت" value={position} />
          <ReadOnlyProfileField label="نوع دسترسی" value={accessLabel} />
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Typography as="h2" variant="20/bold" color="neutral-600">
              اطلاعات تماس
            </Typography>
            <Typography className="mt-1" color="neutral-400">
              شماره تلفن و ایمیل حساب کاربری
            </Typography>
          </div>
          <Button
            type="button"
            variant={isEditing ? 'primary' : 'gray'}
            size="32"
            loading={isSaving}
            onClick={() => {
              if (isEditing) void handleSave()
              else {
                setForm({ ...profile.contacts })
                setError(null)
                setIsEditing(true)
              }
            }}
          >
            {!isEditing && <DashboardEditIcon className="size-5" />}
            {isEditing ? 'ذخیره' : 'ویرایش'}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InlineProfileField
            label="شماره تلفن همراه"
            value={form.phone}
            editing={isEditing}
            dir="ltr"
            onChange={(phone) => setForm((current) => ({ ...current, phone }))}
          />
          <InlineProfileField
            label="آدرس ایمیل"
            value={form.email}
            editing={isEditing}
            dir="ltr"
            type="email"
            onChange={(email) => setForm((current) => ({ ...current, email }))}
          />
        </div>
      </section>
    </div>
  )
}

function ReadOnlyProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-100 p-3 text-start">
      <Typography variant="14/semibold" color="neutral-400">
        {label}
      </Typography>
      <Typography color="neutral-700">{value || '—'}</Typography>
    </div>
  )
}
