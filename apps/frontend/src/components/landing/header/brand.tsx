const Brand = () => (
  <span className="flex h-8 w-[151px] flex-1 items-center gap-4 pr-2" dir="ltr">
    {/* eslint-disable @next/next/no-img-element */}
    <img
      alt="کارخانه نوآوری صنایع انرژی بوشهر"
      className="h-8 w-[90px] shrink-0"
      height={32}
      src="/logo/sandoq-logotype.svg"
      width={90}
    />
    <img
      alt=""
      aria-hidden="true"
      className="h-8 w-[37px] shrink-0"
      height={32}
      src="/logo/sandoq-logomark.svg"
      width={37}
    />
  </span>
)

export default Brand
