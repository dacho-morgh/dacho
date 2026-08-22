import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export default function NotFound() {
  return (
    <main className="flex min-h-[48rem] flex-col items-center justify-center gap-10 px-4 py-20 text-center">
      <Image
        src="/figma/404page/file.svg"
        alt=""
        aria-hidden="true"
        width={300}
        height={280}
        className="h-auto w-60 sm:w-75"
      />
      <div className="flex max-w-3xl flex-col gap-4">
        <Typography as="h1" variant="24/bold" color="neutral-700">
          صفحه موردنظر پیدا نشد
        </Typography>
        <Typography variant="16/regular" sm="20/regular" color="neutral-500">
          به نظر می‌رسد صفحه‌ای که به دنبال آن هستید وجود ندارد، حذف شده یا آدرس آن تغییر کرده است.
        </Typography>
      </div>
      <Button asChild variant="ghost" size="48">
        <Link href="/">بازگشت به صفحه اصلی</Link>
      </Button>
    </main>
  )
}
