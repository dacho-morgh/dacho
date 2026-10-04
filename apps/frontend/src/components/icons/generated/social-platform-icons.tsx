import type { SVGProps } from 'react'

export function SocialInstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SocialTelegramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinejoin="round" d="m21 3-3.5 18-5.7-5.2-3.2 2.8.6-4.4L21 3 3 11.1l5.6 2.2" />
    </svg>
  )
}

export function SocialBaleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinejoin="round" d="M12 3a9 9 0 0 0-7.5 14l-1 4 4.2-1A9 9 0 1 0 12 3Z" />
      <path strokeLinecap="round" d="M8 12h8m-8 3h5" />
    </svg>
  )
}

export function SocialAparatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="2.5" y="3.5" width="19" height="17" rx="4" />
      <path strokeLinejoin="round" d="m10 8 6 4-6 4V8Z" />
    </svg>
  )
}
