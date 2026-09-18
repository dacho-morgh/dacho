import * as React from 'react'
import type { SVGProps } from 'react'

const SvgDashboardMessageTextIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    {...props}
  >
    <path
      d="M17 9.5V7A2 2 0 0 0 15 5H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2v3.5L10.5 15H15a2 2 0 0 0 2-2v-1"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 10.5v2"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </svg>
)

export default SvgDashboardMessageTextIcon
