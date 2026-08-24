import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Image from 'next/image'
import React from 'react'
import { Typography } from '@/components/ui/typography'
import '../(frontend)/globals.css'

const yekanBakh = localFont({
  src: '../../../public/fonts/YekanBakhFaNum-VF.ttf',
  variable: '--font-yekan-bakh',
})

export const metadata: Metadata = {
  title: 'ورود | صندوق نوآوری بوشهر',
  description: 'ورود به سامانه صندوق پژوهش و فناوری استان بوشهر',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={yekanBakh.variable} data-theme="light" dir="rtl" lang="fa">
      <body>
        <main className="flex min-h-svh w-full overflow-x-hidden bg-background lg:overflow-hidden">
          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <aside
              className="relative m-[40px_40px_40px_0] w-full min-w-0 overflow-hidden rounded-[40px]"
              aria-label="معرفی فضای نوآوری"
            >
              <Image
                alt="فضای خلاق یادگیری و کارآفرینی"
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1024px) 47vw, 0px"
                src="/figma/login/login-hero.png"
              />

              <div className="absolute inset-x-10 bottom-10 flex min-h-50 flex-col justify-between gap-5 rounded-[20px] border border-white/25 bg-white/10 p-5 text-white shadow-[0_0_40px_rgb(21_21_21/10%)] backdrop-blur-[20px]">
                <div>
                  <Typography as="h2" color="white" variant="24/bold">
                    فراهم کردن بستری برای کارآفرینی
                  </Typography>
                  <Typography className="mt-2.5 max-w-135" color="white" variant="16/regular">
                    کارآفرینی گرما‌بخش ابداع پایدار زیرساخت سبز تیم افزوده. کتاب‌های ظرفیت تعامل خلق
                    تکثر پیشرو ذهن بیمارستان امید!
                  </Typography>
                </div>

                <div className="flex gap-[18px] [direction:ltr]" aria-label="اسلاید یک از چند">
                  <ArrowLeft aria-hidden="true" className="size-5 stroke-[1.5]" />
                  <ArrowRight aria-hidden="true" className="size-5 stroke-[1.5]" />
                </div>
              </div>
            </aside>
          </div>

          <section className="min-h-svh min-w-0 flex-1" aria-label="احراز هویت">
            {children}
          </section>
        </main>
      </body>
    </html>
  )
}
