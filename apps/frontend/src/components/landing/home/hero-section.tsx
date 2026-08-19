import ShapeGrid from '@/components/landing/ShapeGrid'
import HeroVisual from '@/components/landing/home/hero-visual'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

const HeroSection = () => {
  return (
    <section className="relative mx-auto  w-full max-w-7xl overflow-hidden">
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

      <div className="relative lg:ms-8 z-10 grid items-center gap-10 px-5 lg:grid-cols-[600px_640px] lg:px-0 lg:py-0">
        <HeroVisual />
        <div className="flex w-full flex-col items-end lg:gap-20 gap-8 text-right lg:order-1">
          <div className="flex w-full flex-col items-end gap-4">
            <Typography variant="24/extrabold" lg='48/black' color="neutral-700" className="w-full">
              مسیر رشد کسب‌وکارها،
              <br className='hidden lg:block'/>
              از <span className="text-brand-500">فرصت</span> تا{' '}
              <span className="text-[#ECA204]">موفقیت</span>
            </Typography>
            <Typography variant="16/light" lg="20/regular" color="neutral-500" className="w-full">
              فرصت‌های سرمایه‌گذاری، همکاری و حضور در رویدادهای تخصصی را کشف کنید و مسیر رشد
              کسب‌وکارتان را هموارتر کنید.
            </Typography>
          </div>

          <div className="flex flex-wrap self-start justify-center w-full px-10 lg:pb-0 pb-20 gap-4 lg:gap-2 lg:px-0 lg:justify-start">
            <Button variant="primary" size="40" lg='48' className="lg:w-45 w-40 font-light!">
              ثبت‌نام شرکت
            </Button>
            <Button variant="outline-primary" size="40" lg='48' className="lg:w-45 w-40 bg-transparent font-light!">
              مشاهده فرصت‌ها
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
