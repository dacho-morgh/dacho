import { Typography } from '@/components/ui/typography'
import type { DashboardOwnProfileDto } from '@/utilities/dashboard-api'

export function StaffProfileView({
  initialProfile,
  name,
  position,
  accessLabel,
}: {
  initialProfile: DashboardOwnProfileDto
  name: string
  position: string
  accessLabel: string
}) {
  return (
    <div className="flex flex-col gap-6" dir="rtl">
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
        <div>
          <Typography as="h2" variant="20/bold" color="neutral-600">
            اطلاعات تماس
          </Typography>
          <Typography className="mt-1" color="neutral-400">
            برای تغییر اطلاعات تماس با پشتیبانی سامانه تماس بگیرید.
          </Typography>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadOnlyProfileField label="شماره تلفن همراه" value={initialProfile.contacts.phone} />
          <ReadOnlyProfileField label="آدرس ایمیل" value={initialProfile.contacts.email} />
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
