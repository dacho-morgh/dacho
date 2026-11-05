import * as React from 'react'
import type { SVGProps } from 'react'
/** Figma "arrow-up" (collapse chevron of a detail card, node 30950:10005). */
const SvgChevronUpIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="m19.92 15.05-6.52-6.52c-.77-.77-2.03-.77-2.8 0l-6.52 6.52"
    />
  </svg>
)
export default SvgChevronUpIcon
