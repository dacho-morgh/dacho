import type { RequestItem, RecentRequestItem } from './types'

/* ── Requests List Mock Data (Figma node 42:4330) ────────────────────────── */

export const mockRequestsList: RequestItem[] = [
  {
    id: 'REQ-1001',
    title: 'همایش نفت و گاز عسلویه',
    status: 'in_review',
    statusLabel: 'درحال بررسی',
    dueDate: '1405/01/06',
    createdDate: '1405/01/06',
  },
  {
    id: 'REQ-1002',
    title: 'همایش نفت و گاز عسلویه',
    status: 'rejected',
    statusLabel: 'رد شده',
    dueDate: '1405/01/06',
    createdDate: '1405/01/06',
  },
  {
    id: 'REQ-1003',
    title: 'همایش نفت و گاز عسلویه',
    status: 'draft',
    statusLabel: 'درخواست داده نشده',
    dueDate: '1405/01/06',
    createdDate: '1405/01/06',
  },
]

/* ── Dashboard Recent Requests Mock Data ───────────────────────────────── */

export const mockRecentRequests: RecentRequestItem[] = [
  {
    id: 'req-101',
    trackingCode: 'DCH-1403-8821',
    title: 'توسعه پلتفرم هوشمند پایش خوردگی خطوط انتقال نفت',
    serviceName: 'تأمین مالی و سرمایه‌گذاری',
    serviceType: 'financing',
    currentStep: 'بررسی کمیته داوران تخصصی',
    assignedRole: 'داور فنی',
    status: 'in_review',
    submissionDate: '۱۴۰۳/۰۵/۱۲',
    updatedAt: '۲ ساعت پیش',
  },
  {
    id: 'req-102',
    trackingCode: 'DCH-1403-7749',
    title: 'رزرو غرفه اختصاصی در نمایشگاه بین‌المللی نفت و گاز عسلویه',
    serviceName: 'خدمات نمایشگاهی',
    serviceType: 'exhibitions',
    currentStep: 'صدور پیش‌فاکتور و پرداخت',
    assignedRole: 'واحد حسابداری',
    status: 'action_needed',
    submissionDate: '۱۴۰۳/۰۵/۱۸',
    updatedAt: 'دیروز',
  },
  {
    id: 'req-103',
    trackingCode: 'DCH-1403-6512',
    title: 'شرکت در رویداد پیچ و جذب سرمایه‌گذار خطرپذیر پتروشیمی',
    serviceName: 'رویدادها و رقابت‌ها',
    serviceType: 'events',
    currentStep: 'تأیید نهایی دبیرخانه',
    assignedRole: 'دبیرخانه رویداد',
    status: 'approved',
    submissionDate: '۱۴۰۳/۰۴/۲۹',
    updatedAt: '۳ روز پیش',
  },
  {
    id: 'req-104',
    trackingCode: 'DCH-1403-5490',
    title: 'مشاوره ارزیابی و اخذ گواهی دانش‌بنیان نوع ۱',
    serviceName: 'خدمات دانش‌بنیانی',
    serviceType: 'knowledge',
    currentStep: 'جلسه منتورینگ و تنظیم اظهارنامه',
    assignedRole: 'مشاور تخصصی',
    status: 'in_review',
    submissionDate: '۱۴۰۳/۰۴/۱۵',
    updatedAt: '۱ هفته پیش',
  },
]
