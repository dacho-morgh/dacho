import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { variant?: 'linear' | 'bulk'; active?: boolean }

export function PeopleIcon({ variant = 'linear', active = false, ...props }: Props) {
  const bulk = variant === 'bulk' || active
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {bulk ? (
        <>
          <path
            opacity=".4"
            d="M17.53 7.77C17.46 7.76 17.39 7.76 17.32 7.77C15.77 7.72 14.54 6.45 14.54 4.89C14.54 3.3 15.83 2 17.43 2C19.02 2 20.32 3.29 20.32 4.89C20.31 6.45 19.08 7.72 17.53 7.77Z"
            fill="currentColor"
          />
          <path
            opacity=".4"
            d="M20.79 14.7C19.67 15.45 18.1 15.73 16.65 15.54C17.03 14.72 17.23 13.81 17.24 12.85C17.24 11.85 17.02 10.9 16.6 10.07C18.08 9.87 19.65 10.15 20.78 10.9C22.36 11.94 22.36 13.65 20.79 14.7Z"
            fill="currentColor"
          />
          <path
            opacity=".4"
            d="M6.44 7.77C6.51 7.76 6.58 7.76 6.65 7.77C8.2 7.72 9.43 6.45 9.43 4.89C9.43 3.3 8.14 2 6.54 2C4.95 2 3.65 3.29 3.65 4.89C3.66 6.45 4.89 7.72 6.44 7.77Z"
            fill="currentColor"
          />
          <path
            opacity=".4"
            d="M6.55 12.85C6.55 13.82 6.76 14.74 7.14 15.57C5.73 15.72 4.26 15.42 3.18 14.71C1.6 13.66 1.6 11.95 3.18 10.9C4.25 10.18 5.76 9.89 7.18 10.05C6.77 10.89 6.55 11.84 6.55 12.85Z"
            fill="currentColor"
          />
          <path
            d="M12.12 15.87C12.04 15.86 11.95 15.86 11.86 15.87C10.02 15.81 8.55 14.3 8.55 12.44C8.55 10.54 10.08 9 11.99 9C13.89 9 15.43 10.54 15.43 12.44C15.43 14.3 13.97 15.81 12.12 15.87Z"
            fill="currentColor"
          />
          <path
            d="M8.87 17.94C7.36 18.95 7.36 20.61 8.87 21.61C10.59 22.76 13.41 22.76 15.13 21.61C16.64 20.6 16.64 18.94 15.13 17.94C13.42 16.79 10.6 16.79 8.87 17.94Z"
            fill="currentColor"
          />
        </>
      ) : (
        <>
          <path
            d="M18 7.16C17.94 7.15 17.87 7.15 17.81 7.16C16.43 7.11 15.33 5.98 15.33 4.58C15.33 3.15 16.48 2 17.91 2C19.34 2 20.49 3.16 20.49 4.58C20.48 5.98 19.38 7.11 18 7.16Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M16.97 14.44C18.34 14.67 19.85 14.43 20.91 13.72C22.32 12.78 22.32 11.24 20.91 10.3C19.84 9.59 18.31 9.35 16.94 9.59"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.97 7.16C6.03 7.15 6.1 7.15 6.16 7.16C7.54 7.11 8.64 5.98 8.64 4.58C8.64 3.15 7.49 2 6.06 2C4.63 2 3.48 3.16 3.48 4.58C3.49 5.98 4.59 7.11 5.97 7.16Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7 14.44C5.63 14.67 4.12 14.43 3.06 13.72C1.65 12.78 1.65 11.24 3.06 10.3C4.13 9.59 5.66 9.35 7.03 9.59"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 14.63C11.94 14.62 11.87 14.62 11.81 14.63C10.43 14.58 9.33 13.45 9.33 12.05C9.33 10.62 10.48 9.47 11.91 9.47C13.34 9.47 14.49 10.63 14.49 12.05C14.48 13.45 13.38 14.59 12 14.63Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.09 17.78C7.68 18.72 7.68 20.26 9.09 21.2C10.69 22.27 13.31 22.27 14.91 21.2C16.32 20.26 16.32 18.72 14.91 17.78C13.32 16.72 10.69 16.72 9.09 17.78Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  )
}
