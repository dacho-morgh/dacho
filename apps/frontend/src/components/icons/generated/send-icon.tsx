import * as React from 'react'
import type { SVGProps } from 'react'

const SvgSendIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    viewBox="0 0 20 20"
    fill="none"
    {...props}
  >
    <path
      d="M7.925 3.525L15.0583 7.09167C18.2583 8.69167 18.2583 11.3083 15.0583 12.9083L7.925 16.475C3.125 18.875 1.16667 16.9083 3.56667 12.1167L4.29167 10.675C4.475 10.3083 4.475 9.7 4.29167 9.33333L3.56667 7.88333C1.16667 3.09167 3.13333 1.125 7.925 3.525Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.53333 10H9.03333"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export default SvgSendIcon
