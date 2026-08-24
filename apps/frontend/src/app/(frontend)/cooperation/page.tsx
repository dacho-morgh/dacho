import type { Metadata } from 'next'
import { MessageForm } from '@/components/landing/contact/message-form'
import { Typography } from '@/components/ui/typography'
import { createPageMetadata } from '@/utilities/siteMetadata'

export const metadata: Metadata = createPageMetadata({
  title: 'درخواست همکاری',
  description: 'ارسال درخواست همکاری با کارخانه نوآوری صنایع انرژی بوشهر.',
  path: '/cooperation',
})

export default function CooperationPage() {
  return (
    <main className="overflow-x-clip bg-white">
      <section className="container flex flex-col gap-10 pt-14 pb-24 sm:gap-12 md:pt-20 lg:pt-24 lg:pb-32">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-12 w-1.5 shrink-0 rounded-full bg-warning-400" />
          <Typography color="neutral-700" md="40/bold" variant="32/bold">
            ارسال درخواست همکاری
          </Typography>
        </div>

        <MessageForm className="min-h-132 lg:p-10" />
      </section>
    </main>
  )
}
