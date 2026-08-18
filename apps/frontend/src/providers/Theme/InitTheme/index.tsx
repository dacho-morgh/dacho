'use client'

const initThemeScript = `
  (function () {
    document.documentElement.setAttribute('data-theme', 'light');
  })();
`

export const InitTheme = () => {
  if (typeof window !== 'undefined') return null

  return (
    <script
      dangerouslySetInnerHTML={{ __html: initThemeScript }}
      id="theme-script"
      suppressHydrationWarning
    />
  )
}
