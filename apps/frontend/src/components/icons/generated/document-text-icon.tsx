import type { SVGProps } from 'react'
/** Resume tab icon (linear, 24px). */
const DocumentTextIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d="M22 10v5c0 5-2 7-7 7H9c-5 0-7-2-7-7V9c0-5 2-7 7-7h5" />
      <path d="M22 10h-4c-3 0-4-1-4-4V2l8 8Z" />
      <path d="M7 13h6M7 17h4" />
    </g>
  </svg>
)
export default DocumentTextIcon
