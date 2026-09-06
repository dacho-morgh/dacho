import { MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ContactAddressIcon, ContactMailIcon, ContactPhoneIcon } from '@/components/icons'
import { MessageForm } from '@/components/landing/contact/message-form'
import { Typography } from '@/components/ui/typography'
import { getFormIdByTitle } from '@/utilities/getFormId'
import { createPageMetadata } from '@/utilities/siteMetadata'

// Server-rendered per request: the form id comes from the database (seeded via
// `scripts/seed-forms.ts`), so the page must not be prerendered at build time.
export const revalidate = 60
const MESSAGE_FORM_TITLE = 'فرم تماس با ما'

export const metadata: Metadata = createPageMetadata({
  title: 'تماس با ما',
  description:
    'راه‌های ارتباط با کارخانه نوآوری صنایع انرژی بوشهر و فرم ارسال پیام، درخواست و گزارش.',
  path: '/connect',
})

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="h-12 w-1.5 shrink-0 rounded-full bg-warning-400" />
      <Typography color="neutral-700" lg="32/bold" variant="20/bold">
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
    <article className="flex min-h-52 flex-row items-start gap-5 rounded-4xl bg-white p-6 shadow-[0_8px_32px_rgb(23_23_23/0.06)] lg:p-8">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Typography color="neutral-700" variant="20/bold" lg="24/bold">
          {title}
        </Typography>
        <Typography color="neutral-500" variant="14/regular" lg="16/regular">
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
      <section className="container flex flex-col gap-12 pt-25 pb-20 sm:gap-16 lg:pt-28 lg:pb-28">
        <div className="flex flex-col gap-4">
          <SectionTitle>ارتباط پیوسته با ما</SectionTitle>
          <Typography
            className="max-w-6xl"
            color="neutral-500"
            lg="20/regular"
            variant="16/regular"
          >
            کارخانه نوآوری به شکل ۲۴ ساعته، پاسخگوی مخاطبان خود است. شما می‌توانید درخواست‌ها، گزارش‌ها
            و پیام‌هایتان را از طریق راه‌های ارتباطی درج شده در این صفحه، به دست ما برسانید.
          </Typography>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ContactCard
            description="پاسخگویی تلفنی به پرسش‌ها و مشکلات شما"
            icon={<ContactPhoneIcon className="size-14 shrink-0 text-warning-400 lg:size-20" />}
            title="تماس تلفنی"
          >
            <div className="flex flex-wrap gap-x-5 gap-y-2" dir="ltr">
              <Typography asChild color="neutral-800" lg="20/bold" variant="16/semibold">
                <a href="tel:+987712345678">۰۷۷ - ۱۲۳۴ ۵۶ ۷۸</a>
              </Typography>
              <Typography asChild color="neutral-800" lg="20/bold" variant="16/semibold">
                <a href="tel:+987712347898">۰۷۷ - ۱۲۳۴ ۷۸ ۹۸</a>
              </Typography>
            </div>
          </ContactCard>

          <ContactCard
            description="دریافت پیام‌های مکتوب شما از طریق ایمیل"
            icon={<ContactMailIcon className="size-16 shrink-0 text-warning-400 sm:size-20" />}
            title="ارسال پیام"
          >
            <div dir="ltr">
              <Typography
                className="self-center"
                asChild
                color="neutral-800"
                lg="20/bold"
                variant="16/semibold"
              >
                <a href="mailto:example@sandoq.ir">example@sandoq.ir</a>
              </Typography>
            </div>
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
                <ContactAddressIcon className="size-14 shrink-0 text-warning-400 sm:size-20" />
                <Typography className="pt-2" color="neutral-700" lg="24/bold" variant="20/bold">
                  آدرس و نشانی دفتر صندوق کارآفرینی
                </Typography>
              </div>

              <div className="flex flex-col gap-6 pr-0 sm:pr-20">
                <div className="flex flex-col gap-1">
                  <Typography color="neutral-700" lg="20/bold" variant="16/semibold">
                    بوشهر - ایران
                  </Typography>
                  <Typography color="neutral-500" lg="16/regular" variant="14/regular">
                    بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو
                  </Typography>
                </div>
                <div className="flex flex-col gap-1">
                  <Typography color="neutral-700" lg="20/bold" variant="16/semibold">
                    کد پستی
                  </Typography>
                  <Typography color="neutral-500" lg="16/regular" variant="14/regular">
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
