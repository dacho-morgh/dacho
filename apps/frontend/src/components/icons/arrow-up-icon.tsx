import { SVGProps } from 'react'
const ArrowUpIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" {...props}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="M15.058 7.975 10 2.917 4.94 7.974M10 17.083V3.058"
    />
  </svg>
)
export default ArrowUpIcon
