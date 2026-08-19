import { SVGProps } from 'react'
const ArrowLeftIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 26 26"
    overflow="visible"
    preserveAspectRatio="none"
    style={{
      display: 'block',
    }}
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="m16.25 21.58-7.063-7.063a2.151 2.151 0 0 1 0-3.034L16.25 4.42"
    />
  </svg>
)
export default ArrowLeftIcon
