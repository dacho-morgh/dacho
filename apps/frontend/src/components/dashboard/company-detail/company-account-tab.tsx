import { DashboardEditIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { CompanyDetailResponse } from '@/components/dashboard/company-detail-view'
import { DetailCard, InfoField } from './company-detail-parts'

/** The representative's sign-in contact details (Figma 30950:17441). */
export function CompanyAccountTab({ representative }: { representative: CompanyDetailResponse['representative'] }) {
  return (
    <>
      <DetailCard
        title="اطلاعات تماس"
        action={
          // Changing a representative's contact details is not an admin action the server offers yet.
          <Button disabled variant="gray" size="32" icon={<DashboardEditIcon />} className="px-3">
            <Typography as="span" variant="14/regular" className="text-inherit">
              ویرایش
            </Typography>
          </Button>
        }
      >
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <InfoField label="شماره تلفن همراه" value={representative?.phone || '—'} />
          <InfoField label="آدرس ایمیل" value={representative?.email || '—'} />
          <InfoField label="نام نماینده" value={representative?.name || '—'} />
          <InfoField label="سمت" value={representative?.position || '—'} />
        </div>
      </DetailCard>

      {/* Resetting a representative's password has no admin endpoint yet, so the control stays inert. */}
      <Button
        disabled
        variant="gray"
        size="40"
        icon={<DashboardEditIcon className="size-6" />}
        className="w-fit px-4"
      >
        <Typography as="span" variant="16/semibold" className="text-inherit">
          تغییر رمز عبور
        </Typography>
      </Button>
    </>
  )
}
