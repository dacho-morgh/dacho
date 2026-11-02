import { Badge } from '@/components/ui/badge'
import {
  DashboardApiError,
  type BoothReceiptStatus,
  type BoothReservationDto,
} from '@/utilities/dashboard-api'

type BadgeVariant = 'gray' | 'yellow' | 'blue' | 'green' | 'red'

/** One label per booth request: attendance first, then payment (FE26, FE27). */
export function boothRequestStage(reservation: BoothReservationDto): {
  label: string
  variant: BadgeVariant
} {
  if (reservation.attendanceStatus === 'pending')
    return { label: 'در انتظار تأیید حضور', variant: 'yellow' }
  if (reservation.attendanceStatus === 'rejected') return { label: 'حضور رد شد', variant: 'red' }
  switch (reservation.paymentStatus) {
    case 'pending_verification':
      return { label: 'فیش در حال بررسی', variant: 'blue' }
    case 'returned':
      return { label: 'فیش برگشت خورد', variant: 'red' }
    case 'confirmed':
      return { label: 'پرداخت تأیید شد', variant: 'green' }
    case 'cancelled':
      return { label: 'لغو شده', variant: 'gray' }
    default:
      return { label: 'در انتظار بارگذاری فیش', variant: 'gray' }
  }
}

export function BoothRequestStageBadge({ reservation }: { reservation: BoothReservationDto }) {
  const stage = boothRequestStage(reservation)
  return (
    <Badge variant={stage.variant} size="md">
      {stage.label}
    </Badge>
  )
}

export const receiptStatusLabel: Record<BoothReceiptStatus, string> = {
  pending_verification: 'در حال بررسی',
  returned: 'برگشت‌خورده',
  confirmed: 'تأییدشده',
}

/** Persian copy for the booth API's error codes; unknown failures stay generic. */
export function boothFailure(error: unknown, fallback: string): string {
  if (!(error instanceof DashboardApiError)) return fallback
  switch (error.code) {
    case 'company_not_verified':
      return 'شرکت شما هنوز احراز هویت نشده است. پس از تأیید احراز می‌توانید غرفه درخواست کنید.'
    case 'company_not_found':
      return 'شرکتی برای حساب شما ثبت نشده است.'
    case 'booth_unavailable':
      return 'این غرفه هم‌زمان برای شرکت دیگری رزرو شد. فهرست غرفه‌ها به‌روز شد.'
    case 'company_limit_reached':
      return 'به سقف تعداد غرفه برای هر شرکت رسیده‌اید.'
    case 'catalogue_not_configured':
      return 'کاتالوگ غرفه‌های این نمایشگاه هنوز آماده نشده است.'
    case 'attendance_not_approved':
      return 'بارگذاری فیش پس از تأیید حضور توسط دبیرخانه ممکن است.'
    case 'attendance_rejected':
    case 'reservation_inactive':
      return 'این درخواست دیگر فعال نیست.'
    case 'receipt_pending':
      return 'فیش قبلی در حال بررسی است. پس از تصمیم دبیرخانه می‌توانید دوباره اقدام کنید.'
    case 'payment_confirmed':
      return 'پرداخت این غرفه قبلاً تأیید شده است.'
    case 'duplicate_receipt':
      return 'این فیش یا کد پیگیری برای غرفه دیگری ثبت شده است.'
    case 'invalid_file_type':
    case 'invalid_file':
      return 'فقط فایل PDF یا Word قابل بارگذاری است.'
    case 'file_too_large':
      return 'حجم فایل نباید از ۱۰ مگابایت بیشتر باشد.'
    case 'reason_required':
      return 'نوشتن دلیل الزامی است.'
    case 'stale_receipt':
    case 'invalid_state':
      return 'این درخواست در این فاصله تغییر کرده است. فهرست به‌روز شد.'
  }
  if (error.status === 401) return 'نشست شما پایان یافته است. دوباره وارد شوید.'
  if (error.status === 403) return 'اجازه این کار را ندارید.'
  if (error.status === 404) return 'این نمایشگاه یا درخواست پیدا نشد.'
  if (error.status >= 500) return 'ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.'
  return fallback
}
