import type { Metadata } from 'next'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { ContactAddressIcon, ContactMailIcon, ContactPhoneIcon } from '@/components/icons'
import { MessageForm } from '@/components/landing/contact/message-form'
import { Typography } from '@/components/ui/typography'
import { getFormIdByTitle } from '@/utilities/getFormId'
import { createPageMetadata } from '@/utilities/siteMetadata'

const MESSAGE_FORM_TITLE = 'فرم تماس با ما'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createPageMetadata({
  title: 'تماس با ما',
  description:
    'راه‌های ارتباط با کارخانه نوآوری صنایع انرژی بوشهر و فرم ارسال پیام، درخواست و گزارش.',
  path: '/connect',
})

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="h-12 w-2 shrink-0 rounded-lg bg-warning-400" />
      <Typography color="neutral-600" lg="32/extrabold" variant="24/extrabold">
        {children}
      </Typography>
    </div>
  )
}

function ContactRow({
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
    <article className="flex flex-col gap-5 rounded-[40px] bg-white px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:py-8">
      <div className="flex items-center gap-4">
        {icon}
        <div className="flex flex-col gap-2 text-right">
          <Typography color="neutral-600" lg="24/bold" variant="20/bold">
            {title}
          </Typography>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            {description}
          </Typography>
        </div>
      </div>
      <div className="min-w-0 sm:pr-4">{children}</div>
    </article>
  )
}

export default async function ConnectPage() {
  const messageFormId = await getFormIdByTitle(MESSAGE_FORM_TITLE)

  return (
    <main className="overflow-x-clip bg-white">
      <section className="container flex flex-col gap-10 pt-[150px] pb-20">
        <div className="flex flex-col gap-2">
          <SectionTitle>ارتباط پیوسته با ما</SectionTitle>
          <Typography color="neutral-500" lg="20/regular" variant="16/regular">
            کارخانه نوآوری به‌شکل ۲۴ ساعته، پاسخگوی مخاطبان خود است. شما می‌توانید درخواست‌ها، گزارش‌ها
            و پیام‌هایتان را از طریق راه‌های ارتباطی درج شده در این صفحه، به دست ما برسانید.
          </Typography>
        </div>

        <div className="flex flex-col gap-5">
          <ContactRow
            description="دریافت پیام‌های مکتوب شما از طریق ایمیل"
            icon={<ContactMailIcon className="size-16 shrink-0 text-brand-500 lg:size-20" />}
            title="ارسال پیام"
          >
            <Typography asChild color="brand-600" lg="24/bold" variant="20/bold">
              <a className="break-all" dir="ltr" href="mailto:example@sandoq.ir">
                example@sandoq.ir
              </a>
            </Typography>
          </ContactRow>

          <ContactRow
            description="پاسخ‌گویی تلفنی به پرسش‌ها و مشکلات شما"
            icon={<ContactPhoneIcon className="size-16 shrink-0 text-brand-500 lg:size-20" />}
            title="تماس تلفنی"
          >
            <div className="flex flex-wrap gap-x-6 gap-y-2" dir="ltr">
              <Typography asChild color="brand-600" lg="24/bold" variant="20/bold">
                <a href="tel:+987723456789">077 - 2345 67 89</a>
              </Typography>
              <Typography asChild color="brand-600" lg="24/bold" variant="20/bold">
                <a href="tel:+987723456789">077 - 2345 67 89</a>
              </Typography>
            </div>
          </ContactRow>
        </div>
      </section>

      <section className="container flex flex-col gap-10 py-20 lg:py-[120px]">
        <SectionTitle>ارسال پیام‌ها، درخواست‌ها و گزارش‌ها</SectionTitle>
        <MessageForm formId={messageFormId} />
      </section>

      <section className="bg-neutral-100 py-20 lg:py-[120px]">
        <div className="container">
          <article className="grid gap-10 rounded-[40px] bg-white p-5 shadow-[0_0_20px_rgb(10_10_10/0.1)] sm:p-10 lg:grid-cols-2 lg:items-start">
            <div className="flex flex-col gap-10">
              <div className="flex items-center gap-4">
                <ContactAddressIcon className="size-16 shrink-0 text-warning-400 lg:size-20" />
                <Typography color="neutral-600" lg="24/bold" variant="20/bold">
                  آدرس و نشانی دفتر صندوق کارآفرینی
                </Typography>
              </div>

              <div className="flex flex-col gap-4">
                <Typography color="neutral-600" lg="20/bold" variant="16/semibold">
                  بوشهر - ایران
                </Typography>
                <Typography color="neutral-500" lg="20/regular" variant="16/regular">
                  بوشهر، بهمنی، خیابان ماهینی، سه راه دانشجو
                </Typography>
              </div>
              <div className="flex flex-col gap-4">
                <Typography color="neutral-600" lg="20/bold" variant="16/semibold">
                  کد پستی
                </Typography>
                <Typography color="neutral-500" lg="20/regular" variant="16/regular">
                  ۱۲۳۴۵۶۷۸۹
                </Typography>
              </div>
            </div>

            <div className="relative min-h-64 overflow-hidden rounded-[20px] lg:h-80">
              <Image
                alt="نقشه موقعیت دفتر صندوق کارآفرینی در بوشهر"
                className="object-cover"
                fill
                sizes="(min-width: 1024px) 600px, 100vw"
                src="/figma/connect/map.png"
              />
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
