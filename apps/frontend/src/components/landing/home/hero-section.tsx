import HeroVisual from '@/components/landing/home/hero-visual'
import ShapeGrid from '@/components/landing/ShapeGrid'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

const HeroSection = () => {
  return (
    <section className="relative mx-auto w-full max-w-7xl overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
        <ShapeGrid
          speed={0.1}
          squareSize={50}
          borderColor="#F5F5F5"
          direction="up"
          shape="square"
        />
        <div className="absolute inset-y-0 left-0 w-[2%] bg-linear-to-r from-white to-white/15" />
        <div className="absolute inset-y-0 right-0 w-[2%] bg-linear-to-l from-white to-white/15" />
      </div>

      <div className="relative z-10 grid items-center gap-10 px-5 lg:ms-8 lg:grid-cols-[600px_640px] lg:px-0 lg:py-0">
        <HeroVisual />
        <div className="flex w-full flex-col items-end gap-8 text-right lg:order-1 lg:gap-20">
          <div className="flex w-full flex-col items-end gap-4">
            <Typography
              as="h1"
              variant="32/extrabold"
              lg="48/black"
              color="neutral-700"
              className="w-full"
            >
              مسیر رشد کسب‌وکارها،
              <br />
              از <span className="text-brand-500">فرصت</span> تا{' '}
              <span className="text-[#ECA204]">موفقیت</span>
            </Typography>
            <Typography variant="16/light" lg="20/regular" color="neutral-500" className="w-full">
              فرصت‌های سرمایه‌گذاری، همکاری و حضور در رویدادهای تخصصی را کشف کنید و مسیر رشد
              کسب‌وکارتان را هموارتر کنید.
            </Typography>
          </div>

          <div className="flex w-full justify-center gap-4 self-start pb-20 lg:justify-start lg:gap-2 lg:px-0 lg:pb-0">
            <Button variant="primary" size="36" lg="48" className="w-40 font-light! lg:w-45">
              ثبت‌نام شرکت
            </Button>
            <Button
              variant="outline-primary"
              size="36"
              lg="48"
              className="w-40 bg-transparent font-light! lg:w-45"
            >
              مشاهده فرصت‌ها
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
