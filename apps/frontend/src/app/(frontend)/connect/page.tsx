import { MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { MessageForm } from '@/components/landing/contact/message-form'
import { Typography } from '@/components/ui/typography'
import { getFormIdByTitle } from '@/utilities/getFormId'
import { createPageMetadata } from '@/utilities/siteMetadata'

// Server-rendered per request: the form id comes from the database (seeded via
// `scripts/seed-forms.ts`), so the page must not be prerendered at build time.
export const dynamic = 'force-dynamic'

const MESSAGE_FORM_TITLE = 'فرم تماس با ما'

export const metadata: Metadata = createPageMetadata({
  title: 'تماس با ما',
  description:
    'راه‌های ارتباط با کارخانه نوآوری صنایع انرژی بوشهر و فرم ارسال پیام، درخواست و گزارش.',
  path: '/connect',
})

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-16 shrink-0 sm:size-20"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="80" height="80" rx="20" fill="#FEF0CD" />
      <path
        d="M53.1127 37.0833C52.1094 37.0833 51.316 36.2667 51.316 35.2867C51.316 34.4233 50.4527 32.6267 49.006 31.0633C47.5827 29.5467 46.0193 28.66 44.7127 28.66C43.7093 28.66 42.916 27.8433 42.916 26.8633C42.916 25.8833 43.7327 25.0667 44.7127 25.0667C47.046 25.0667 49.496 26.3267 51.6427 28.59C53.6493 30.7133 54.9327 33.35 54.9327 35.2633C54.9327 36.2667 54.116 37.0833 53.1127 37.0833Z"
        fill="#FAB622"
      />
      <path
        d="M61.5361 37.0834C60.5328 37.0834 59.7395 36.2667 59.7395 35.2867C59.7395 27.0034 52.9961 20.2834 44.7361 20.2834C43.7328 20.2834 42.9395 19.4667 42.9395 18.4867C42.9395 17.5067 43.7328 16.6667 44.7128 16.6667C54.9795 16.6667 63.3328 25.02 63.3328 35.2867C63.3328 36.2667 62.5161 37.0834 61.5361 37.0834Z"
        fill="#FAB622"
      />
      <path
        d="M39.5093 45.1567L31.8794 52.7867C31.0394 52.04 30.2227 51.27 29.4293 50.4767C27.026 48.05 24.856 45.5067 22.9193 42.8467C21.006 40.1867 19.466 37.5267 18.346 34.89C17.226 32.23 16.666 29.6867 16.666 27.26C16.666 25.6734 16.946 24.1567 17.506 22.7567C18.066 21.3334 18.9527 20.0267 20.1893 18.86C21.6827 17.39 23.316 16.6667 25.0427 16.6667C25.696 16.6667 26.3493 16.8067 26.9327 17.0867C27.5393 17.3667 28.076 17.7867 28.496 18.3934L33.9094 26.0234C34.3294 26.6067 34.6327 27.1434 34.8427 27.6567C35.0527 28.1467 35.1694 28.6367 35.1694 29.08C35.1694 29.64 35.006 30.2 34.6793 30.7367C34.376 31.2734 33.9327 31.8334 33.3727 32.3934L31.5993 34.2367C31.3427 34.4934 31.226 34.7967 31.226 35.17C31.226 35.3567 31.2494 35.52 31.296 35.7067C31.366 35.8934 31.436 36.0334 31.4827 36.1734C31.9027 36.9434 32.626 37.9467 33.6527 39.16C34.7027 40.3734 35.8227 41.61 37.036 42.8467C37.876 43.6634 38.6927 44.4567 39.5093 45.1567Z"
        fill="#FAB622"
        opacity="0.4"
      />
      <path
        d="M63.2637 54.77C63.2637 55.4233 63.1471 56.1 62.9137 56.7533C62.8437 56.94 62.7737 57.1267 62.6804 57.3133C62.2837 58.1533 61.7704 58.9467 61.0937 59.6933C59.9504 60.9533 58.6904 61.8633 57.2671 62.4467C57.2437 62.4467 57.2204 62.47 57.1971 62.47C55.8204 63.03 54.3271 63.3333 52.7171 63.3333C50.3371 63.3333 47.7937 62.7733 45.1104 61.63C42.4271 60.4867 39.7437 58.9467 37.0837 57.01C36.1737 56.3333 35.2637 55.6567 34.4004 54.9333L42.0304 47.3033C42.6837 47.7933 43.2671 48.1667 43.7571 48.4233C43.8737 48.47 44.0137 48.54 44.1771 48.61C44.3637 48.68 44.5504 48.7033 44.7604 48.7033C45.1571 48.7033 45.4604 48.5633 45.7171 48.3067L47.4904 46.5567C48.0737 45.9733 48.6337 45.53 49.1704 45.25C49.7071 44.9233 50.2437 44.76 50.8271 44.76C51.2704 44.76 51.7371 44.8533 52.2504 45.0633C52.7637 45.2733 53.3004 45.5767 53.8837 45.9733L61.6071 51.4567C62.2137 51.8767 62.6337 52.3667 62.8904 52.95C63.1237 53.5333 63.2637 54.1167 63.2637 54.77Z"
        fill="#FAB622"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-16 shrink-0 sm:size-20"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="80" height="80" rx="20" fill="#FEF0CD" />
      <path
        d="M51.666 59.8334H28.3327C21.3327 59.8334 16.666 56.3334 16.666 48.1667V31.8334C16.666 23.6667 21.3327 20.1667 28.3327 20.1667H51.666C58.666 20.1667 63.3327 23.6667 63.3327 31.8334V48.1667C63.3327 56.3334 58.666 59.8334 51.666 59.8334Z"
        fill="#FAB622"
        opacity="0.4"
      />
      <path
        d="M39.9992 42.03C38.0392 42.03 36.0558 41.4233 34.5392 40.1867L27.2358 34.3533C26.4892 33.7467 26.3492 32.65 26.9558 31.9033C27.5625 31.1567 28.6592 31.0167 29.4058 31.6233L36.7091 37.4567C38.4825 38.88 41.4925 38.88 43.2658 37.4567L50.5692 31.6233C51.3158 31.0167 52.4358 31.1333 53.0192 31.9033C53.6258 32.65 53.5092 33.77 52.7392 34.3533L45.4358 40.1867C43.9425 41.4233 41.9592 42.03 39.9992 42.03Z"
        fill="#FAB622"
      />
    </svg>
  )
}

function AddressIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-16 shrink-0 sm:size-20"
      fill="none"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="80" height="80" rx="20" fill="#FEF0CD" />
      <path
        d="M58.3864 60.8599C56.1697 62.4932 53.2531 63.3332 49.7764 63.3332H30.2231C29.6631 63.3332 29.1031 63.3099 28.5664 63.2399L44.6664 47.1399L58.3864 60.8599Z"
        fill="#FAB622"
        opacity="0.4"
      />
      <path
        d="M63.334 30.2233V49.7767C63.334 53.2533 62.494 56.17 60.8606 58.3867L47.1406 44.6667L63.2406 28.5667C63.3106 29.1033 63.334 29.6633 63.334 30.2233Z"
        fill="#FAB622"
        opacity="0.4"
      />
      <path
        d="M47.1393 44.6667L60.8594 58.3867C60.1827 59.3667 59.366 60.1834 58.386 60.8601L44.666 47.1401L28.566 63.2401C27.0727 63.1467 25.7194 62.8434 24.4827 62.3767C19.4894 60.5567 16.666 56.1234 16.666 49.7768V30.2234C16.666 21.7301 21.7293 16.6667 30.2227 16.6667H49.776C56.1227 16.6667 60.556 19.4901 62.376 24.4834C62.8427 25.7201 63.146 27.0734 63.2393 28.5667L47.1393 44.6667Z"
        fill="#FAB622"
        opacity="0.4"
      />
      <path
        d="M47.1391 44.6667L60.8591 58.3867C60.1824 59.3667 59.3658 60.1834 58.3858 60.8601L44.6657 47.1401L28.5658 63.2401C27.0724 63.1467 25.7191 62.8434 24.4824 62.3767L25.3924 61.4667L62.3757 24.4834C62.8424 25.7201 63.1457 27.0734 63.2391 28.5667L47.1391 44.6667Z"
        fill="#FAB622"
      />
      <path
        d="M40.5605 30.5033C39.6739 26.6533 36.2672 24.9267 33.2805 24.9033C30.2939 24.9033 26.8872 26.63 26.0005 30.48C25.0205 34.75 27.6339 38.32 29.9905 40.56C30.9239 41.4467 32.0905 41.8667 33.2805 41.8667C34.4705 41.8667 35.6372 41.4233 36.5705 40.56C38.9272 38.32 41.5405 34.75 40.5605 30.5033ZM33.3505 34.1433C32.0672 34.1433 31.0172 33.0933 31.0172 31.81C31.0172 30.5267 32.0439 29.4767 33.3505 29.4767H33.3739C34.6572 29.4767 35.7072 30.5267 35.7072 31.81C35.7072 33.0933 34.6339 34.1433 33.3505 34.1433Z"
        fill="#FAB622"
      />
    </svg>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="h-12 w-1.5 shrink-0 rounded-full bg-warning-400" />
      <Typography color="neutral-700" md="40/bold" variant="32/bold">
        {children}
      </Typography>
    </div>
  )
}

function ContactCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <article className="flex min-h-52 flex-col gap-5 rounded-[32px] bg-white p-6 shadow-[0_8px_32px_rgb(23_23_23/0.06)] sm:flex-row sm:items-start sm:p-8">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Typography color="neutral-700" variant="24/bold">
          {title}
        </Typography>
        <Typography color="neutral-500" variant="16/regular">
          {description}
        </Typography>
        <div className="mt-auto pt-4">{children}</div>
      </div>
    </article>
  )
}

function MapPlaceholder() {
  return (
    <div
      aria-label="نمایش ساده موقعیت دفتر روی نقشه"
      className="relative min-h-64 w-full overflow-hidden rounded-[24px] bg-neutral-200 lg:min-h-80"
      role="img"
    >
      <div className="absolute inset-y-0 left-1/4 w-16 -rotate-12 bg-white/80" />
      <div className="absolute top-1/4 right-0 h-12 w-full rotate-6 bg-white/80" />
      <div className="absolute inset-y-0 right-1/4 w-7 rotate-12 bg-warning-400/80" />
      <div className="absolute top-2/3 right-0 h-6 w-full -rotate-3 bg-white/70" />
      <span className="absolute top-8 left-7 size-20 rounded-3xl bg-white/60" />
      <span className="absolute right-8 bottom-8 size-24 rounded-full bg-white/50" />
      <span className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
        <MapPin aria-hidden="true" className="size-8 fill-error-500 text-error-500" />
      </span>
    </div>
  )
}

export default async function ConnectPage() {
  const messageFormId = await getFormIdByTitle(MESSAGE_FORM_TITLE)

  return (
    <main className="overflow-x-clip bg-white">
      <section className="container flex flex-col gap-12 pt-10 pb-20 sm:gap-16 lg:pt-16 lg:pb-28">
        <div className="flex flex-col gap-4">
          <SectionTitle>ارتباط پیوسته با ما</SectionTitle>
          <Typography className="max-w-6xl" color="neutral-500" variant="20/regular">
            کارخانه نوآوری به شکل ۲۴ ساعته، پاسخگوی مخاطبان خود است. شما می‌توانید درخواست‌ها، گزارش‌ها
            و پیام‌هایتان را از طریق راه‌های ارتباطی درج شده در این صفحه، به دست ما برسانید.
          </Typography>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ContactCard
            description="پاسخگویی تلفنی به پرسش‌ها و مشکلات شما"
            icon={<PhoneIcon />}
            title="تماس تلفنی"
          >
            <div className="flex flex-wrap gap-x-5 gap-y-2" dir="ltr">
              <Typography asChild color="neutral-800" variant="20/bold">
                <a href="tel:+987712345678">۰۷۷ - ۱۲۳۴ ۵۶ ۷۸</a>
              </Typography>
              <Typography asChild color="neutral-800" variant="20/bold">
                <a href="tel:+987712347898">۰۷۷ - ۱۲۳۴ ۷۸ ۹۸</a>
              </Typography>
            </div>
          </ContactCard>

          <ContactCard
            description="دریافت پیام‌های مکتوب شما از طریق ایمیل"
            icon={<MailIcon />}
            title="ارسال پیام"
          >
            <Typography asChild color="neutral-800" variant="20/bold">
              <a dir="ltr" href="mailto:example@sandoq.ir">
                example@sandoq.ir
              </a>
            </Typography>
          </ContactCard>
        </div>
      </section>

      <section className="container flex flex-col gap-8 pb-20 lg:gap-10 lg:pb-28">
        <SectionTitle>ارسال پیام‌ها، درخواست‌ها و گزارش‌ها</SectionTitle>

        <MessageForm formId={messageFormId} />
      </section>

      <section className="bg-neutral-100 py-16 lg:py-24">
        <div className="container">
          <article className="grid gap-8 rounded-[32px] bg-white p-5 shadow-[0_8px_32px_rgb(23_23_23/0.08)] sm:p-8 lg:grid-cols-[1fr_1.05fr] lg:items-stretch lg:p-10">
            <div className="flex flex-col gap-7">
              <div className="flex items-start gap-4">
                <AddressIcon />
                <Typography className="pt-2" color="neutral-700" variant="24/bold">
                  آدرس و نشانی دفتر صندوق کارآفرینی
                </Typography>
              </div>

              <div className="flex flex-col gap-6 pr-0 sm:pr-20">
                <div className="flex flex-col gap-1">
                  <Typography color="neutral-700" variant="20/bold">
                    بوشهر - ایران
                  </Typography>
                  <Typography color="neutral-500" variant="16/regular">
                    بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو
                  </Typography>
                </div>
                <div className="flex flex-col gap-1">
                  <Typography color="neutral-700" variant="20/bold">
                    کد پستی
                  </Typography>
                  <Typography color="neutral-500" variant="16/regular">
                    ۱۲۳۴۵۶۷۸۹
                  </Typography>
                </div>
              </div>
            </div>

            <MapPlaceholder />
          </article>
        </div>
      </section>
    </main>
  )
}
