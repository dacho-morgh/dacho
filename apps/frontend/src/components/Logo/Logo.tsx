import clsx from 'clsx'
import { PayloadLogoLight } from '@/components/icons'

interface Props {
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = ({ className }: Props) => (
  <PayloadLogoLight
    aria-label="Payload Logo"
    className={clsx('h-[34px] w-full max-w-[9.375rem] text-white', className)}
    role="img"
  />
)
