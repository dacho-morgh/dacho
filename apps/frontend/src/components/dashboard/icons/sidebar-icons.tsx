import React from 'react'

export function DashboardIcon({ className = "w-6 h-6", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M22 8.52V3.98C22 2.57 21.36 2 19.77 2H15.73C14.14 2 13.5 2.57 13.5 3.98V8.51C13.5 9.93 14.14 10.49 15.73 10.49H19.77C21.36 10.5 22 9.93 22 8.52Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 19.77V15.73C22 14.14 21.36 13.5 19.77 13.5H15.73C14.14 13.5 13.5 14.14 13.5 15.73V19.77C13.5 21.36 14.14 22 15.73 22H19.77C21.36 22 22 21.36 22 19.77Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 8.52V3.98C10.5 2.57 9.86 2 8.27 2H4.23C2.64 2 2 2.57 2 3.98V8.51C2 9.93 2.64 10.49 4.23 10.49H8.27C9.86 10.5 10.5 9.93 10.5 8.52Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 19.77V15.73C10.5 14.14 9.86 13.5 8.27 13.5H4.23C2.64 13.5 2 14.14 2 15.73V19.77C2 21.36 2.64 22 4.23 22H8.27C9.86 22 10.5 21.36 10.5 19.77Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function RequestsIcon({ className = "w-6 h-6", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path opacity="0.4" d="M17 20.5H7C4 20.5 2 19 2 15.5V8.5C2 5 4 3.5 7 3.5H17C20 3.5 22 5 22 8.5V15.5C22 19 20 20.5 17 20.5Z" fill="currentColor"/>
      <path d="M17 8.5L13.87 11C12.84 11.82 11.15 11.82 10.12 11L7 8.5" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function LettersIcon({ className = "w-6 h-6", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 13H5.76C6.52 13 7.21 13.43 7.55 14.11L8.44 15.9C9 17 10 17 10.24 17H13.77C14.53 17 15.22 16.57 15.56 15.89L16.45 14.1C16.79 13.42 17.48 12.99 18.24 12.99H21.98" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.3398 7H13.6698" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 10H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function EventsIcon({ className = "w-6 h-6", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M13.3 8.10998L14.62 10.75C14.8 11.11 15.28 11.47 15.68 11.53L18.07 11.93C19.6 12.19 19.96 13.29 18.86 14.39L17 16.25C16.69 16.56 16.51 17.17 16.61 17.61L17.14 19.92C17.56 21.74 16.59 22.45 14.98 21.5L12.74 20.17C12.33 19.93 11.67 19.93 11.26 20.17L9.01996 21.5C7.40996 22.45 6.43995 21.74 6.85995 19.92L7.38998 17.61C7.48998 17.18 7.30997 16.57 6.99997 16.25L5.13998 14.39C4.03998 13.29 4.39996 12.18 5.92996 11.93L8.31997 11.53C8.71997 11.46 9.19997 11.11 9.37997 10.75L10.7 8.10998C11.41 6.67998 12.59 6.67998 13.3 8.10998Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 9V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 9V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 4V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function MoreOptionsIcon({ className = "w-6 h-6", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <path d="M12.0004 10.69C11.2804 10.69 10.6904 11.28 10.6904 12C10.6904 12.72 11.2804 13.31 12.0004 13.31C12.7204 13.31 13.3104 12.72 13.3104 12C13.3104 11.28 12.7204 10.69 12.0004 10.69Z" fill="currentColor"/>
      <path d="M7.00043 10.69C6.28043 10.69 5.69043 11.28 5.69043 12C5.69043 12.72 6.28043 13.31 7.00043 13.31C7.72043 13.31 8.31043 12.72 8.31043 12C8.31043 11.28 7.72043 10.69 7.00043 10.69Z" fill="currentColor"/>
      <path d="M17.0004 10.69C16.2804 10.69 15.6904 11.28 15.6904 12C15.6904 12.72 16.2804 13.31 17.0004 13.31C17.7204 13.31 18.3104 12.72 18.3104 12C18.3104 11.28 17.7204 10.69 17.0004 10.69Z" fill="currentColor"/>
    </svg>
  )
}

export function FundLogoIcon({ className = "w-10 h-7", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="40" height="28" viewBox="0 0 40 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
      <rect width="40" height="28" rx="8" fill="#93C5FD"/>
      <circle cx="20" cy="14" r="4.5" fill="#2563EB"/>
      <line x1="8" y1="14" x2="13" y2="14" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="27" y1="14" x2="32" y2="14" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}
