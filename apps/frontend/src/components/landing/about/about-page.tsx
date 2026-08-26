import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { TickCircleIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import ServicesScrollStack from './services-scroll-stack'

const VISION_ITEMS = [
  'شناسایی نیازهای بازار',
  'بومی‌سازی دانش فنی',
  'کاهش وابستگی صنعتی',
  'ارتقای بهره‌وری',
]

type Service = {
  title: string
  description: string
  bullets?: string[]
}

const SERVICES: Service[] = [
  {
    title: 'برگزاری رویدادهای تخصصی و شبکه‌سازی صنعتی',
    description:
      'کارخانه نوآوری نفت، گاز و پتروشیمی با استقرار در مجاورت قطب نفت خیز ایران، بستری بی‌بدیل برای هم‌افزایی میان صنایع کلان و زیست‌بوم فناوری کشور فراهم آورده است. ما با عبور از رویکردهای نمایشی رایج، تمرکز خود را بر برگزاری رویدادهای تقاضامحور (ریورس پیچ) و نشست‌های تخصصی همرسانی (B2B) معطوف ساخته‌ایم. حضور فیزیکی در قطب انرژی کشور، این امکان را به شرکت‌های دانش‌بنیان می‌دهد تا بدون واسطه با تصمیم‌گیران، مدیران ارشد و کارشناسان فنی پالایشگاه‌ها و مجتمع‌های پتروشیمی به مذاکره پرداخته و راهکارهای فناورانه خود را برای رفع نیازهای گلوگاهی صنعت ارائه نمایند.',
  },
  {
    title: 'تأمین مالی، سرمایه‌گذاری و هدایت اعتبارات',
    description:
      'توسعه فناوری در صنایع زیربنایی، نیازمند معماری دقیق ساختارهای مالی است. در این راستا و با عاملیت «صندوق پژوهش و فناوری غیردولتی استان بوشهر»، شبکه‌ای منسجم برای تأمین مالی طرح‌های نوآورانه و صدور ضمانت‌نامه‌های تخصصی پایه‌گذاری شده است. کارخانه نوآوری با تسلط بر ظرفیت‌های مترقی قانون جهش تولید دانش‌بنیان، خدمات زیر را در حوزه سرمایه‌گذاری ارائه می‌نماید:',
    bullets: [
      'هدایت هدفمند اعتبار مالیاتی به سمت پروژه‌های فناورانه',
      'تسهیل ایجاد و راهبری نهادهای سرمایه‌گذاری خطرپذیر شرکتی (CVC) در صنعت نفت و گاز',
      'طراحی مدل‌های تأمین مالی و سرمایه‌گذاری',
    ],
  },
  {
    title: 'تجاری‌سازی و توسعه بازار فناوری',
    description:
      'گذار موفقیت‌آمیز از مقیاس آزمایشگاهی به تولید صنعتی و نفوذ در زنجیره تأمین صنایع بزرگ، مستلزم طی کردن مسیری پیچیده و احراز استانداردهای سخت‌گیرانه است. کارخانه نوآوری با تمرکز ویژه بر حمایت و راهبری پروژه‌های تولید بار اول، فرآیند تطبیق محصولات نوآورانه با نیازهای عملیاتی صنعت را تسریع می‌بخشد. مزیت بنیادین این مجموعه، شناخت عمیق از الزامات ورود به فهرست تأمین‌کنندگان مجاز (وندورلیست‌ها) و فراهم آوردن امکان استقرار و آزمون‌های میدانی (پایلوت) در محیط واقعی پالایشگاهی است که اعتباربخشی فنی به محصولات دانش‌بنیان را برای ورود به بازار کلان انرژی تضمین می‌نماید.',
  },
  {
    title: 'خدمات حمایتی و توسعه زیست‌بوم دانش‌بنیان',
    description:
      'ارتقای تاب‌آوری و توسعه پایدار شرکت‌های فناور، نیازمند بهره‌مندی حداکثری از حمایت‌های نهادی است. کارخانه نوآوری در قامت یکی از ارکان کلیدی زیست بوم نوآوری، خدمات جامع مشاوره‌ای و تسهیلگری را به منظور رفع موانع و هموارسازی مسیر رشد شرکت‌ها ارائه می‌دهد که اهم آن‌ها عبارتند از:',
    bullets: [
      'ارائه مشاوره‌های تخصصی جهت اخذ و ارتقای پایه دانش‌بنیانی و بهره‌مندی از معافیت‌های قانونی',
      'ایجاد زیرساخت‌های استقرار، فضای کار اشتراکی و منتورینگ تخصصی',
    ],
  },
]

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span aria-hidden="true" className="h-12 w-2 shrink-0 rounded-lg bg-secondary-500" />
      <Typography as="h2" color="neutral-600" md="40/extrabold" variant="32/extrabold">
        {children}
      </Typography>
    </div>
  )
}

function TickItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <TickCircleIcon aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-secondary-500" />
      <Typography as="span" color="neutral-700" variant="16/semibold">
        {children}
      </Typography>
    </li>
  )
}

