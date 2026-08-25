import * as React from 'react'
import type { SVGProps } from 'react'
const SvgFavicon = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={1000} height={1000} {...props}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      width={1000}
      height={1000}
      style={{
        display: 'inline',
      }}
      {...props}
    >
      <g clipPath="url(#favicon_svg__a)">
        <path d="M0 0h1000v1000H0z" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          width={123}
          height={140}
          transform="matrix(5 0 0 5 192.5 150)"
          {...props}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={123}
            height={140}
            fill="none"
            viewBox="0 0 123 140"
            {...props}
          >
            <path
              fill="currentColor"
              d="M60.257 118.758 18.904 94.992a1.68 1.68 0 0 1-.837-1.434V56.825c0-.633.703-1.033 1.238-.733l48.011 27.6c.67.4 1.506-.1 1.506-.867v-17.9c0-.7-.368-1.367-1.004-1.733l-57.747-33.2c-.502-.3-1.171-.3-1.673 0L.836 34.358A1.68 1.68 0 0 0 0 35.792v68.233c0 .6.335 1.133.836 1.433l59.32 34.134c.502.3 1.172.3 1.673 0l49.818-28.667a.998.998 0 0 0 0-1.733l-15.524-8.934a1.97 1.97 0 0 0-2.007 0l-32.153 18.5c-.502.3-1.17.3-1.673 0zM121.149 34.325 61.829.225c-.502-.3-1.17-.3-1.672 0l-31.35 18.033a1 1 0 0 0 0 1.734l15.39 8.866a1.97 1.97 0 0 0 2.008 0l14.052-8.066c.502-.3 1.17-.3 1.673 0l41.353 23.766c.502.3.837.834.837 1.434v36.9a2 2 0 0 0 1.003 1.733l15.391 8.833c.669.4 1.505-.1 1.505-.866v-56.8c0-.6-.334-1.134-.836-1.434z"
            />
          </svg>
        </svg>
      </g>
      <defs>
        <clipPath id="favicon_svg__a">
          <rect width={1000} height={1000} rx={350} ry={350} />
        </clipPath>
      </defs>
    </svg>
  </svg>
)
export default SvgFavicon
