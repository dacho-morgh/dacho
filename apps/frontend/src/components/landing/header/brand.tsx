import { BrandSandoqLogomark, BrandSandoqLogotype } from '@/components/icons'

const Brand = () => (
  <span className="flex h-8 w-[151px] flex-1 items-center gap-4 pr-2" dir="ltr">
    <BrandSandoqLogotype
      aria-label="کارخانه نوآوری صنایع انرژی بوشهر"
      className="h-8 w-[90px] shrink-0 text-neutral-800"
      role="img"
    />
    <BrandSandoqLogomark
      aria-hidden="true"
      className="h-8 w-[37px] shrink-0 text-neutral-800"
    />
  </span>
)

export default Brand
