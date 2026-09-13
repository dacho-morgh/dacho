import { BrandSandoqLogomark, BrandSandoqLogotype } from '@/components/icons'

const Brand = () => (
  <span className="flex h-8 w-37.75 flex-1 items-center gap-2 pr-2">
    <BrandSandoqLogomark aria-hidden="true" className="h-8 w-9.25 shrink-0 text-neutral-800" />
    <BrandSandoqLogotype
      aria-label="کارخانه نوآوری صنایع انرژی بوشهر"
      className="h-8 w-22.5 shrink-0 text-neutral-800"
      role="img"
    />
  </span>
)

export default Brand