function IntroductionSection() {
  return (
    <section className="mx-auto flex min-h-[800px] w-full max-w-[1280px] flex-col justify-center gap-10 px-4 py-16 md:px-8 lg:flex-row lg:items-center lg:py-20 2xl:px-0">
      <div className="flex flex-1 flex-col gap-8 lg:max-w-[600px]">
        <div className="flex flex-col gap-4">
          <Typography as="h1" color="neutral-700" md="48/black" variant="32/extrabold">
            پیوند هوشمندانه صنعت و فناوری در قلب انرژی کشور
          </Typography>
          <Typography as="p" color="neutral-500" variant="20/regular">
            کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر، با هدف راه‌اندازی نخستین هاب تخصصی نوآوری در
            حوزه انرژی‌های فسیلی و تجدیدپذیر در منطقه راهبردی عسلویه شکل گرفته است.
          </Typography>
        </div>
        <div className="flex items-stretch gap-4">
          <span aria-hidden="true" className="w-2 shrink-0 rounded-lg bg-secondary-500" />
          <Typography as="p" color="neutral-600" variant="20/bold">
            رسالت ما، تبدیل چالش‌های واقعی صنعت به راهکارهای فناورانه و اقتصادی است
          </Typography>
        </div>
      </div>
      <div className="relative aspect-square w-full overflow-hidden rounded-[40px] lg:w-1/2 lg:max-w-[640px]">
        <Image
          fill
          priority
          alt="نمونه‌ای از هویت بصری و فعالیت‌های کارخانه نوآوری"
          className="object-cover"
          sizes="(min-width: 1024px) 50vw, 100vw"
          src="/figma/about/about-hero.png"
        />
      </div>
    </section>
  )
}

function VisionSection() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 py-20 md:px-8 lg:py-40 2xl:px-0">
      <article className="flex flex-col gap-10 rounded-[40px] bg-white p-5 shadow-[0_0_20px_rgb(10_10_10/0.1)] sm:p-8 lg:flex-row lg:items-stretch lg:rounded-[80px] lg:p-10">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-4 lg:py-10">
          <Typography as="h3" color="neutral-800" variant="24/bold">
            چشم‌انداز و اهداف کلیدی
          </Typography>
          <Typography as="p" color="neutral-500" variant="16/regular">
            با تکیه بر این اهداف، در مسیرِ توسعه خدمات تکمیلی (توسعه آزمایشگاه‌های پیشرفته و گسترش
            شبکه‌های بین‌المللی) گام برمی‌داریم:
          </Typography>
          <ul className="flex flex-col gap-4">
            {VISION_ITEMS.map((item) => (
              <TickItem key={item}>{item}</TickItem>
            ))}
          </ul>
          <Typography as="p" color="neutral-500" variant="16/regular">
            ما در کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر، نه‌تنها پاسخی جامع به نیازهای فناورانه
            صنعت انرژی کشور هستیم، بلکه به‌عنوان یک الگوی ملی برای توسعه منطقه‌ای شناخته می‌شویم.
            چشم‌انداز ما، ایفای نقشی محوری در زنجیره تأمین فناوری انرژی غرب آسیا تا سال ۱۴۱۰ است؛
            جایی که هم‌افزایی دانش و صنعت، آینده‌ای پیشرو را برای ایران رقم می‌زند.
          </Typography>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[32px] lg:aspect-auto lg:w-1/2 lg:max-w-[640px] lg:rounded-[40px]">
          <Image
            fill
            alt="نمادی از چشم‌انداز و هویت حرفه‌ای کارخانه نوآوری"
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
            src="/figma/about/vision.png"
          />
        </div>
      </article>
    </section>
  )
}

function ServiceCard({ service, index }: { service: Service; index: number }) {
  return (
    <article
      data-service-card
      className={cn(
        'relative flex flex-col gap-4 rounded-[32px] bg-white p-6 shadow-[0_0_10px_rgb(10_10_10/0.05)] sm:p-10 lg:w-[800px] lg:rounded-[40px]',
      )}
      style={{ zIndex: index + 1 }}
    >
      <Typography as="h3" color="neutral-700" variant="24/extrabold">
        {service.title}
      </Typography>
      <Typography as="p" color="neutral-500" variant="16/regular">
        {service.description}
      </Typography>
      {service.bullets ? (
        <ul className="flex flex-col gap-4">
          {service.bullets.map((bullet) => (
            <TickItem key={bullet}>{bullet}</TickItem>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

function ServicesSection() {
  return (
    <section className="bg-neutral-50 py-20 lg:py-40" id="services">
      <div className="mx-auto w-full max-w-[1280px] px-4 md:px-8 2xl:px-0">
        <ServicesScrollStack heading={<SectionHeading>ما چه خدماتی ارائه می‌دهیم؟</SectionHeading>}>
          {SERVICES.map((service, index) => (
            <ServiceCard index={index} key={service.title} service={service} />
          ))}
        </ServicesScrollStack>
      </div>
    </section>
  )
}

function AboutCallToAction() {
  return (
    <section className="px-4 py-20 md:px-8 lg:py-0 lg:pb-40 2xl:px-0">
      <div className="relative isolate mx-auto max-w-[1120px] overflow-hidden rounded-[32px] bg-linear-to-r from-about-cta-start to-about-cta-end p-6 sm:p-10 lg:min-h-64 lg:rounded-[40px] lg:px-20 lg:py-[72px]">
        <Image
          aria-hidden="true"
          alt=""
          className="pointer-events-none absolute -top-[338px] -left-[168px] -z-10 h-[616px] w-[635px] max-w-none opacity-80"
          height={616}
          src="/figma/about/cta-dots.svg"
          width={635}
        />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
          <Typography as="p" className="max-w-[702px]" color="white" md="32/bold" variant="24/bold">
            کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر؛ جایی که نیاز صنعت، به راهکار فناورانه تبدیل
            می‌شود.
          </Typography>
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row lg:w-[200px] lg:flex-col">
            <Button asChild className="w-full" size="48" variant="white">
              <Link href="#services">
                <Typography as="span" color="neutral-700" variant="20/regular">
                  آشنایی با خدمات
                </Typography>
              </Link>
            </Button>
            <Button asChild className="w-full" size="48" variant="outline-white">
              <Link href="/connect">
                <Typography as="span" color="white" variant="20/regular">
                  ارتباط با ما
                </Typography>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export { AboutCallToAction, IntroductionSection, ServicesSection, VisionSection }
