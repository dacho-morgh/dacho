import { Button } from '@/components/ui/button'
import ShapeGrid from '@/components/landing/ShapeGrid'

const HeroSection = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-10 pb-15">
      <div className="pointer-events-none absolute inset-0 z-0 h-full w-full">
        <ShapeGrid
          speed={0.1}
          squareSize={50}
          borderColor="#F5F5F5"
          direction="up"
          shape="square"
        />
        <div className="fromleft absolute top-0 left-0 h-full w-[2%] bg-linear-to-r from-white to-white/15" />
        <div className="fromleft absolute top-0 right-0 h-full w-[2%] bg-linear-to-l from-white to-white/15" />
        <div />
      </div>
      <div className="relative z-10 flex flex-col gap-9 px-20 py-30">
        <div className="flex flex-col gap-4">
          <h1 className="text-center text-[40px] leading-16 font-bold text-[#262626]">
            پل ارتباطی میان صنایع بزرگ و کسب‌وکارهای نوآور
          </h1>
          <p className="text-xl text-[#262626]">
            شرکت‌های صنعتی نیازهای فناورانه خود را ثبت می‌کنند و شرکت‌های متخصص برای اجرای پروژه‌ها
            درخواست همکاری ارسال می‌کنند.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button className="flex h-10 w-40 items-center justify-center rounded-[10px] bg-[#3B82F6] p-0 text-white">
            ثبت‌نام شرکت
          </Button>
          <Button
            variant="outline"
            className="flex h-10 w-40 items-center justify-center rounded-[10px] border-[#3B82F6] bg-transparent p-0 text-[#3B82F6]"
          >
            مشاهده فرصت‌ها
          </Button>
        </div>
      </div>
    </div>
  )
}

export default HeroSection
