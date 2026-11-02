import { SVGProps } from 'react'
const SidebarCollapseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2" />
      <path d="M7.25 10 5.5 12l1.75 2m2.25 7V3" />
    </g>
  </svg>
)
export default SidebarCollapseIcon
