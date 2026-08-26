import type { SVGProps } from 'react'

export function TickCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M14 25.667c6.443 0 11.667-5.224 11.667-11.667S20.443 2.333 14 2.333 2.333 7.557 2.333 14 7.557 25.667 14 25.667Z"
        fill="currentColor"
        opacity=".4"
      />
      <path
        d="M12.343 18.177a.873.873 0 0 1-.618-.257l-3.302-3.302a.879.879 0 0 1 0-1.236.879.879 0 0 1 1.237 0l2.683 2.683 5.997-5.997a.879.879 0 0 1 1.237 0 .879.879 0 0 1 0 1.237l-6.615 6.615a.873.873 0 0 1-.619.257Z"
        fill="currentColor"
      />
    </svg>
  )
}
