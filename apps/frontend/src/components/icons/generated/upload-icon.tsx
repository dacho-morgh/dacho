import type { SVGProps } from 'react'
/** Upload action icon (linear, 24px). */
const UploadIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}>
      <path d="M12 16V4M12 4 8 8M12 4l4 4" />
      <path d="M4 14v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" />
    </g>
  </svg>
)
export default UploadIcon
