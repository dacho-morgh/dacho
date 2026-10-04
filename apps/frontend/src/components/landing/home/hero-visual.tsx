import type { ReactNode } from 'react'

const HeroVisual = ({ children }: { children?: ReactNode }) => (
  <div className="relative mx-auto flex h-[clamp(320px,47vw,600px)] w-full max-w-160 flex-1 items-center justify-center overflow-hidden rounded-[48px] lg:order-2 lg:h-[clamp(420px,47vw,600px)] lg:max-w-200 lg:rounded-[80px]">
    {children}
  </div>
)

export default HeroVisual
