import type { ReactNode } from 'react'
import { TickCircleIcon } from '@/components/icons'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import ServicesScrollStack from '../about/services-scroll-stack'
import RecruitmentSection from './recruitment-section'

type DetailCardProps = {
  title: string
  children: ReactNode
  bullets?: string[]
  index: number
  className?: string
}

const DetailCard = ({ title, className, children, bullets = [], index }: DetailCardProps) => (
  <article
    data-service-card
    className={cn(
      'relative flex w-full max-w-200 flex-col items-end gap-4 rounded-[40px] bg-white p-6 text-right shadow-[0_0_20px_rgb(10_10_10/0.05)] sm:p-10',
      className,
    )}
    style={{ zIndex: index + 1 }}
  >
    <Typography as="h3" variant="24/extrabold" color="neutral-700" className="w-full">
      {title}
    </Typography>
    <Typography variant="16/regular" color="neutral-500" className="w-full">
      {children}
    </Typography>
    {bullets.map((bullet) => (
      <div key={bullet} className="flex w-full items-center justify-end gap-2">
        <TickCircleIcon aria-hidden="true" className="size-7 shrink-0 text-secondary-500" />
        <Typography
          variant="14/semibold"
          lg="16/semibold"
          color="neutral-700"
          className="min-w-0 flex-1"
        >
          {bullet}
        </Typography>
      </div>
    ))}
  </article>
)

const ServicesDetailSection = () => (
  <section className="flex w-full flex-col gap-10 px-4 py-24 sm:px-6 sm:py-32 lg:h-590 lg:px-20 lg:py-60">
    <RecruitmentSection variant="blue" />

    <ServicesScrollStack
      equalCardHeights
      heading={
        <Typography as="h2" variant="24/extrabold" lg="40/extrabold" color="neutral-600">
          ما چه خدماتی ارائه می‌دهیم؟
        </Typography>
      }
      headingClassName="justify-center bg-white!"
    >
      <DetailCard index={0} title="برگزاری رویدادهای تخصصی و شبکه‌سازی صنعتی">
        کارخانه نوآوری نفت، گاز و پتروشیمی با استقرار در مجاورت قطب نفت خیز ایران، بستری بی‌بدیل برای
        هم‌افزایی میان صنایع کلان و زیست‌بوم فناوری کشور فراهم آورده است. ما با عبور از رویکردهای
        نمایشی رایج، تمرکز خود را بر برگزاری رویدادهای تقاضامحور (ریورس پیچ) و نشست‌های تخصصی همرسانی
        (B2B) معطوف ساخته‌ایم. حضور فیزیکی در قطب انرژی کشور، این امکان را به شرکت‌های دانش‌بنیان می‌دهد
        تا بدون واسطه با تصمیم‌گیران، مدیران ارشد و کارشناسان فنی پالایشگاه‌ها و مجتمع‌های پتروشیمی به
        مذاکره پرداخته و راهکارهای فناورانه خود را برای رفع نیازهای گلوگاهی صنعت ارائه نمایند.
      </DetailCard>

      <DetailCard
        index={1}
        title="تأمین مالی، سرمایه‌گذاری و هدایت اعتبارات"
        bullets={[
          'هدایت هدفمند اعتبار مالیاتی به سمت پروژه‌های فناورانه',
          'تسهیل ایجاد و راهبری نهادهای سرمایه‌گذاری خطرپذیر شرکتی (CVC) در صنعت نفت و گاز',
          'طراحی مدل‌های تأمین مالی و سرمایه‌گذاری',
        ]}
      >
        توسعه فناوری در صنایع زیربنایی، نیازمند معماری دقیق ساختارهای مالی است. در این راستا و با
        عاملیت «صندوق پژوهش و فناوری غیردولتی استان بوشهر»، شبکه‌ای منسجم برای تأمین مالی طرح‌های
        نوآورانه و صدور ضمانت‌نامه‌های تخصصی پایه‌گذاری شده است. کارخانه نوآوری با تسلط بر ظرفیت‌های
        مترقی قانون جهش تولید دانش‌بنیان، خدمات زیر را در حوزه سرمایه‌گذاری ارائه می‌نماید:
      </DetailCard>

      <DetailCard index={2} title="تجاری‌سازی و توسعه بازار فناوری">
        گذار موفقیت‌آمیز از مقیاس آزمایشگاهی به تولید صنعتی و نفوذ در زنجیره تأمین صنایع بزرگ، مستلزم
        طی کردن مسیری پیچیده و احراز استانداردهای سخت‌گیرانه است. کارخانه نوآوری با تمرکز ویژه بر
        حمایت و راهبری پروژه‌های تولید بار اول، فرآیند تطبیق محصولات نوآورانه با نیازهای عملیاتی صنعت
        را تسریع می‌بخشد. مزیت بنیادین این مجموعه، شناخت عمیق از الزامات ورود به فهرست تأمین‌کنندگان
        مجاز (وندورلیست‌ها) و فراهم آوردن امکان استقرار و آزمون‌های میدانی (پایلوت) در محیط واقعی
        پالایشگاهی است که اعتباربخشی فنی به محصولات دانش‌بنیان را برای ورود به بازار کلان انرژی تضمین
        می‌نماید.
      </DetailCard>

      <DetailCard
        index={3}
        title="خدمات حمایتی و توسعه زیست‌بوم دانش‌بنیان"
        bullets={[
          'ارائه مشاوره‌های تخصصی جهت اخذ و ارتقای پایه دانش‌بنیانی و بهره‌مندی از معافیت‌های قانونی',
          'ایجاد زیرساخت‌های استقرار، فضای کار اشتراکی و منتورینگ تخصصی',
        ]}
      >
        ارتقای تاب‌آوری و توسعه پایدار شرکت‌های فناور، نیازمند بهره‌مندی حداکثری از حمایت‌های نهادی است.
        کارخانه نوآوری در قامت یکی از ارکان کلیدی زیست بوم نوآوری، خدمات جامع مشاوره‌ای و تسهیلگری را
        به منظور رفع موانع و هموارسازی مسیر رشد شرکت‌ها ارائه می‌دهد که اهم آن‌ها عبارتند از:
      </DetailCard>
    </ServicesScrollStack>
  </section>
)

export default ServicesDetailSection
