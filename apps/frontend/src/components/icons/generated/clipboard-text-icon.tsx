import type { SVGProps } from 'react'
/** Requests tab icon (linear, 24px). */
const ClipboardTextIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d="M16 4h2c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h2" />
      <rect width={8} height={4} x={8} y={2} rx={1.5} />
      <path d="M8 12h8M8 16h5" />
    </g>
  </svg>
)
export default ClipboardTextIcon
