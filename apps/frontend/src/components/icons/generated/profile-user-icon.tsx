import type { SVGProps } from 'react'
const ProfileUserIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10" />
      <path d="M20.59 22c0-3.87-3.85-7-8.59-7s-8.59 3.13-8.59 7" />
    </g>
  </svg>
)
export default ProfileUserIcon
