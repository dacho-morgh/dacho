import type { SVGProps } from 'react'
/** Company profile tab icon (linear, 24px, matches the dashboard sidebar set). */
const CompanyBuildingIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d="M2 22h20" />
      <path d="M3.5 22V6.5c0-1.5.8-2.3 2.3-2.3h5.4c1.5 0 2.3.8 2.3 2.3V22" />
      <path d="M20.5 22v-9c0-1.5-.8-2.3-2.3-2.3H13.5" />
      <path d="M7 8.5h4M7 12h4M7 15.5h4" />
    </g>
  </svg>
)
export default CompanyBuildingIcon
