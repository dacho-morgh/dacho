'use client'

import { useState } from 'react'
import { DashboardEditIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { ContactInfoDto, ProfileDto } from '@/utilities/dashboard-api'
import { updateProfile } from '@/utilities/dashboard-api'
import { InlineProfileField } from './inline-profile-field'

export function AccountProfileView({ initialProfile }: { initialProfile: ProfileDto }) {
  const [profile, setProfile] = useState(initialProfile)
  const [form, setForm] = useState<ContactInfoDto>(initialProfile.contacts)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEdit = () => {
    setForm({ ...profile.contacts })
    setError(null)
    setIsEditing(true)
  }

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
      <section className="flex flex-col gap-5 rounded-2xl border border-neutral-100 bg-white p-4">
        <div className="flex items-center justify-between">
          <Typography as="h2" variant="20/bold" color="neutral-600">
            اطلاعات تماس
          </Typography>
          <Button
            type="button"
            variant={isEditing ? 'primary' : 'gray'}
            size="32"
            loading={isSaving}
            onClick={isEditing ? handleSave : handleEdit}
          >
            {!isEditing && <DashboardEditIcon className="size-5" />}
            {isEditing ? 'ذخیره' : 'ویرایش'}
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InlineProfileField
            label="شماره تلفن همراه"
            value={form.phone}
            editing={isEditing}
            dir="ltr"
            onChange={(phone) => setForm({ ...form, phone })}
          />
          <InlineProfileField
            label="آدرس ایمیل"
            value={form.email}
            editing={isEditing}
            dir="ltr"
            type="email"
            onChange={(email) => setForm({ ...form, email })}
          />
        </div>
      </section>
      <div className="flex justify-start">
        <Button type="button" variant="gray" disabled>
          <DashboardEditIcon className="size-5" />
          تغییر رمز عبور
        </Button>
      </div>
    </div>
  )
}
