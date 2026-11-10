import Image from 'next/image'
import { CompanyBuildingIcon } from '@/components/icons'

/** The company's picture, or its building mark when none was uploaded. */
export function CompanyAvatar({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={40}
        height={40}
        // The file route is access-checked by the session cookie, which the image optimizer would not send.
        unoptimized
        className="size-10 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600"
    >
      <CompanyBuildingIcon className="size-5" aria-hidden="true" />
    </span>
  )
}
