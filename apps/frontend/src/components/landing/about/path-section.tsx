import Image from 'next/image'
import { Typography } from '@/components/ui/typography'

const PATH_ITEMS = [
  {
    title: 'فضای استقرار تخصصی',
    description: 'محیطی خلاق برای هم‌افزایی تیم‌های فناور',
  },
  {
    title: 'عارضه‌یابی، مشاوره و منتورینگ',
    description:
      'تحلیل چالش‌های فنی و کسب‌وکاری با همراهی منتورهای خبره، از طراحی مفهومی تا نمونه‌سازی و آزمون‌های عملیاتی',
  },
  {
    title: 'خدمات مالی',
    description: 'تسهیل دسترسی به منابع مالی از طریق ظرفیت‌های داخلی کارخانه و نهادهای همکار.',
  },
  {
    title: 'خدمات تجاری‌سازی و ورود به بازار',
    description: 'هموارسازی مسیر عرضه فناوری به صنایع بزرگ و تسهیل فرآیند انعقاد قراردادهای تجاری.',
  },
  {
    title: 'خدمات دانش بنیان',
    description: 'پشتیبانی تخصصی برای اخذ مجوزها و بهره‌مندی از مشوق‌های قانونی',
  },
]

export default function PathSection() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-8 lg:py-24 2xl:px-0">
      <div className="mb-8 flex flex-col items-start gap-2 lg:mb-10">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="hidden h-12 w-2 shrink-0 rounded-lg bg-secondary-500 lg:block"
          />
          <Typography as="h2" color="neutral-600" lg="40/extrabold" variant="34/extrabold">
            اهدافی که ما دنبال میکنیم
          </Typography>
        </div>
        <Typography as="p" color="neutral-500" lg="20/regular" variant="16/regular">
          ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.
        </Typography>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-3xl bg-neutral-900 lg:aspect-auto lg:h-[600px] lg:w-[46%] lg:rounded-[40px]">
          <Image
            fill
            alt=""
            className="object-cover"
            sizes="(min-width: 1024px) 46vw, (min-width: 768px) calc(100vw - 64px), calc(100vw - 32px)"
            src="/figma/about/idea-to-market.png"
          />
        </div>

        <div className="min-w-0 flex-1">
          {PATH_ITEMS.map((item) => (
            <article
              className="border-b border-neutral-200 py-4 first:pt-0 lg:py-5"
              key={item.title}
            >
              <Typography as="h3" color="neutral-700" lg="24/extrabold" variant="20/extrabold">
                {item.title}
              </Typography>
              <Typography as="p" className="mt-2" color="neutral-500" lg="16/regular" variant="14/regular">
                {item.description}
              </Typography>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
